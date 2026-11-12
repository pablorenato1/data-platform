"""Exporta os marts do Databricks para os arquivos JSON que o site estático lê.

Lê só dos marts (leitura, sem alterar nada) e grava em site/data/:
  municipios.json             lista de municípios, anos e cobertura, e as datas da carga e da exportação
  resumo_mesorregiao.json     o mesmo resumo, uma vez por mesorregião
  municipios_resumo.json      por município, ano e relatório: status, classes e faixas (aba Municípios)
  resumo.json                 estado: municípios por status, indicadores por classe e por faixa de alcance, por ano e relatório
  mapa.json                   por ano e relatório: indicadores atingidos e total de cada município (mapa)
  relatorios/<id>.json        os 4 relatórios de cada ano do município, com classes e faixas de alcance
  metas/<id>-<ano>.json       diretrizes, objetivos, metas e indicadores do município no ano, 4 relatórios lado a lado

Variáveis de ambiente: DATABRICKS_HOST, DATABRICKS_HTTP_PATH, DBT_DATABRICKS_TOKEN, DATABRICKS_CATALOG.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from databricks import sql

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "site" / "data"
CATALOGO = os.environ.get("DATABRICKS_CATALOG", "municipio_inteligente")
SUFIXOS = ["1q", "2q", "3q", "rag"]
TIPOS = ["1º RDQA", "2º RDQA", "3º RDQA", "RAG"]
# Municípios que o site não exibe (continuam nos marts do dbt): Fernando de Noronha
EXCLUIDOS = {"260545"}


def numero(v):
    if isinstance(v, Decimal):
        return float(v)
    return v


def momento_utc(valor):
    """datetime do Databricks (a sessão está em UTC) para texto ISO com Z; None se vazio."""
    if valor is None:
        return None
    if valor.tzinfo is not None:
        valor = valor.astimezone(timezone.utc)
    return valor.strftime("%Y-%m-%dT%H:%M:%SZ")


def consultar(cur, consulta: str) -> list[dict]:
    cur.execute(consulta)
    colunas = [c[0] for c in cur.description]
    return [dict(zip(colunas, (numero(v) for v in linha))) for linha in cur.fetchall()]


def chave_ordem(texto: str):
    """'1.10' depois de '1.9': compara os números da numeração, não o texto."""
    try:
        return tuple(int(p) for p in texto.split("."))
    except (ValueError, AttributeError):
        return (10**9, str(texto))


def gravar(caminho: Path, conteudo) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(conteudo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def montar_resumo(relatorios: list[dict], faixas: list[dict]) -> dict:
    """Municípios por status, indicadores por classe e por faixa de alcance, por ano e relatório."""
    status_por = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    classes_por = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for r in relatorios:
        ano, tipo = str(r["ano"]), r["projeto_tipo"]
        status_por[ano][tipo][r["status"] or "sem_dados"] += 1
        for classe in ("atingida", "parcial", "zero", "sem_valor"):
            classes_por[ano][tipo][classe] += r[f"ind_{classe}"]
    faixas_por = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for f in faixas:
        faixas_por[str(f["ano"])][f["projeto_tipo"]][f["faixa_ordem"]] += f["qtd_indicadores"]
    return {
        ano: {
            tipo: {
                "status": sorted(status_por[ano][tipo].items(), key=lambda kv: -kv[1]),
                "classes": dict(classes_por[ano][tipo]),
                "faixas": sorted(faixas_por[ano][tipo].items()),
            }
            for tipo in TIPOS
        }
        for ano in status_por
    }


def main() -> int:
    conexao = sql.connect(
        server_hostname=os.environ["DATABRICKS_HOST"].replace("https://", ""),
        http_path=os.environ["DATABRICKS_HTTP_PATH"],
        access_token=os.environ["DBT_DATABRICKS_TOKEN"],
    )
    cur = conexao.cursor()
    marts = f"{CATALOGO}.marts"

    print("Lendo mart_relatorios e mart_faixas_alcancado...")
    relatorios = consultar(cur, f"SELECT * FROM {marts}.mart_relatorios")
    faixas = consultar(
        cur,
        f"SELECT municipio_id, ano, projeto_tipo, faixa_ordem, qtd_indicadores "
        f"FROM {marts}.mart_faixas_alcancado WHERE nivel = 'relatorio'",
    )
    print("Lendo mart_metas_evolucao e os textos de diretrizes e objetivos...")
    metas = consultar(cur, f"SELECT * FROM {marts}.mart_metas_evolucao")
    textos = consultar(
        cur,
        f"SELECT nivel, municipio_id, ano, ordenacao, max(descricao) AS descricao "
        f"FROM {marts}.mart_completude_niveis WHERE nivel IN ('diretriz', 'objetivo') "
        f"GROUP BY nivel, municipio_id, ano, ordenacao",
    )
    # Quando os dados foram carregados no Databricks (a carga roda logo depois da extração). `_extracted_at`,
    # o momento da extração em si, só existe se o notebook de carga a gravar; sem ela, fica vazio.
    carga_em = extraido_em = None
    try:
        cur.execute(f"SELECT max(_ingested_at) FROM {CATALOGO}.raw.resultados_metas")
        carga_em = momento_utc(cur.fetchone()[0])
    except Exception as erro:  # a data é só informativa; a exportação não deve falhar por causa dela
        print(f"Aviso: não foi possível ler a data da carga ({type(erro).__name__}).")
    try:
        cur.execute(f"SELECT max(_extracted_at) FROM {CATALOGO}.raw.resultados_metas")
        extraido_em = momento_utc(cur.fetchone()[0])
    except Exception:
        pass
    conexao.close()

    relatorios = [r for r in relatorios if r["municipio_id"] not in EXCLUIDOS]
    faixas = [f for f in faixas if f["municipio_id"] not in EXCLUIDOS]
    metas = [m for m in metas if m["municipio_id"] not in EXCLUIDOS]
    textos = [x for x in textos if x["municipio_id"] not in EXCLUIDOS]

    gerado_em = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    tmp = DESTINO.with_name("data.tmp")
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)

    # --- relatorios/<id>.json -------------------------------------------------
    faixas_por_relatorio = defaultdict(list)
    for f in faixas:
        faixas_por_relatorio[(f["municipio_id"], f["ano"], f["projeto_tipo"])].append([f["faixa_ordem"], f["qtd_indicadores"]])

    por_municipio = defaultdict(list)
    for r in relatorios:
        por_municipio[r["municipio_id"]].append(r)

    municipios = []
    resumo_municipios = {}
    anos_todos = set()
    for mid, linhas in sorted(por_municipio.items(), key=lambda kv: kv[1][0]["municipio"]):
        primeira = linhas[0]
        anos = defaultdict(list)
        for r in sorted(linhas, key=lambda x: (x["ano"], x["ordem_relatorio"])):
            anos[str(r["ano"])].append({
                "tipo": r["projeto_tipo"],
                "status": r["status"],
                "tem_dados": r["tem_dados_na_extracao"],
                "tem_metas": r["tem_metas"],
                "qtd_metas": r["qtd_metas"],
                "qtd_zero": r["qtd_metas_zero"],
                "taxa_acima_de_zero": r["taxa_acima_de_zero"],
                "mediana_alcancado": r["mediana_alcancado"],
                "qtd_indicadores": r["ind_total"],
                "classes": {
                    "atingida": r["ind_atingida"],
                    "parcial": r["ind_parcial"],
                    "zero": r["ind_zero"],
                    "sem_valor": r["ind_sem_valor"],
                },
                "faixas": sorted(faixas_por_relatorio.get((mid, r["ano"], r["projeto_tipo"]), [])),
            })
            anos_todos.add(r["ano"])
        resumo_municipios[mid] = {
            ano: {x["tipo"]: {"s": x["status"], "c": [x["classes"]["atingida"], x["classes"]["parcial"], x["classes"]["zero"], x["classes"]["sem_valor"]], "f": x["faixas"]}
                  for x in rels}
            for ano, rels in anos.items()
        }
        gravar(tmp / "relatorios" / f"{mid}.json", {
            "id": mid,
            "nome": primeira["municipio"],
            "microrregiao": primeira["microrregiao"],
            "mesorregiao": primeira["mesorregiao"],
            "anos": anos,
        })
        municipios.append({
            "id": mid,
            "nome": primeira["municipio"],
            "microrregiao": primeira["microrregiao"],
            "mesorregiao": primeira["mesorregiao"],
            "tem_dados": any(r["tem_dados_na_extracao"] for r in linhas),
            "anos_com_metas": sorted({r["ano"] for r in linhas if r["tem_metas"]}),
        })

    # --- resumo.json (estado) e mapa.json -------------------------------------
    mapa = defaultdict(lambda: defaultdict(dict))
    for r in relatorios:
        if r["ind_total"] > 0:
            mapa[str(r["ano"])][r["projeto_tipo"]][r["municipio_id"]] = [r["ind_atingida"], r["ind_total"]]
    gravar(tmp / "resumo.json", montar_resumo(relatorios, faixas))
    # Mesma estrutura do resumo.json, uma por mesorregião (o site usa quando se escolhe uma região)
    meso_de = {r["municipio_id"]: r["mesorregiao"] for r in relatorios}
    gravar(tmp / "resumo_mesorregiao.json", {
        meso: montar_resumo([r for r in relatorios if r["mesorregiao"] == meso],
                            [f for f in faixas if meso_de.get(f["municipio_id"]) == meso])
        for meso in sorted({m for m in meso_de.values() if m})
    })
    gravar(tmp / "mapa.json", mapa)

    gravar(tmp / "municipios_resumo.json", resumo_municipios)
    gravar(tmp / "municipios.json", {
        "gerado_em": gerado_em,        # quando o JSON foi gerado (não é a data dos dados)
        "carga_em": carga_em,          # quando os dados foram carregados no Databricks (UTC)
        "extraido_em": extraido_em,    # quando foram extraídos do DigiSUS, se a carga registrar
        "anos": sorted(anos_todos),
        "total_municipios": len(municipios),
        "municipios_com_dados": sum(1 for m in municipios if m["tem_dados"]),
        "municipios": municipios,
    })

    # --- metas/<id>-<ano>.json ------------------------------------------------
    texto = {(t["nivel"], t["municipio_id"], t["ano"], t["ordenacao"]): t["descricao"] for t in textos}

    grupos = defaultdict(list)
    for m in metas:
        grupos[(m["municipio_id"], m["ano"])].append(m)

    for (mid, ano), linhas in grupos.items():
        arvore = defaultdict(lambda: defaultdict(lambda: defaultdict(
            lambda: {"descricao": None, "tipo_valor": None, "indicadores": []})))
        for m in linhas:
            meta = arvore[m["diretriz_ordenacao"]][m["objetivo_ordenacao"]][m["meta_ordenacao"]]
            meta["descricao"] = meta["descricao"] or m["ds_meta"]
            meta["tipo_valor"] = meta["tipo_valor"] or m["tipo_valor_meta"]
            meta["indicadores"].append({
                "nome": m["ds_indicador"],
                "rel": {
                    s: {
                        "status": m[f"status_{s}"],
                        "plano": m[f"vl_projetado_plano_{s}"],
                        "executado": m[f"vl_executado_{s}"],
                        "alcancado": m[f"vl_alcancado_{s}"],
                        "classe": m[f"classe_{s}"],
                    }
                    for s in SUFIXOS
                },
            })
        saida = []
        for dord in sorted(arvore, key=chave_ordem):
            objetivos = []
            for oord in sorted(arvore[dord], key=chave_ordem):
                objetivos.append({
                    "ordem": oord,
                    "descricao": texto.get(("objetivo", mid, ano, oord)),
                    "metas": [{"ordem": mord, **arvore[dord][oord][mord]} for mord in sorted(arvore[dord][oord], key=chave_ordem)],
                })
            saida.append({"ordem": dord, "descricao": texto.get(("diretriz", mid, ano, dord)), "objetivos": objetivos})
        gravar(tmp / "metas" / f"{mid}-{ano}.json", {"municipio_id": mid, "ano": ano, "diretrizes": saida})

    # troca a pasta antiga pela nova de uma vez
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    tmp.rename(DESTINO)
    print(f"Pronto: {len(municipios)} municípios, {len(grupos)} arquivos de metas em {DESTINO}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
