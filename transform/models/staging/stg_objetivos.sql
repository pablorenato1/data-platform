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
        , objetivo_ordenacao 
        , trim(ds_objetivo) as ds_objetivo
    FROM base
    WHERE ds_objetivo IS NOT NULL
)

SELECT 
    -- ID gerado pela numeração do Objetivo (ex: 1.1)
    {{ dbt_utils.generate_surrogate_key(['municipio', 'nu_ano_exercicio', 'objetivo_ordenacao']) }} AS id_objetivo
    -- Chave Estrangeira usando a numeração da Diretriz (ex: 1)
    , {{ dbt_utils.generate_surrogate_key(['municipio', 'nu_ano_exercicio', 'diretriz_ordenacao']) }} AS id_diretriz
    , municipio
    , projeto_tipo
    , nu_ano_exercicio
    , _ingested_at
    , objetivo_ordenacao
    , ds_objetivo
FROM deduplicado