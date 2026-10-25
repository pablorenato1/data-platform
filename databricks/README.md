# databricks

Código que roda **dentro do Databricks**, fora do Airflow e do dbt.

## `carga_raw_resultados_metas.py`

Notebook (formato fonte do Databricks) que converte os arquivos Parquet enviados pela DAG em uma tabela Delta:

1. lê `/Volumes/municipio_inteligente/raw/raw/resultados_metas_*.parquet` (todos os municípios de uma vez, com `ignoreCorruptFiles`);
2. acrescenta `_source_file` (arquivo de origem) e `_ingested_at` (momento da carga);
3. grava `municipio_inteligente.raw.resultados_metas` em Delta com `mode("overwrite")` e `mergeSchema`, ou seja, a tabela é refeita a cada execução ([ADR 0001](../docs/decisions/0001-recarga-completa.md)).

**Como rodar:** importe o arquivo como notebook no workspace e execute depois que a DAG `digisus_extraction` terminar ([airflow/](../airflow/README.md)). A execução é manual; ainda não há job agendado versionado aqui. Catálogo, schema e Volume estão fixos no início do notebook.

**Conexões:** consome o que a extração deixa no Volume ([extraction/](../extraction/README.md)) e produz a tabela de que o [transform/](../transform/README.md) parte (`_ingested_at` é usada pelo `stg_base_planejamento`). Rodar o notebook consome cota do Databricks.
