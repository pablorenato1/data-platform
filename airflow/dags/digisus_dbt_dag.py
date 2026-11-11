from __future__ import annotations
from datetime import datetime, timedelta

from airflow.sdk import dag
from airflow.providers.standard.operators.bash import BashOperator

DBT = "/opt/airflow/dbt-venv/bin/dbt"
PROJETO = "cd /opt/airflow/transform"


@dag(
    dag_id="digisus_dbt",
    start_date=datetime(2026, 1, 1),
    schedule=None,
    catchup=False,
    tags=["digisus", "dbt", "transformacao"],
)
def digisus_dbt():
    # Roda a modelagem (transform/) sobre a tabela raw: seeds, modelos e testes, nessa ordem.
    # É disparada ao fim da DAG digisus_carga e também pode ser executada à mão (Trigger).
    # Se um teste falhar, o dbt não roda o que depende dele e a task fica como falha.
    deps = BashOperator(
        task_id="dbt_deps",
        bash_command=f"{PROJETO} && {DBT} deps --profiles-dir .",
    )

    build = BashOperator(
        task_id="dbt_build",
        bash_command=f"{PROJETO} && {DBT} build --profiles-dir .",
        execution_timeout=timedelta(minutes=30),
    )

    deps >> build


digisus_dbt()
