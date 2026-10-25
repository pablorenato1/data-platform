# Databricks notebook source
# Carga: converte os .parquet do Volume na tabela Delta raw.resultados_metas.
# Executado manualmente no Databricks (fora do Airflow).

from pyspark.sql.functions import current_timestamp, col

# 1. Definição da hierarquia do Unity Catalog
catalog = "municipio_inteligente"
schema = "raw"
volume = "raw"
table_name = "resultados_metas"

# Caminho do Unity Catalog aceita o wildcard (*) para ler todos os municípios de uma vez
volume_path = f"/Volumes/{catalog}/{schema}/{volume}/resultados_metas_*.parquet"
print(f"Diretorio que obteremos os dados: {volume_path}")

# 2. Leitura consolidada dos arquivos Parquet
print(f"Lendo arquivos de: {volume_path}")
df_raw = spark.read.format("parquet") \
    .option("ignoreCorruptFiles", "true") \
    .load(volume_path)

# 3. Adição de metadados de auditoria (extremamente útil para troubleshooting futuro)
df_raw = df_raw.withColumn("_source_file", col("_metadata.file_path")) \
               .withColumn("_ingested_at", current_timestamp())

# 4. Escrita na tabela Delta
# O mergeSchema garante que se a API adicionar colunas amanhã, a tabela não quebra
df_raw.write \
    .format("delta") \
    .mode("overwrite") \
    .option("mergeSchema", "true") \
    .saveAsTable(f"{catalog}.{schema}.{table_name}")

print(f"Tabela {catalog}.{schema}.{table_name} atualizada com sucesso!")
display(spark.table(f"{catalog}.{schema}.{table_name}"))
