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
- **`dispara_carga`:** roda só depois que todos os municípios foram enviados (se algum falhar depois dos retries, esta etapa não roda; ao refazer a task que falhou ela segue sozinha). Dispara a DAG `digisus_carga` e espera terminar; se a carga falhar, esta DAG também falha.

## DAG `digisus_carga`

Arquivo: [dags/digisus_carga_dag.py](dags/digisus_carga_dag.py). Sem agendamento: é disparada pela `digisus_extraction` ao fim e também **à mão** (*Trigger*), por exemplo depois de reprocessar alguns municípios. A única task, `carga_delta_databricks`, dispara o Job do Databricks `DATABRICKS_JOB_ID_CARGA` (o notebook [databricks/carga_raw_resultados_metas.py](../databricks/README.md), que converte os Parquet em `raw.resultados_metas`) com `databricks jobs run-now`, espera até 60 minutos e **falha se o `result_state` do Job não for `SUCCESS`** (a CLI considera o Job concluído ao chegar em `TERMINATED`, mesmo com falha).
- **Aviso por e-mail:** ao fim de cada execução da DAG, ok ou com falha, é enviado um e-mail para `NOTIFY_EMAIL` com o link da execução. Sem `NOTIFY_EMAIL`, nada é enviado.

Ao final, com a carga concluída, a task `dispara_dbt` dispara a DAG `digisus_dbt` e espera terminar.

## DAG `digisus_dbt`

Arquivo: [dags/digisus_dbt_dag.py](dags/digisus_dbt_dag.py). Sem agendamento: é disparada pela `digisus_carga` e também **à mão** (*Trigger*), por exemplo depois de ajustar um modelo. Roda `dbt deps` e `dbt build` (seeds, modelos e testes) em [transform/](../transform/README.md), com o dbt instalado em um venv próprio na imagem (`/opt/airflow/dbt-venv`). A pasta `transform/` é montada como volume, então editar um modelo não exige nova build. O `target/` e os logs do dbt vão para `/tmp` do container. Se um teste falhar, o dbt não roda o que depende dele e a task fica como falha.

Cadeia completa: `digisus_extraction` → `digisus_carga` → `digisus_dbt`. Uma falha em qualquer etapa se propaga para as DAGs que a esperam.

## Aviso por e-mail

Usa o provider SMTP do Airflow (já na imagem) com a conexão `smtp_default`, montada no `docker-compose.yml` a partir do `.env`: `NOTIFY_EMAIL` (quem recebe), `SMTP_HOST` (padrão `smtp.gmail.com`, porta 587 com STARTTLS), `SMTP_USER` e `SMTP_PASSWORD`. No Gmail é preciso ativar a verificação em duas etapas e criar uma **senha de app** (Conta Google > Segurança > Senhas de app), que vai em `SMTP_PASSWORD` sem espaços. Mudanças no `.env` exigem recriar os containers (`docker compose up -d`).

## Como rodar

A partir da raiz do repositório, com o `.env` preenchido (modelo em `.env.example`):
```bash
docker compose up airflow-init
docker compose up -d --build
```
A interface fica em http://localhost:8080 (usuário e senha padrão `airflow`/`airflow`, uso local). Para executar fora do agendamento, ative a DAG e use *Trigger*. Uma execução completa chama a API do DigiSUS para todos os municípios e consome cota do Databricks.

## Imagem e volumes

- O `Dockerfile` parte de `apache/airflow:3.3.0`, instala o Databricks CLI (versão fixa 1.12.0), cria um venv separado para o dbt (`dbt-core` 1.12.3 e `dbt-databricks` 1.12.5) e outro para o Meltano e copia [extraction/](../extraction/README.md) para `/opt/airflow/extraction`, onde roda `meltano install`. Por isso, mudanças em `extraction/` exigem `docker compose up -d --build`.
- O compose monta `airflow/dags`, `airflow/logs`, `airflow/config` e `airflow/plugins`, mais `extraction/output` e `transform/`. `airflow/logs` e `airflow/config/airflow.cfg` são ignorados pelo Git.
- Executor `LocalExecutor`, com Postgres 16 no próprio compose.

## Variáveis usadas

`AIRFLOW_UID`, `FERNET_KEY` e `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_CATALOG`, `DATABRICKS_SCHEMA`, `DATABRICKS_VOLUME_RAW` (o Databricks CLI lê host e token do ambiente) e `DATABRICKS_JOB_ID_CARGA`. Opcionais: `NOTIFY_EMAIL`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `_AIRFLOW_WWW_USER_*` e `AIRFLOW__API_AUTH__*`.

## Como se conecta

Executa a extração de [extraction/](../extraction/README.md), entrega os Parquet no Volume do Databricks e dispara a carga para a tabela Delta. A modelagem em [transform/](../transform/README.md) roda pela DAG `digisus_dbt`.
