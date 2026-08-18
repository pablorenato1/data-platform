"""REST client handling, including DigisusStream base class."""

from __future__ import annotations

import json
import time
import typing as t
from datetime import datetime, timezone
from pathlib import Path

from singer_sdk.authenticators import APIAuthenticatorBase
from singer_sdk.authenticators import SimpleAuthenticator
from singer_sdk.exceptions import FatalAPIError, RetriableAPIError
from singer_sdk.streams import RESTStream

if t.TYPE_CHECKING:
    import requests

ERRORS_LOG_PATH = Path(__file__).parent / "data" / "errors.jsonl"


class DigisusStream(RESTStream):
    """Base stream class for tap-digisus."""

    url_base = "https://digisusgmp.saude.gov.br/v1.5/api"

    @property
    def authenticator(self) -> SimpleAuthenticator:
        # API não valida credencial real. X-CSRF-TOKEN vazio é aceito
        return SimpleAuthenticator(stream=self)

    @property
    def http_headers(self) -> dict:
        headers = {"accept": "application/json"}
        headers["X-CSRF-TOKEN"] = ""
        return headers
    
    def parse_response(self, response: requests.Response) -> t.Iterable[dict]:
        """Sobrescrito porque a API às vezes retorna uma string de negócio
        (ex: "Não foi possível identificar o projeto") em vez de um objeto
        JSON estruturado, quando o município não tem projeto cadastrado
        naquele ano/tipo. Isso não é erro — é ausência de dado esperada."""
        data = response.json()

        if isinstance(data, str):
            yield {
                "esfera": "MUN",
                "estado": "PE",
                "municipio": None,
                "projeto_tipo": None,
                "nu_ano_exercicio": None,
                "status": "sem_projeto_identificado",
                "diretrizes": None,
            }
            return

        yield data

    # ------------------------------------------------------------------
    # Rate limiting proativo
    # ------------------------------------------------------------------
    @property
    def _rate_limit_per_minute(self) -> int:
        return int(self.config.get("rate_limit_per_minute", 50))

    @property
    def _min_seconds_between_requests(self) -> float:
        return 60.0 / self._rate_limit_per_minute

    def _sleep_for_rate_limit(self) -> None:
        time.sleep(self._min_seconds_between_requests)

    def prepare_request(
        self,
        context: dict | None,
        next_page_token: t.Any | None,
    ) -> requests.PreparedRequest:
        self._sleep_for_rate_limit()
        return super().prepare_request(context, next_page_token)

    # ------------------------------------------------------------------
    # Backoff / retry (rede de segurança pro 429, mesmo sendo proativo)
    # ------------------------------------------------------------------
    def backoff_max_tries(self) -> int:
        return 3

    def backoff_wait_generator(self) -> t.Generator[float, None, None]:
        # Exponencial: 2s, 4s, 8s
        return (2**n for n in range(1, self.backoff_max_tries() + 1))

    def validate_response(self, response: requests.Response) -> None:
        status = response.status_code

        if status == 400:
            self._log_error(response, category="permanent")
            raise FatalAPIError(
                f"[400] Erro de parâmetro (não retryable): {response.url}"
            )

        if status == 429:
            self._log_error(response, category="retryable", pending=True)
            retry_after = response.headers.get("Retry-After")
            if retry_after:
                time.sleep(float(retry_after))
            raise RetriableAPIError(f"[429] Rate limit estourado: {response.url}")

        if status >= 500:
            self._log_error(response, category="retryable", pending=True)
            raise RetriableAPIError(f"[{status}] Erro no servidor: {response.url}")

        if status >= 400:
            # Qualquer outro 4xx não documentado — trata como fatal por segurança.
            self._log_error(response, category="permanent")
            raise FatalAPIError(f"[{status}] Erro não mapeado: {response.url}")

    # ------------------------------------------------------------------
    # Log de erros terminal (fora do state do Meltano)
    # ------------------------------------------------------------------
    def _log_error(
        self,
        response: requests.Response,
        category: str,
        pending: bool = False,
    ) -> None:
        """Grava a falha em errors.jsonl para auditoria e retry seletivo.

        `pending=True` marca uma tentativa que ainda pode ser resolvida por
        retry automático do backoff. Se o backoff esgotar as tentativas,
        streams.py é responsável por registrar o status final (esgotado).
        """
        ERRORS_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

        context = getattr(response, "_digisus_context", None) or {}

        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "url": response.url,
            "status_code": response.status_code,
            "categoria": category,
            "pending_retry": pending,
            "municipio_id": context.get("municipio_id"),
            "ano": context.get("ano"),
            "tipo": context.get("tipo"),
        }

        with ERRORS_LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")