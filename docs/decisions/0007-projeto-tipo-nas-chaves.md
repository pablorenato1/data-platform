# 0007. `projeto_tipo` nas chaves dos modelos staging

**Contexto.** As chaves `id_*` dos modelos `stg_*` eram geradas com município, ano e numeração (`*_ordenacao`). Como cada município tem 4 tipos de relatório por ano (1º, 2º e 3º RDQA e RAG), a mesma chave aparecia cerca de 4 vezes (por exemplo, `stg_diretrizes`: 69.139 linhas para 17.288 ids distintos).

**Decisão.** Incluir `projeto_tipo` na geração de todas as chaves (`id_diretriz`, `id_objetivo`, `id_meta`, `id_indicador`) e em `stg_meta_subfuncoes`, para que a chave identifique o documento (tipo de relatório) de origem.

**Consequências.** Após a mudança, `stg_indicadores` tem chaves únicas e a colisão por tipo desapareceu nos demais. Restam poucas repetições (`stg_diretrizes`: 69.139 linhas, 69.122 ids; `stg_objetivos`: 152.527 e 152.473; `stg_metas`: 708.327 e 707.880), que vêm do dado de origem: em alguns relatórios (exemplo: IGUARACY, 2018) duas diretrizes diferentes usam a mesma numeração. `stg_meta_subfuncoes` passou a ter uma linha por tipo (antes o `DISTINCT` juntava os 4). Os modelos foram recriados no Databricks com `dbt run`.
