from __future__ import annotations
from datetime import datetime, timedelta

from airflow.sdk import dag
from airflow.providers.standard.operators.bash import BashOperator
from airflow.providers.standard.operators.trigger_dagrun import TriggerDagRunOperator


@dag(
    dag_id="digisus_carga",
    start_date=datetime(2026, 1, 1),
    schedule=None,
    catchup=False,
    tags=["digisus", "databricks", "carga"],
)
def digisus_carga():
    # Dispara o Job do Databricks (notebook databricks/carga_raw_resultados_metas.py), que converte
    # os Parquet do Volume na tabela Delta raw.resultados_metas, e espera terminar. É disparada ao
    # fim da DAG digisus_extraction e também pode ser executada à mão (Trigger).
    # A CLI considera o Job concluído ao chegar em TERMINATED mesmo que a execução tenha falhado,
    # por isso o result_state é conferido aqui.
    carga = BashOperator(
        task_id="carga_delta_databricks",
        bash_command=(
            "set -e && "
            "databricks jobs run-now \"${DATABRICKS_JOB_ID_CARGA}\" --timeout 60m -o json > /tmp/carga_job.json && "
            "python3 -c \""
            "import json,sys; t=open('/tmp/carga_job.json').read(); r=json.loads(t[t.index('{'):]); "
            "s=r.get('state',{}); print('Resultado:', s.get('result_state'), '-', s.get('state_message'), '-', r.get('run_page_url')); "
            "sys.exit(0 if s.get('result_state')=='SUCCESS' else 1)\""
        ),
        execution_timeout=timedelta(minutes=90),
    )

    # Com a carga concluída, dispara a modelagem (DAG digisus_dbt) e espera terminar.
    dispara_dbt = TriggerDagRunOperator(
        task_id="dispara_dbt",
        trigger_dag_id="digisus_dbt",
        wait_for_completion=True,
        poke_interval=30,
        failed_states=["failed"],
    )

    carga >> dispara_dbt


digisus_carga()
