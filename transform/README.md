# transform

Projeto dbt (`dbt-databricks`) que modela os dados brutos no Databricks. **Em andamento:** hoje só existem `models/staging/stg_base_planejamento.sql` e `models/staging/sources.yml`. Não há modelos `intermediate` nem `marts` versionados.

## Camadas

Configuradas em `dbt_project.yml`, cada uma em um schema próprio com o mesmo nome (a macro `generate_schema_name` usa o schema customizado sem prefixo):

| Camada | Materialização |
|---|---|
| `raw` | view |
| `staging` | view |
| `intermediate` | view |
| `marts` | table |

## Fonte e modelo existentes

- **Fonte** (`sources.yml`): catálogo `municipio_inteligente`, schema `raw`, tabelas `resultados_metas` e `raw_metas_dir_obj_ini`. O catálogo está fixo no arquivo.
- **`stg_base_planejamento`:** lê `resultados_metas`, converte a coluna `diretrizes` (JSON em string) com `from_json` e a expande em níveis (diretrizes → objetivos → metas, e seguintes) com `explode_outer`. O modelo usa a coluna `_ingested_at`, que o tap não gera; ela precisa existir na tabela raw.
- **Pacote:** `dbt_utils` 1.4.1 (`packages.yml`).
- O projeto e o profile ainda se chamam `modelagem`.

## Como rodar

A partir desta pasta, com as variáveis do `.env` exportadas no shell (Git Bash: `set -a; source ../.env; set +a`):
```bash
pip install dbt-databricks
dbt deps
dbt debug --profiles-dir .
dbt run --profiles-dir .
```
O `profiles.yml` (target `dev`, `threads: 1`) lê `DATABRICKS_HOST`, `DATABRICKS_HTTP_PATH`, `DATABRICKS_CATALOG` e `DBT_DATABRICKS_TOKEN`. `dbt run` executa SQL no seu warehouse e consome cota do Databricks. `target/`, `dbt_packages/` e `logs/` são ignorados pelo Git.

## Como se conecta

- Entrada: tabelas no schema `raw`, a partir dos Parquet entregues pela extração ([extraction/](../extraction/README.md), [airflow/](../airflow/README.md)). A carga do Volume para a tabela **não está neste repositório**.
- Saída (planejada): os marts alimentarão o [export/](../export/README.md).
- Campos e regras ainda não documentados: [docs/](../docs/README.md).
