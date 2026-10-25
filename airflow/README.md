# airflow

Imagem Docker e DAGs que orquestram a extração. O `docker-compose.yml` fica na raiz do repositório.

**DAG `digisus_extraction`** ([dags/](dags/digisus_extraction_dag.py)): agendada para o dia 1 de cada mês (`0 0 1 * *`), com `catchup=False` e `max_active_tasks=6`.
1. `discover_catalog`: gera o catálogo do `tap-digisus`.
2. `extract_municipio` (uma task por município, *dynamic task mapping*, 3 retries): roda `meltano run tap-digisus target-parquet`, valida o `.parquet` gerado e envia para o Volume do Databricks (`databricks fs cp`) em `/Volumes/<catalogo>/<schema>/<volume>/`.

**Como rodar** (a partir da raiz): `docker compose up airflow-init && docker compose up -d --build`. Variáveis em `.env` (ver `.env.example`).

**Conexões:** o `Dockerfile` copia [extraction/](../extraction/README.md) para `/opt/airflow/extraction`, instala o Meltano em um venv próprio e o Databricks CLI. A DAG lê `DATABRICKS_*` do ambiente. `airflow.cfg` e `logs/` locais são ignorados pelo Git. O dbt ([transform/](../transform/README.md)) roda depois, fora do Airflow.
