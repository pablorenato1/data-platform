# export

Exporta os marts da modelagem ([transform/](../transform/README.md)) para os arquivos JSON que o site estático ([site/](../site/README.md)) lê. Só lê do Databricks e não altera nenhum valor.

## O que gera (em `site/data/`, ignorada pelo Git)

| Arquivo | Conteúdo | Origem |
|---|---|---|
| `municipios.json` | Lista de municípios, anos, cobertura e data de geração | `mart_relatorios` |
| `resumo.json` | Estado: municípios por status e indicadores por classe de alcance, por ano e relatório | `mart_relatorios` |
| `resumo_mesorregiao.json` | O mesmo resumo do estado, uma vez por mesorregião do IBGE | `mart_relatorios`, `mart_faixas_alcancado` |
| `municipios_resumo.json` | Por município, ano e relatório: situação, indicadores por classe e faixas (alimenta a aba Municípios) | `mart_relatorios`, `mart_faixas_alcancado` |
| `mapa.json` | Por ano e relatório: indicadores atingidos e total de cada município | `mart_relatorios` |
| `relatorios/<id>.json` | Os 4 relatórios de cada ano do município: status, mediana, classes e faixas de alcance | `mart_relatorios`, `mart_faixas_alcancado` |
| `metas/<id>-<ano>.json` | Diretrizes, objetivos, metas e indicadores do município no ano, com os 4 relatórios lado a lado | `mart_metas_evolucao`, `mart_completude_niveis` (texto de diretrizes e objetivos) |

Os arquivos são pequenos de propósito (o maior de metas tem cerca de 250 KB): a página de um município carrega só os dele. Com os 185 municípios, são 185 arquivos de relatórios e cerca de 1.400 de metas.

## Como rodar

Depois de um `dbt build` bem-sucedido, a partir da raiz do repositório e com o `.env` carregado:

```bash
export MSYS_NO_PATHCONV=1 MSYS2_ENV_CONV_EXCL="*"    # só no Git Bash, para o HTTP path
set -a && . ./.env && set +a
.dbt-venv/Scripts/python.exe export/exportar_site.py
```

Usa `DATABRICKS_HOST`, `DATABRICKS_HTTP_PATH`, `DBT_DATABRICKS_TOKEN` e, opcionalmente, `DATABRICKS_CATALOG`. O pacote `databricks-sql-connector` já vem com o `dbt-databricks`. Leva cerca de 40 segundos e usa o SQL Warehouse (consome a cota do Databricks de forma mínima, uma vez por execução).

A pasta nova é montada ao lado (`site/data.tmp`) e só substitui `site/data` no fim, então uma falha no meio não deixa o site com dados pela metade. No Windows, feche antes o servidor local (`python -m http.server`): com ele aberto a troca de pastas pode falhar com `PermissionError`. Se isso acontecer, `site/data.tmp` já está completa, e basta renomeá-la para `site/data`.

Fernando de Noronha (`260545`) não é exportado: a lista `EXCLUIDOS` em `exportar_site.py` o tira dos arquivos, dos totais e do filtro do site, mas ele continua nos marts do dbt. Com ele fora, o site tem 184 municípios.

## Malha dos municípios

`gerar_malha_pe.py` baixa a malha de Pernambuco do IBGE e grava `site/geo/pe-municipios.json`, com os contornos já projetados em coordenadas de SVG, sem Fernando de Noronha. Roda uma vez, não precisa do Databricks:

```bash
python export/gerar_malha_pe.py
```

## Estado atual

Os marts de origem são recriados pelo `dbt build`, e o export deve rodar depois dele. Ainda não faz parte de nenhuma DAG do Airflow.
