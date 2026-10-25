from __future__ import annotations
import json
from datetime import datetime, timedelta
from pathlib import Path
import os

from airflow.sdk import dag
from airflow.providers.standard.operators.bash import BashOperator

MUNICIPIOS_PATH = Path("/opt/airflow/extraction/tap-digisus/tap_digisus/data/municipios_pe.json")

def _load_municipios() -> list[dict]:
    with MUNICIPIOS_PATH.open(encoding="utf-8") as f:
        raw = json.load(f)
    return [{"id": str(m["id"])[:-1], "nome": m.get("nome", str(m["id"])[:-1])} for m in raw]

@dag(
    dag_id="digisus_extraction",
    start_date=datetime(2026, 1, 1),
    schedule="0 0 1 * *",
    catchup=False,
    max_active_tasks=6,
    tags=["digisus", "meltano", "databricks", "extraction"],
)
def digisus_extraction():
    municipios = _load_municipios()

    discover_catalog = BashOperator(
        task_id="discover_catalog",
        bash_command=(
            "cd /opt/airflow/extraction && "
            "mkdir -p catalogs && "
            "/opt/airflow/meltano-venv/bin/meltano invoke tap-digisus --discover "
            "> catalogs/tap-digisus.json"
        ),
    )

    extract_and_upload = BashOperator.partial(
        task_id="extract_municipio",
        map_index_template="{{ task.params.municipio_id }} - {{ task.params.municipio_nome }}",
        bash_command=(
            "echo '====================================' \n"
            "echo '🚀 INICIANDO DEBUG PASSO-A-PASSO' \n"
            "echo '====================================' \n"
            "set -e && "
            "sleep $(( {{ 2 * ti.map_index }} % 20 )) && "
            
            "echo '\n👉 [PASSO 1] Verificando Variaveis de Ambiente no Contexto do Airflow:' \n"
            "echo \"DATABRICKS_CATALOG: '${DATABRICKS_CATALOG}'\" \n"
            "echo \"DATABRICKS_SCHEMA: '${DATABRICKS_SCHEMA}'\" \n"
            "echo \"DATABRICKS_VOLUME_RAW: '${DATABRICKS_VOLUME_RAW}'\" \n"
            
            "echo '\n👉 [PASSO 2] Extraindo dados com Meltano:' \n"
            "cd /opt/airflow/extraction && "
            "export TAP_DIGISUS_MUNICIPIO_ID={{ params.municipio_id }} && "
            "PYTHONWARNINGS=\"ignore\" /opt/airflow/meltano-venv/bin/meltano run tap-digisus target-parquet --force \n"
            
            "echo '\n👉 [PASSO 3] Validando Arquivo Parquet Gerado:' \n"
            "PARQUET_FILE=$(ls resultados_metas_{{ params.municipio_id }}-*.parquet | head -n 1) \n"
            "echo \"Nome do arquivo capturado: $PARQUET_FILE\" \n"
            "ls -lh \"$PARQUET_FILE\" \n"
            "TAMANHO=$(stat -c %s \"$PARQUET_FILE\") \n"
            "if [ \"$TAMANHO\" -lt 512 ]; then "
            "echo \"❌ Parquet vazio ou incompleto ($TAMANHO bytes): nenhum registro extraido. Nao sera enviado.\"; "
            "rm -f \"$PARQUET_FILE\"; exit 1; fi \n"
            
            "echo '\n👉 [PASSO 4] Testando Autenticacao do Databricks:' \n"
            "databricks current-user me || { echo '❌ Falha na autenticação do Databricks!'; exit 1; } \n"
            "echo '✅ Autenticação OK!' \n"
            
            "echo '\n👉 [PASSO 5] Montando URL e Iniciando Upload:' \n"
            "DESTINO=\"dbfs:/Volumes/${DATABRICKS_CATALOG}/${DATABRICKS_SCHEMA}/${DATABRICKS_VOLUME_RAW}/resultados_metas_{{ params.municipio_id }}.parquet\" \n"
            "echo \"URL de destino: $DESTINO\" \n"
            
            "databricks fs cp \"$PARQUET_FILE\" \"$DESTINO\" --overwrite \n"
            
            "echo '\n👉 [PASSO 6] Limpeza de Arquivo Local:' \n"
            "rm -f \"$PARQUET_FILE\" \n"
            "echo '✅ PROCESSO FINALIZADO COM SUCESSO' \n"
        ),
        retries=3,
        retry_delay=timedelta(minutes=5),
    ).expand(params=[{"municipio_id": m["id"], "municipio_nome": m["nome"]} for m in municipios])

    discover_catalog >> extract_and_upload

digisus_extraction()