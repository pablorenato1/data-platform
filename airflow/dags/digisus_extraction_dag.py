from __future__ import annotations
import json
from datetime import datetime, timedelta
from pathlib import Path
import os

from airflow.sdk import dag
from airflow.providers.smtp.notifications.smtp import SmtpNotifier
from airflow.providers.standard.operators.bash import BashOperator
from airflow.providers.standard.operators.trigger_dagrun import TriggerDagRunOperator

MUNICIPIOS_PATH = Path("/opt/airflow/extraction/tap-digisus/tap_digisus/data/municipios_pe.json")

# E-mail de aviso ao fim de cada execução da DAG (ok ou falha). Sem NOTIFY_EMAIL no .env, nada é enviado.
NOTIFY_EMAIL = os.environ.get("NOTIFY_EMAIL")
LINK_EXECUCAO = "http://localhost:8080/dags/{{ dag.dag_id }}/runs/{{ run_id }}"


def _aviso(titulo: str) -> list[SmtpNotifier]:
    if not NOTIFY_EMAIL:
        return []
    return [
        SmtpNotifier(
            smtp_conn_id="smtp_default",
            to=NOTIFY_EMAIL,
            subject=f"[DigiSUS] {{{{ dag.dag_id }}}}: {titulo} ({{{{ run_id }}}})",
            html_content=f"<p>Execução <b>{{{{ run_id }}}}</b> da DAG <b>{{{{ dag.dag_id }}}}</b>: {titulo}.</p>"
            f"<p><a href=\"{LINK_EXECUCAO}\">Abrir no Airflow</a></p>",
        )
    ]

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
    on_success_callback=_aviso("concluída com sucesso"),
    on_failure_callback=_aviso("FALHOU"),
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
            "rm -f resultados_metas_{{ params.municipio_id }}-*.parquet && "
            "PYTHONWARNINGS=\"ignore\" /opt/airflow/meltano-venv/bin/meltano run tap-digisus target-parquet --force \n"
            
            "echo '\n👉 [PASSO 3] Validando Arquivo Parquet Gerado:' \n"
            "PARQUET_FILE=$(ls -t resultados_metas_{{ params.municipio_id }}-*.parquet | head -n 1) \n"
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

    # Só roda quando todos os municípios foram enviados ao Volume. Dispara a DAG digisus_carga
    # (Job do Databricks) e espera terminar: se a carga falhar, esta DAG também falha.
    dispara_carga = TriggerDagRunOperator(
        task_id="dispara_carga",
        trigger_dag_id="digisus_carga",
        wait_for_completion=True,
        poke_interval=60,
        failed_states=["failed"],
    )

    discover_catalog >> extract_and_upload >> dispara_carga

digisus_extraction()