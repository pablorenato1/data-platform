WITH base AS (
    SELECT * 
    FROM {{ ref('stg_base_planejamento') }}
)

, deduplicado AS (
    SELECT DISTINCT
        municipio
        , projeto_tipo
        , nu_ano_exercicio
        , _ingested_at
        , diretriz_ordenacao
        , trim(ds_diretriz) as ds_diretriz
    FROM base
    WHERE ds_diretriz IS NOT NULL
)

SELECT 
    -- ID gerado pela numeração da Diretriz
    {{ dbt_utils.generate_surrogate_key(['municipio', 'nu_ano_exercicio', 'diretriz_ordenacao']) }} AS id_diretriz
    , municipio
    , projeto_tipo
    , nu_ano_exercicio
    , _ingested_at
    , diretriz_ordenacao
    , ds_diretriz
FROM deduplicado