# extraction

Projeto Meltano que extrai os dados do DigiSUS. Contém o tap customizado `tap-digisus` (Meltano Singer SDK) e usa o `target-parquet` (hotgluexyz) como loader do pipeline.

## O que é extraído

- **API:** `https://digisusgmp.saude.gov.br/v1.5/api`, endpoint `/relatorio/resultados-metas`.
- **Partições:** cada município (lista em `tap-digisus/tap_digisus/data/municipios_pe.json`) × anos de 2016 até o ano corrente (calculado com `datetime`) × tipos de projeto 10 a 13. Essas faixas estão fixas em `streams.py`.
- **Carga completa:** não há chave de replicação nem estado incremental ([ADR 0001](../docs/decisions/0001-recarga-completa.md)).
- **Saída:** um stream `resultados_metas` com os campos `esfera`, `estado`, `municipio`, `projeto_tipo`, `nu_ano_exercicio`, `status`, `diretrizes` (string com JSON aninhado) e três campos de contexto (`_extract_municipio_id`, `_extract_ano`, `_extract_tipo`). Quando o município não tem projeto naquele ano/tipo, a API devolve uma string, e o tap gera um registro com `status = "sem_projeto_identificado"`.
- **Quando `TAP_DIGISUS_MUNICIPIO_ID` está definida**, o stream passa a se chamar `resultados_metas_<id>` e só aquele município é extraído. É assim que a DAG gera um arquivo por município.

## Configuração

Variáveis de ambiente (modelo no `.env.example` da raiz):

| Variável | Função |
|---|---|
| `TAP_DIGISUS_RATE_LIMIT_PER_MINUTE` | Requisições por minuto (padrão 50; a API permite 60) |
| `TAP_DIGISUS_MUNICIPIO_ID` | Restringe a um município (a DAG define a cada task) |
| `TAP_DIGISUS_RETRY_MODE` | `true` reprocessa só as falhas `retryable` do `errors.jsonl` da execução anterior; sem esse arquivo o tap falha |

Erros HTTP: 429 e 5xx entram em *retry* com *backoff* (3 tentativas: 2s, 4s, 8s); os demais 4xx são fatais. Todas as falhas são gravadas em `tap-digisus/tap_digisus/data/errors.jsonl`.

## Como rodar

**No pipeline:** pela DAG do [airflow/](../airflow/README.md), que roda `meltano run tap-digisus target-parquet` para cada município.

**Local, com Meltano:**
```bash
set -a; source .env; set +a   # o único .env fica na raiz do repositório
cd extraction
pip install -r requirements.txt
meltano install
TAP_DIGISUS_MUNICIPIO_ID=<id> meltano run tap-digisus target-parquet
```
Isso chama a API do DigiSUS; sem `TAP_DIGISUS_MUNICIPIO_ID`, todos os municípios são percorridos. O Parquet é gravado em `output/` (ignorado pelo Git).

**Tap isolado (para testes e debug):** o tap é um pacote Python com CLI própria, independente do restante do projeto:
```bash
cd extraction/tap-digisus
pip install -e .
tap-digisus --about          # lista configurações e capacidades (não chama a API)
tap-digisus --config=ENV --discover > catalog.json
```
O `tap-digisus/meltano.yml` serve para rodar o tap sozinho com o Meltano, dentro dessa pasta. Os testes do SDK estão em `tap-digisus/tests/`.

**Loader de teste (`target-jsonl`):** o lock `plugins/loaders/target-jsonl--andyh1203.lock` foi mantido para debug (saída em JSON Lines, fácil de inspecionar). Ele não está declarado no `meltano.yml`; para usá-lo, rode `meltano add loader target-jsonl` e depois `meltano run tap-digisus target-jsonl`. O pipeline usa apenas o `target-parquet`.

## Como se conecta

- Entrada: API do DigiSUS.
- Saída: arquivos Parquet que a DAG envia a um Volume do Databricks ([airflow/](../airflow/README.md)).
- O [transform/](../transform/README.md) parte de uma tabela `resultados_metas` no schema `raw`. O notebook que transforma os arquivos do Volume nessa tabela está em [databricks/](../databricks/README.md).
