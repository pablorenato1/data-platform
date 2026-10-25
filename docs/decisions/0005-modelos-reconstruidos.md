# 0005. Modelos raw/staging reconstruídos a partir do SQL compilado

**Contexto.** Os fontes dbt (com `source()`, `ref()` e `dbt_utils`) de `raw_metas_dir_obj_ini`, `raw_diretrizes` e dos cinco modelos `stg_*` além do `stg_base_planejamento` não estavam no Git. Só existia o SQL compilado em `target/compiled`.

**Decisão.** Reconstruir os fontes trocando apenas as referências compiladas por `{{ source() }}` e `{{ ref() }}`, e as expressões `md5(cast(concat(coalesce(...)))...)` por `{{ dbt_utils.generate_surrogate_key([...]) }}` (cada expansão foi conferida automaticamente). A lógica SQL não foi alterada. O mesmo método reproduziu exatamente o `stg_base_planejamento` já versionado.

**Consequências.** `dbt parse` passa, e o grafo de dependências e os schemas batem com o compilado original. Comentários em Jinja e `config()` que existissem nos fontes originais não puderam ser recuperados. `dbt run` ainda não foi executado sobre esses modelos.
