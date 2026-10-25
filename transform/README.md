# transform

Projeto dbt (`dbt-databricks`) que modela os dados brutos carregados no Databricks. **Em andamento**: hoje só existem `models/staging/stg_base_planejamento.sql` e `sources.yml`; não há modelos `intermediate` nem `marts` versionados.

**Camadas configuradas** em `dbt_project.yml`: `raw`, `staging` e `intermediate` (views) e `marts` (tables), cada uma em seu schema (`generate_schema_name` usa o nome da camada sem prefixo). O `sources.yml` aponta para o catálogo `municipio_inteligente`, schema `raw`.

**Como rodar** (a partir desta pasta, com as variáveis do `.env` exportadas no shell):
```bash
pip install dbt-databricks
dbt deps
dbt debug --profiles-dir .
dbt run --profiles-dir .
```
O `profiles.yml` lê `DATABRICKS_CATALOG`, `DATABRICKS_HOST`, `DATABRICKS_HTTP_PATH` e `DBT_DATABRICKS_TOKEN`.

**Conexões:** consome as tabelas carregadas pela extração ([extraction/](../extraction/README.md)); os marts serão a entrada do [export/](../export/README.md) (planejado). `target/`, `dbt_packages/` e `logs/` são ignorados pelo Git. Campos e regras ainda não documentados: ver [docs/](../docs/README.md).
