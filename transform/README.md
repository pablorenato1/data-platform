# transform

Projeto dbt (`dbt-databricks`) que modela os dados brutos no Databricks. **Em andamento:** há modelos `staging`, `intermediate` e `marts`; falta o export para Parquet.

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
- **`int_inconsistencias`** (schema `intermediate`): registro das inconsistências observadas, uma linha por ocorrência (tipos: meta ou indicador ausente em algum relatório, número de indicadores, texto ou plano diferentes, e valores fora do comum). **Não altera nenhum dado**; os textos públicos ficam no seed `tipos_inconsistencia`. Ver [ADR 0010](../docs/decisions/0010-registro-de-inconsistencias.md).
- **`stg_relatorios`:** um relatório por município, ano e tipo, com o status original, incluindo os casos sem projeto. Ignora anos antes de `var('ano_inicial')` (2018; 2016 e 2017 não têm dados).
- **Marts** (schema `marts`, tabelas; [ADR 0011](../docs/decisions/0011-marts-status-e-ano-inicial.md)): `mart_relatorios` (status original de cada relatório por município e ano, com taxas de preenchimento e os municípios sem dados na extração), `fact_metas` (meta + indicador por relatório, com diretriz, objetivo, meta, indicador e seus textos), `fact_inconsistencias` (o registro com o município) e `mart_completude_niveis` (diretriz, objetivo e meta, com taxas e `media_alcancado`). Nenhum valor é alterado.
- **Como filtrar por nível:** em `mart_completude_niveis`, `nivel` (`diretriz`, `objetivo` ou `meta`) e `ordenacao` (a numeração, como `1`, `1.1` ou `1.1.1`), sempre junto de `municipio_id` e `ano`, porque a numeração se repete entre municípios e anos. Para indicadores e para ver cada relatório, use `fact_metas` (`diretriz_ordenacao`, `objetivo_ordenacao`, `meta_ordenacao`, `ds_indicador`). Para acompanhar o mesmo item entre os relatórios, use as chaves `id_diretriz_base`, `id_objetivo_base`, `id_meta_base` e `id_indicador_base`.
- **Preenchimento:** meta preenchida é a que tem `vl_alcancado` maior ou igual a zero; `taxa_zero` e `taxa_nulo` mostram as respostas zero e nulo separadamente.
- **Seeds:** `unidades_medida`, `tipos_inconsistencia` e `municipios_pe` (mesma lista do tap). O `status` não é agrupado: usa-se o original.
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
O `profiles.yml` (target `dev`, `threads: 1`) lê `DATABRICKS_HOST`, `DATABRICKS_HTTP_PATH`, `DATABRICKS_CATALOG` e `DBT_DATABRICKS_TOKEN`. `dbt run` executa SQL no warehouse configurado e consome cota do Databricks. `target/`, `dbt_packages/` e `logs/` são ignorados pelo Git.

## A cada nova ingestão

A modelagem é totalmente derivada da tabela `raw.resultados_metas`, sem etapa manual. Depois de rodar o DAG e o notebook de [databricks/](../databricks/README.md), basta um comando, a partir desta pasta e com o `.env` carregado:
```bash
dbt build --profiles-dir .      # seeds, modelos e testes, na ordem das dependências
```
O resultado é determinístico: sobre os mesmos dados, o registro de inconsistências sai igual. Os testes não usam números fixos. Se a API trouxer um relatório, uma unidade ou um tipo novos, os testes falham de propósito: acrescente a linha correspondente em `seeds/unidades_medida.csv` ou `seeds/tipos_inconsistencia.csv` (os limites das flags estão em `vars`, em `dbt_project.yml`). Ainda não há execução automática do dbt no Airflow.

## Como se conecta

- Entrada: tabelas no schema `raw`, a partir dos Parquet entregues pela extração ([extraction/](../extraction/README.md), [airflow/](../airflow/README.md)). A carga do Volume para a tabela é feita pelo notebook em [databricks/](../databricks/README.md).
- Saída (planejada): os marts alimentarão o [export/](../export/README.md) e o site.
- Campos e regras ainda não documentados: [docs/](../docs/README.md).
