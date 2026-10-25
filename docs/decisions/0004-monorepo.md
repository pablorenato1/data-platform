# 0004. Monorepo

**Contexto.** Extração, orquestração, modelagem, exportação e site fazem parte do mesmo pipeline.

**Decisão.** Todo o código fica em um único repositório, com uma pasta por etapa.

**Consequências.** Mudanças que cruzam etapas (por exemplo, caminhos usados pelo Dockerfile e pela DAG) entram em um único commit. O build do Airflow usa a raiz do repositório como contexto.
