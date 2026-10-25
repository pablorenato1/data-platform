# 0003. Databricks Free Edition como processamento, não como serving

**Contexto.** Os dados brutos são carregados em um Volume do Databricks Free Edition e modelados com dbt.

**Decisão.** O Databricks é usado para armazenar o dado bruto e processar a modelagem. O consumo final será por Parquet exportado dos marts e publicado em um site estático (planejado).

**Consequências.** O site não depende da cota nem da disponibilidade do Databricks. Cria a necessidade de uma etapa de exportação (`export/`, ainda não implementada).
