# Data Platform

**Um repositório open-source para construir data platforms escaláveis.**

Este projeto implementa uma plataforma de dados completa usando ferramentas open-source como dbt, Meltano, Airflow e Databricks.

---

## 📚 Sobre este Projeto

Esta é uma solução integrada para:

- **dbt** - Transformação pura de dados no Databricks
- **Meltano** - Pipeline completo com orquestração via Airflow
- **Digisus Integration** - Extração de dados DOGUS (Município Inteligente)

---

## 🛠️ Stack Tecnológico

```
Source Data → Meltano/TAPs → dbt → Databricks Warehouse
          ↓                ↓        ↓
         Airflow DAG    Transform  Parquet/JSONL
```

| Ferramenta | Propósito |
|------------|-----------|
| **dbt** | Transformação de dados no Databricks |
| **Meltano** | Orquestração + Extração de dados |
| **Airflow** | Workflows completos (rodando o Meltano como DAG) |
| **Databricks** | Data Warehouse destino final |

### Componentes Secundários

- `.venv` - Ambiente Python para projetos locais
- `.dbt-venv` - Ambiente virtual dbt-core, dbt-parquet, dbt-databricks
- `airflow` - Orquestração Airflow customizada
- `digisus-pipeline` - Integração DOGUS (Município Inteligente)

---

## 📋 Requisitos

### Pré-requisitos do Sistema

```bash
Python >= 3.9
pip >= 21.0
Databricks Workspace com credenciais configuradas
Airflow instalado localmente ou no cluster
```

### Variáveis de Ambiente Necessárias

Consulte `.env.example` para a lista completa de variáveis necessárias.

---

## 🚀 Instalação e Configuração

### 1. Criar Ambientes (Escolha uma das opções abaixo)

#### Opção A: Rodar apenas dbt

```bash
# Criar ambiente virtual do dbt-core, dbt-parquet, dbt-databricks
python -m venv .dbt-venv
source .dbt-venv/bin/activate

# Instalar dependências (dbt-core, dbt-parquet, dbt-databricks)
pip install dbt-core dbt-parquet dbt-databricks
```

#### Opção B: Rodar Meltano via Airflow

```bash
# Criar ambiente Python para projetos locais e MELTANO
python -m venv .venv
source .venv/bin/activate

# Instalar dependências
pip install requirements.txt
```

---

## 🎯 Execução do Projeto

### Opção A: Executar dbt (Transformação direta no Databricks)

1. Navegue para o diretório de transformação:
   ```bash
   cd modelagem
   ```

2. Carregue as configurações do `.env`:
   ```bash
   export $(grep -v '^#' ../.env | xargs)
   ```

3. Execute dbt com configuração local:
   ```bash
   dbt debug --profiles-dir .
   # Ou execute seus modelos
   dbt run --select your_model_name
   ```

### Opção B: Executar Meltano via Airflow DAG

1. Navegue para o diretório Airflow:
   ```bash
   cd airflow/dags
   ```

2. Carregue as configurações do `.env` (no mesmo nível ou acessível):
   ```bash
   export $(grep -v '^#' ../.env | xargs)
   ```

3. Execute o DAG com Meltano:
   ```bash
   airflow dags trigger digisus_pipeline_dag
   # Ou executa manualmente:
   airflow dags list
   airflow dags show digisus_pipeline_dag
   ```

---

## 🔧 Configuração

### Variáveis de Ambiente (`.env`)

**Core:**
```bash
AIRFLOW_UID=50000
FERNET_KEY="sua-chave-fernet-aqui"
```

**Meltano:**
```bash
TAP_DIGISUS_RATE_LIMIT_PER_MINUTE=10
TAP_DIGISUS_RETRY_MODE=false
TARGET_JSONL_DESTINATION_PATH=output/
```

**Databricks (Prod):**
```bash
DATABRICKS_HOST=dbc-xxxxx.cloud.databricks.com
DATABRICKS_TOKEN=sua-token-aqui
DBT_DATABRICKS_TOKEN=sua-tokens-e-specifico-para-dbt
DATABRICKS_CATALOG=municipio_inteligente
DATABRICKS_SCHEMA=raw
DATABRICKS_VOLUME_RAW=raw
```

---

## 📦 Conectores e Taps Disponíveis (em desenvolvimento)

### Tap Digisus - TAP_DIGISUS_RATE_LIMIT_PER_MINUTE=10

- **Conceito:** Integra com DOGUS para Dados Municipais
- **Formato de destino:** JSONL/Parquet no Databricks
- **Tabela alvo:** `municipio_inteligente.raw`

---

## 🗃️ Destino: Databricks (Data Warehouse)

A plataforma provisiona dados no data warehouse usando:

- **Volume RAW:** `raw`
- **Ingest Target:** `municipio_inteligente.raw`
- **Formato:** JSONL → Parquet via dbt
- **Warehouse Path:** `/sql/1.0/warehouses/eaf65172a5c9ad17`

---

## 🔒 Segurança

O projeto implementa seguranças críticas:

- **Chaves criptográficas.** Armazenadas no `.env` com permissões restritas
- **Segredos Meltano** no `.meltano/secret.json`
- **Logs isolados** na pasta `logs/`
- **.gitignore específico** para evitar commits de dados sensíveis

---

## 📁 Estrutura do Projeto

```
data-platform/
├── .dbt-venv/              # Ambiente virtual dbt-core, dbt-parquet, dbt-databricks
├── .venv/                  # Ambiente Python projeto local (meltano) e Airflow
├── digisus-pipeline/      # Integração DOGUS e TAPS customizados
│   └── tap-digisus/       # Conector nativo
├── airflow/                # Orquestração Airflow para workflows completos
├── modelagem/              # Transformações dbt + plugins Meltano
│   ├── meltano/            # Plugins customizados
│   └── dbt_project.yml     # Configuração do projeto dbt
├── logs/                   # Logs de execução
├── .env                    # Variáveis de ambiente (não versionar)
├── .env.example           # Template das variáveis necessárias
├── .meltano/              # Configurações Meltano
└── requirements.txt       # Dependências Python do projeto
```

---

## 📄 Licença

Open-source. Consulte o arquivo `LICENSE` para mais detalhes.
