# 0006. Remoção da camada raw do dbt

**Contexto.** Havia duas cadeias a partir de `raw.resultados_metas`: `raw_metas_dir_obj_ini` → `raw_diretrizes` (schema `raw`) e `stg_base_planejamento` → modelos `stg_*` (schema `staging`). O primeiro expandia o mesmo JSON com menos colunas e tipos diferentes (`INT` onde o staging usa `STRING`), e o schema `raw` misturava a tabela de origem com views do dbt.

**Decisão.** Manter apenas a cadeia a partir de `stg_base_planejamento`. Os modelos `raw_metas_dir_obj_ini` e `raw_diretrizes` foram removidos, junto com a tabela homônima do `sources.yml` e a configuração `raw` do `dbt_project.yml`.

**Consequências.** Há uma única cadeia de transformação e o schema `raw` volta a guardar só a tabela de origem. Qualquer consulta que usasse essas duas views deixa de funcionar. As colunas `esfera`, `estado` e `_extract_municipio_id` estavam em `raw_diretrizes` e não estão em `stg_diretrizes`.
