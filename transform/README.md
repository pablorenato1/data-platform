# transform

Projeto dbt (`dbt-databricks`) que modela os dados brutos no Databricks. **Em andamento:** há modelos `staging` e um modelo `intermediate`; não há `marts` versionados.

## Camadas

Configuradas em `dbt_project.yml`, cada uma em um schema próprio com o mesmo nome (a macro `generate_schema_name` usa o schema customizado sem prefixo). O schema `raw` guarda só a tabela de origem criada pelo notebook de carga; não há modelos dbt nele ([ADR 0006](../docs/decisions/0006-remove-camada-raw-do-dbt.md)):

| Camada | Materialização |
|---|---|
| `staging` | view |
| `intermediate` | view |
| `marts` | table |

## Modelos existentes

- **Fonte** (`models/staging/sources.yml`): catálogo `municipio_inteligente`, schema `raw`, tabela `resultados_metas`, com suas colunas. O catálogo está fixo no arquivo.
- **Documentação dos modelos:** um `.yml` por modelo em `models/staging/`, com as colunas e descrições só do que o SQL sustenta. Não há testes de dados ainda.
- **`stg_base_planejamento`:** lê `resultados_metas`, converte a coluna `diretrizes` (JSON em string) com `from_json` e a expande em níveis (diretrizes → objetivos → metas, e seguintes) com `explode_outer`. Usa `_ingested_at`, criada pelo notebook de carga.
- **`stg_diretrizes`, `stg_objetivos`, `stg_metas`, `stg_indicadores`, `stg_meta_subfuncoes`**: leem `stg_base_planejamento` e usam `dbt_utils.generate_surrogate_key` para gerar chaves. A lógica foi reconstruída a partir do SQL compilado (ver [ADR 0005](../docs/decisions/0005-modelos-reconstruidos.md)).
- **`int_metas_unidades`** (schema `intermediate`): `stg_metas` mais `tipo_valor_meta` e `tipo_valor_indicador` (seed `seeds/unidades_medida.csv`) e flags de valores muito fora do comum (`flag_alcancado_extremo`, `flag_plano_negativo`, `flag_plano_extremo`, `flag_percentual_fora_faixa`, `flag_alcancado_sem_plano`, `tem_flag_valor_extremo`). As flags só sinalizam, nenhum valor é alterado; os limites são `vars` em `dbt_project.yml`. Ver [ADR 0008](../docs/decisions/0008-unidades-de-medida-na-intermediate.md).
- **`int_metas_comparativo`** (schema `intermediate`): uma linha por meta + indicador (município, ano, `meta_ordenacao` e `ds_indicador`) com os 4 relatórios lado a lado (`_1q`, `_2q`, `_3q`, `_rag`), a quantidade de relatórios em que a meta aparece, diferenças de texto, indicador e plano, a amplitude de `vl_alcancado` e se as flags extremas são pontuais ou recorrentes. Ver [ADR 0009](../docs/decisions/0009-comparativo-entre-relatorios.md).
- **Testes:** `not_null` e `accepted_values` no tipo de valor, `unique` na sigla do seed e testes de contagem (`int_metas_unidades` tem as linhas de `stg_metas`; `int_metas_comparativo` tem uma linha por meta) e `accepted_values` em `projeto_tipo` e `situacao_preenchimento` (`dbt test`).
- **Pacote:** `dbt_utils` 1.4.1 (`packages.yml`).
- O projeto e o profile ainda se chamam `modelagem`.

## Como rodar

A partir desta pasta, com as variáveis do `.env` exportadas no shell (Git Bash: `set -a; source ../.env; set +a`):
```bash
pip install dbt-databricks
dbt deps
dbt debug --profiles-dir .
dbt seed --profiles-dir .   # carrega unidades_medida
dbt run --profiles-dir .
dbt test --profiles-dir .
```
No Git Bash do Windows, exporte também `MSYS_NO_PATHCONV=1` antes de carregar o `.env`; sem isso o `DATABRICKS_HTTP_PATH` (`/sql/1.0/...`) é reescrito para `C:/Program Files/Git/...` e o `dbt debug` falha com erro 404.
O `profiles.yml` (target `dev`, `threads: 1`) lê `DATABRICKS_HOST`, `DATABRICKS_HTTP_PATH`, `DATABRICKS_CATALOG` e `DBT_DATABRICKS_TOKEN`. `dbt run` executa SQL no seu warehouse e consome cota do Databricks. `target/`, `dbt_packages/` e `logs/` são ignorados pelo Git.

## Como se conecta

- Entrada: tabelas no schema `raw`, a partir dos Parquet entregues pela extração ([extraction/](../extraction/README.md), [airflow/](../airflow/README.md)). A carga do Volume para a tabela é feita pelo notebook em [databricks/](../databricks/README.md).
- Saída (planejada): os marts alimentarão o [export/](../export/README.md).
- Campos e regras ainda não documentados: [docs/](../docs/README.md).
