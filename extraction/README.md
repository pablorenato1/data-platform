# extraction

Projeto Meltano com o tap customizado `tap-digisus` (Meltano Singer SDK) e o loader `target-parquet` (hotgluexyz).

**O que extrai:** o endpoint `/relatorio/resultados-metas` da API do DigiSUS (`https://digisusgmp.saude.gov.br/v1.5/api`), para cada município (lista em `tap-digisus/tap_digisus/data/municipios_pe.json`), anos 2016 a 2025 e tipos de projeto 10 a 13. A carga é completa a cada execução (sem estado incremental). O campo `diretrizes` vem como string JSON aninhada.

**Configuração (variáveis de ambiente):**
- `TAP_DIGISUS_RATE_LIMIT_PER_MINUTE`: padrão 50 (a API permite 60/min)
- `TAP_DIGISUS_MUNICIPIO_ID`: restringe a um município (a DAG define por task)
- `TAP_DIGISUS_RETRY_MODE`: `true` reprocessa só as falhas registradas em `errors.jsonl` da execução anterior

**Como rodar:** normalmente via Airflow. Local: `pip install -r requirements.txt`, `meltano install` e `meltano run tap-digisus target-parquet`. Isso chama a API do DigiSUS; use `TAP_DIGISUS_MUNICIPIO_ID` para testar com um município.

**Conexões:** o Dockerfile do [airflow/](../airflow/README.md) copia esta pasta; a DAG envia o Parquet gerado ao Databricks, e o [transform/](../transform/README.md) lê a tabela `resultados_metas` carregada a partir dele. Testes do tap em `tap-digisus/tests/`.
