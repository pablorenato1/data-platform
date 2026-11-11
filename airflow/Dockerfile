FROM apache/airflow:3.3.0

USER root
# O git é necessário para baixar o target-parquet do gitlab
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-venv python3.11-dev build-essential git \
    && rm -rf /var/lib/apt/lists/*

# Baixa o executável da CLI do Databricks direto dos releases oficiais
RUN curl -fL -o databricks.zip "https://github.com/databricks/cli/releases/download/v1.12.0/databricks_cli_1.12.0_linux_amd64.zip" \
    && python3 -m zipfile -e databricks.zip . \
    && mv databricks /usr/local/bin/ \
    && chmod +x /usr/local/bin/databricks \
    && rm databricks.zip \
    && databricks --version

USER airflow

# 1. Instala o Meltano globalmente E o pacote virtualenv
RUN python3.11 -m venv /opt/airflow/meltano-venv && \
    /opt/airflow/meltano-venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel && \
    /opt/airflow/meltano-venv/bin/pip install --no-cache-dir meltano virtualenv


# dbt em um venv separado, para não conflitar com as dependências do Airflow nem do Meltano.
# Versões iguais às usadas no desenvolvimento local (transform/README.md).
RUN python3.11 -m venv /opt/airflow/dbt-venv && \
    /opt/airflow/dbt-venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/airflow/dbt-venv/bin/pip install --no-cache-dir dbt-core==1.12.3 dbt-databricks==1.12.5

# Adicionar o meltano ao PATH
ENV PATH="/opt/airflow/meltano-venv/bin:$PATH"

# ====================================================================
ENV MELTANO_VENV_BACKEND=virtualenv
# ====================================================================

# 2. Copia APENAS a pasta extraction (projeto Meltano)
COPY --chown=airflow:root extraction /opt/airflow/extraction

# 3. Entra na pasta correta e roda a instalação dos plugins pelo Meltano
WORKDIR /opt/airflow/extraction
RUN meltano install