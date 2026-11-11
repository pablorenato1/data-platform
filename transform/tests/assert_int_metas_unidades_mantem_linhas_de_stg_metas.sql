-- Falha (retorna linha) se o join com o seed multiplicar ou perder metas.
SELECT
    (SELECT count(*) FROM {{ ref('stg_metas') }}) AS linhas_stg_metas
    , (SELECT count(*) FROM {{ ref('int_metas_unidades') }}) AS linhas_int_metas_unidades
WHERE (SELECT count(*) FROM {{ ref('stg_metas') }}) <> (SELECT count(*) FROM {{ ref('int_metas_unidades') }})
