WITH base AS (
    SELECT * 
    FROM {{ ref('stg_base_planejamento') }}
)

, metas_com_subfuncao AS (
    SELECT DISTINCT
        municipio
        , projeto_tipo
        , nu_ano_exercicio
        , meta_ordenacao
        , subfuncoes
    FROM base
    -- Filtramos para não processar metas que vieram com o array vazio
    WHERE subfuncoes IS NOT NULL 
      AND size(subfuncoes) > 0
)

, explosao_subfuncoes AS (
    SELECT 
        -- ID da Meta (Chave de ligação com a stg_metas)
        {{ dbt_utils.generate_surrogate_key(['municipio', 'projeto_tipo', 'nu_ano_exercicio', 'meta_ordenacao']) }} AS id_meta
        
        -- Extraindo os dados de dentro do array
        , sub.nu_codigo_interno AS id_subfuncao
        , TRIM(sub.no_subfuncao) AS no_subfuncao
    FROM metas_com_subfuncao
    LATERAL VIEW explode(subfuncoes) exploded_sub AS sub
)

SELECT * FROM explosao_subfuncoes