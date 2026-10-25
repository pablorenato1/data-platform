WITH source AS (
    SELECT * 
    FROM {{ ref('raw_metas_dir_obj_ini') }}
)

, diretrizes AS (
    SELECT 
        esfera
        , estado
        , municipio
        , projeto_tipo
        , nu_ano_exercicio
        , diretriz_ordenacao
        , ds_diretriz
        , _extract_municipio_id
    FROM source
)

, final AS (
    SELECT *
    FROM diretrizes
)

SELECT * FROM final