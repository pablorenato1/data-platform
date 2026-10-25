# Databricks notebook source
# Carga: converte os .parquet do Volume na tabela Delta raw.resultados_metas.
# Executado manualmente no Databricks (fora do Airflow).

from pyspark.sql.functions import current_timestamp, col

# 1. Definição da hierarquia do Unity Catalog
catalog = "municipio_inteligente"
schema = "raw"
volume = "raw"
table_name = "resultados_metas"

# Um Parquet válido tem bem mais que isso; os arquivos "vazios" gerados quando
# a extração falha têm 4 bytes.
MIN_BYTES = 512
# Municípios de PE no municipios_pe.json do tap
MUNICIPIOS_ESPERADOS = 185

volume_dir = f"/Volumes/{catalog}/{schema}/{volume}"
print(f"Diretorio que obteremos os dados: {volume_dir}")

# 2. Lista os arquivos e separa os inválidos (listados, mas a carga continua)
arquivos = [
    f for f in dbutils.fs.ls(volume_dir)
    if f.name.startswith("resultados_metas_") and f.name.endswith(".parquet")
]
invalidos = [f for f in arquivos if f.size < MIN_BYTES]
validos = [f for f in arquivos if f.size >= MIN_BYTES]

print(f"{len(arquivos)} arquivos encontrados: {len(validos)} válidos, {len(invalidos)} ignorados")
if invalidos:
    print(f"⚠️ ARQUIVOS IGNORADOS (menores que {MIN_BYTES} bytes). Reprocesse a extração destes municípios:")
    for f in invalidos:
        print(f"   - {f.name} ({f.size} bytes)")
if not validos:
    raise Exception("Nenhum arquivo válido encontrado no Volume; a tabela não foi alterada.")

# 3. Leitura consolidada dos arquivos válidos
# ignoreCorruptFiles continua ligado para que um arquivo ilegível não derrube a carga;
# a conferência no final aponta quais municípios ficaram sem dados.
df_raw = spark.read.format("parquet") \
    .option("ignoreCorruptFiles", "true") \
    .load([f.path for f in validos])

# 4. Adição de metadados de auditoria (extremamente útil para troubleshooting futuro)
df_raw = df_raw.withColumn("_source_file", col("_metadata.file_path")) \
               .withColumn("_ingested_at", current_timestamp())

# 5. Escrita na tabela Delta
# O mergeSchema garante que se a API adicionar colunas amanhã, a tabela não quebra
df_raw.write \
    .format("delta") \
    .mode("overwrite") \
    .option("mergeSchema", "true") \
    .saveAsTable(f"{catalog}.{schema}.{table_name}")

print(f"Tabela {catalog}.{schema}.{table_name} atualizada com sucesso!")

# 6. Conferência: municípios carregados x esperados
tabela = spark.table(f"{catalog}.{schema}.{table_name}")
carregados = {r[0] for r in tabela.select("_extract_municipio_id").distinct().collect()}
ids_arquivo = lambda lista: {f.name.replace("resultados_metas_", "").replace(".parquet", "") for f in lista}
sem_linhas = sorted(ids_arquivo(validos) - carregados)  # arquivo existe, mas nenhum registro entrou

print(f"\nMunicípios carregados: {len(carregados)} de {MUNICIPIOS_ESPERADOS} esperados")
if len(carregados) < MUNICIPIOS_ESPERADOS:
    print("⚠️ Carga INCOMPLETA. A tabela foi sobrescrita sem estes municípios:")
    print(f"   arquivos pequenos ignorados: {sorted(ids_arquivo(invalidos))}")
    print(f"   arquivos válidos sem nenhum registro (ilegíveis?): {sem_linhas}")
    print(f"   sem arquivo no Volume: {MUNICIPIOS_ESPERADOS - len(ids_arquivo(arquivos))}")

display(tabela)
