-- Um relatório por município, ano e tipo (1º, 2º, 3º RDQA e RAG), com o status original.
-- Inclui os casos "sem projeto", que não aparecem em stg_base_planejamento.
-- Anos anteriores a var('ano_inicial') são ignorados (não têm dados).
SELECT
    _extract_municipio_id AS municipio_id
    , _extract_ano AS ano
    , _extract_tipo AS tipo_codigo
    , CASE _extract_tipo
        WHEN 10 THEN '1º RDQA'
        WHEN 11 THEN '2º RDQA'
        WHEN 12 THEN '3º RDQA'
        WHEN 13 THEN 'RAG'
      END AS projeto_tipo
    , status
    , _ingested_at
FROM {{ source('databricks_raw', 'resultados_metas') }}
WHERE _extract_ano >= {{ var('ano_inicial') }}
