# transform

Projeto dbt (`dbt-databricks`) que modela os dados brutos no Databricks. **Em andamento:** há modelos `raw` e `staging`; não há modelos `intermediate` nem `marts` versionados.

## Camadas

Configuradas em `dbt_project.yml`, cada uma em um schema próprio com o mesmo nome (a macro `generate_schema_name` usa o schema customizado sem prefixo):

| Camada | Materialização |
|---|---|
| `raw` | view |
| `staging` | view |
| `intermediate` | view |
| `marts` | table |

## Modelos existentes

- **Fonte** (`sources.yml`): catálogo `municipio_inteligente`, schema `raw`, tabelas `resultados_metas` e `raw_metas_dir_obj_ini`. O catálogo está fixo no arquivo.
- **`stg_base_planejamento`:** lê `resultados_metas`, converte a coluna `diretrizes` (JSON em string) com `from_json` e a expande em níveis (diretrizes → objetivos → metas, e seguintes) com `explode_outer`. Usa `_ingested_at`, criada pelo notebook de carga.
- **`raw_metas_dir_obj_ini`** e **`raw_diretrizes`** (schema `raw`): a primeira também expande `diretrizes`, mas declara `nu_ano_linha_base` e `nu_linha_base` como `INT` (o staging usa `STRING`) e tem menos colunas que o `stg_base_planejamento`; parece uma versão anterior. A segunda seleciona colunas de diretriz a partir dela. Falta confirmar se ambas continuam necessárias.
- **`stg_diretrizes`, `stg_objetivos`, `stg_metas`, `stg_indicadores`, `stg_meta_subfuncoes`** (schema `staging`): leem `stg_base_planejamento` e usam `dbt_utils.generate_surrogate_key` para gerar chaves. A lógica foi reconstruída a partir do SQL compilado (ver [ADR 0005](../docs/decisions/0005-modelos-reconstruidos.md)).
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

- Entrada: tabelas no schema `raw`, a partir dos Parquet entregues pela extração ([extraction/](../extraction/README.md), [airflow/](../airflow/README.md)). A carga do Volume para a tabela é feita pelo notebook em [databricks/](../databricks/README.md).
- Saída (planejada): os marts alimentarão o [export/](../export/README.md).
- Campos e regras ainda não documentados: [docs/](../docs/README.md).
