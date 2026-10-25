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
        , meta_ordenacao
        , TRIM(ds_indicador) AS ds_indicador
        , sg_unidade_indicador
        , no_unidade_indicador
        -- Tratamento seguro: converte o texto para DOUBLE. O que for inválido vira NULL.
        , TRY_CAST(nu_linha_base AS DOUBLE) AS nu_linha_base
    FROM base
    WHERE ds_indicador IS NOT NULL
)

SELECT 
    {{ dbt_utils.generate_surrogate_key(['municipio', 'projeto_tipo', 'nu_ano_exercicio', 'meta_ordenacao', 'ds_indicador']) }} AS id_indicador
    , {{ dbt_utils.generate_surrogate_key(['municipio', 'projeto_tipo', 'nu_ano_exercicio', 'meta_ordenacao']) }} AS id_meta
    , municipio
    , projeto_tipo
    , nu_ano_exercicio
    , _ingested_at
    , ds_indicador
    , sg_unidade_indicador
    , no_unidade_indicador
    , nu_linha_base
FROM deduplicado