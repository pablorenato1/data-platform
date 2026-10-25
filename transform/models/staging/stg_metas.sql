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
        , meta_ordenacao
        , trim(ds_meta) as ds_meta
        , sg_unidade_meta
        , no_unidade_meta
        , vl_projetado_plano
        , vl_alcancado
        
        -- ADICIONADO: Puxando os dados do indicador direto para a Meta
        , TRIM(ds_indicador) AS ds_indicador
        , sg_unidade_indicador
        , no_unidade_indicador
        , TRY_CAST(nu_linha_base AS DOUBLE) AS nu_linha_base

    FROM base
    WHERE ds_meta IS NOT NULL
)

SELECT 
    {{ dbt_utils.generate_surrogate_key(['municipio', 'nu_ano_exercicio', 'meta_ordenacao']) }} AS id_meta
    , {{ dbt_utils.generate_surrogate_key(['municipio', 'nu_ano_exercicio', 'objetivo_ordenacao']) }} AS id_objetivo
    , {{ dbt_utils.generate_surrogate_key(['municipio', 'nu_ano_exercicio', 'diretriz_ordenacao']) }} AS id_diretriz
    
    , municipio
    , projeto_tipo
    , nu_ano_exercicio
    , _ingested_at
    , meta_ordenacao
    , ds_meta
    , sg_unidade_meta
    , no_unidade_meta
    , vl_projetado_plano
    , vl_alcancado
    
    -- ADICIONADO: Passando os dados do indicador para a frente
    , ds_indicador
    , sg_unidade_indicador
    , no_unidade_indicador
    , nu_linha_base

FROM deduplicado