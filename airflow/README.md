# airflow

Imagem Docker e DAGs que orquestram a extração. O `docker-compose.yml` fica na raiz do repositório, e a execução é local ([ADR 0002](../docs/decisions/0002-execucao-local-best-effort.md)).

## DAG `digisus_extraction`

Arquivo: [dags/digisus_extraction_dag.py](dags/digisus_extraction_dag.py).

- **Agenda:** `0 0 1 * *` (dia 1 de cada mês), `catchup=False`, `max_active_tasks=6`. A DAG nasce pausada (`DAGS_ARE_PAUSED_AT_CREATION`) e precisa ser ativada na interface.
- **`discover_catalog`:** executa `meltano invoke tap-digisus --discover` e salva o catálogo em `catalogs/tap-digisus.json`.
- **`extract_municipio`:** uma task por município (*dynamic task mapping*, a lista vem do `municipios_pe.json` do tap), com 3 retries e intervalo de 5 minutos. Cada task:
  1. espera um tempo escalonado pelo índice, para espalhar as chamadas à API;
  2. apaga sobras de tentativas anteriores (`resultados_metas_<id>-*.parquet`) e roda `meltano run tap-digisus target-parquet --force` com `TAP_DIGISUS_MUNICIPIO_ID` do município;
  3. escolhe o `.parquet` mais recente do município, confere-o e **falha a task se ele tiver menos de 512 bytes** (arquivo vazio de uma extração que não trouxe registros), sem enviá-lo; os 3 retries valem para isso;
  4. autentica no Databricks (`databricks current-user me`);
  5. envia o arquivo com `databricks fs cp --overwrite` para `/Volumes/<catálogo>/<schema>/<volume>/resultados_metas_<id>.parquet`;
  6. apaga o arquivo local.

## Como rodar

A partir da raiz do repositório, com o `.env` preenchido (modelo em `.env.example`):
```bash
docker compose up airflow-init
docker compose up -d --build
```
A interface fica em http://localhost:8080 (usuário e senha padrão `airflow`/`airflow`, uso local). Para executar fora do agendamento, ative a DAG e use *Trigger*. Uma execução completa chama a API do DigiSUS para todos os municípios e consome cota do Databricks.

## Imagem e volumes

- O `Dockerfile` parte de `apache/airflow:3.3.0`, instala o Databricks CLI (versão fixa 1.12.0), cria um venv separado para o Meltano e copia [extraction/](../extraction/README.md) para `/opt/airflow/extraction`, onde roda `meltano install`. Por isso, mudanças em `extraction/` exigem `docker compose up -d --build`.
- O compose monta `airflow/dags`, `airflow/logs`, `airflow/config` e `airflow/plugins`, mais `extraction/output`. `airflow/logs` e `airflow/config/airflow.cfg` são ignorados pelo Git.
- Executor `LocalExecutor`, com Postgres 16 no próprio compose.

## Variáveis usadas

`AIRFLOW_UID`, `FERNET_KEY` e `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_CATALOG`, `DATABRICKS_SCHEMA`, `DATABRICKS_VOLUME_RAW` (o Databricks CLI lê host e token do ambiente). Opcionais: `_AIRFLOW_WWW_USER_*` e `AIRFLOW__API_AUTH__*`.

## Como se conecta

Executa a extração de [extraction/](../extraction/README.md) e entrega os Parquet no Volume do Databricks. A DAG não roda o dbt ([transform/](../transform/README.md)), que é executado separadamente.
