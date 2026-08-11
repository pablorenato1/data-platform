"""Stream type classes for tap-digisus."""

from __future__ import annotations

import json
import os
import typing as t
from pathlib import Path
from decimal import Decimal

from singer_sdk import typing as th
from singer_sdk.exceptions import FatalAPIError, RetriableAPIError

from tap_digisus.client import DigisusStream, ERRORS_LOG_PATH

MUNICIPIOS_PATH = Path(__file__).parent / "data" / "municipios_pe.json"

# Faixa confirmada empiricamente (curl manual): API não tem dado antes de 2016.
# =======================================================
# Variaveis de DEBUG
# ANOS = [2016, 2020, 2024] # list(range(2016, 2025))  # 2016..2024
# TIPOS_PROJETO = [10]  # 1oRDQA, 2oRDQA, 3oRDQA, RAG
# =======================================================
# Variaveis Reais
ANOS = list(range(2016, 2026))  # 2016..2024
TIPOS_PROJETO = [10, 11, 12, 13]  # 1oRDQA, 2oRDQA, 3oRDQA, RAG
# =======================================================

RETRY_MODE = os.getenv("TAP_DIGISUS_RETRY_MODE", "false").lower() == "true"


def _load_municipio_ids() -> list[dict]:
    with MUNICIPIOS_PATH.open(encoding="utf-8") as f:
        raw = json.load(f)
    # Confirmado por teste manual (30 municípios): remove o último dígito
    # (dígito verificador) do código IBGE de 7 dígitos.
    return [
        {"id": str(m["id"])[:-1], "nome": m["nome"]}
        for m in raw #[:3] # TESTANDO, REMVOER O [:3] POSTERIORMENTE
    ]

MUNICIPIO_LOOKUP = {m["id"]: m["nome"] for m in _load_municipio_ids()}  # módulo, carregado uma vez

def _load_retryable_keys() -> set[tuple[str, int, int]] | None:
    """Lê errors.jsonl de uma run anterior e retorna as chaves marcadas
    como falha esgotada e retryable. None se não houver log anterior."""
    if not ERRORS_LOG_PATH.exists():
        return None

    keys: set[tuple[str, int, int]] = set()
    with ERRORS_LOG_PATH.open(encoding="utf-8") as f:
        for line in f:
            entry = json.loads(line)
            if entry.get("categoria") == "retryable" and not entry.get("pending_retry"):
                # pending_retry=False aqui = tentativa esgotada, registrada
                # pelo get_records (não a tentativa intermediária do client.py)
                keys.add((entry["municipio_id"], entry["ano"], entry["tipo"]))
    return keys or None

def _convert_decimals(obj):                      # ← função nova, fora da classe
    """Converte Decimal para float recursivamente, em qualquer profundidade."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _convert_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_decimals(v) for v in obj]
    return obj

class ResultadosMetasStream(DigisusStream):
    """Stream bruto/aninhado do endpoint resultados-metas."""

    name = "resultados_metas"
    path = "/relatorio/resultados-metas"
    primary_keys: t.ClassVar[list[str]] = []  # sem PK natural; dado bruto, dbt normaliza depois
    replication_key = None  # FULL_TABLE — API não expõe campo de atualização incremental
    

    # responsabilidade do dbt, não do tap (ELT, não ETL).
    schema = th.PropertiesList(
        th.Property("esfera", th.StringType),
        th.Property("estado", th.StringType),
        th.Property("municipio", th.StringType),
        th.Property("projeto_tipo", th.StringType),
        th.Property("nu_ano_exercicio", th.StringType),
        th.Property("status", th.StringType),
        th.Property("diretrizes", th.StringType),  # JSON serializado como string
        # Contexto da extração — não vem da API, injetado por nós.
        th.Property("_extract_municipio_id", th.StringType),
        th.Property("_extract_ano", th.IntegerType),
        th.Property("_extract_tipo", th.IntegerType),
    ).to_dict()

    @property
    def partitions(self) -> list[dict]:
        municipios = _load_municipio_ids()
        all_partitions = [
            {"municipio_id": m["id"], "ano": ano, "tipo": tipo}
            for m in municipios
            for ano in ANOS
            for tipo in TIPOS_PROJETO
        ]

        if not RETRY_MODE:
            return all_partitions

        retryable_keys = _load_retryable_keys()
        if retryable_keys is None:
            # Modo retry ligado, mas não existe errors.jsonl de run anterior.
            # Não faz sentido rodar tudo de novo silenciosamente — melhor
            # falhar alto e avisar, que é o comportamento seguro.
            raise FileNotFoundError(
                "TAP_DIGISUS_RETRY_MODE=true, mas não há errors.jsonl anterior "
                f"em {ERRORS_LOG_PATH}. Rode uma sync completa primeiro."
            )

        return [
            p for p in all_partitions
            if (p["municipio_id"], p["ano"], p["tipo"]) in retryable_keys
        ]

    def get_url_params(
        self, context: dict | None, next_page_token: t.Any | None
    ) -> dict[str, t.Any]:
        assert context is not None
        return {
            "co_esfera": 1,
            "sg_uf": "PE",
            "co_municipio_ibge": context["municipio_id"],
            "nu_ano_exercicio": context["ano"],
            "co_projeto_tipo": context["tipo"],
        }

    def get_records(self, context: dict | None) -> t.Iterable[dict]:
        """Sobrescrito para impedir que uma falha em UMA partição derrube
        a sync inteira. O SDK, por padrão, deixa a exceção subir."""
        assert context is not None
        try:
            for record in super().get_records(context):
                record["_extract_municipio_id"] = context["municipio_id"]
                record["_extract_ano"] = context["ano"]
                record["_extract_tipo"] = context["tipo"]
                yield record
        except (FatalAPIError, RetriableAPIError) as exc:
            # Chegou aqui = backoff do client.py já esgotou as tentativas
            # (RetriableAPIError) ou é erro sem retry (FatalAPIError).
            # Registra como falha ESGOTADA (pending_retry=False), diferente
            # das tentativas intermediárias já logadas pelo client.py.
            self._log_exhausted_failure(context, exc)
            self.logger.warning(
                "Partição pulada após falha: municipio=%s ano=%s tipo=%s (%s)",
                context["municipio_id"], context["ano"], context["tipo"], exc,
            )
            return  # segue pro próximo item de partitions; não propaga

    def _log_exhausted_failure(self, context: dict, exc: Exception) -> None:
        import json as _json
        from datetime import datetime, timezone

        categoria = "permanent" if isinstance(exc, FatalAPIError) else "retryable"
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "municipio_id": context["municipio_id"],
            "ano": context["ano"],
            "tipo": context["tipo"],
            "categoria": categoria,
            "pending_retry": False,  # esgotada, diferente do log intermediário
            "erro": str(exc),
        }
        ERRORS_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with ERRORS_LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(_json.dumps(entry, ensure_ascii=False) + "\n")
    

    def post_process(self, row: dict, context: dict | None = None) -> dict | None:
        row = super().post_process(row, context) or row
        row = _convert_decimals(row)

        if row.get("status") == "sem_projeto_identificado" and context:
            row["estado"] = "PE"
            row["municipio"] = MUNICIPIO_LOOKUP.get(context["municipio_id"])
            row["nu_ano_exercicio"] = str(context["ano"])

        if row.get("diretrizes") is not None:
            row["diretrizes"] = json.dumps(row["diretrizes"], ensure_ascii=False)
        return row