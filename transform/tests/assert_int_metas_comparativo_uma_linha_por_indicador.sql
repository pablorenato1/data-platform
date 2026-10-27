-- Falha (retorna linha) se int_metas_comparativo não tiver exatamente uma linha por
-- (município, ano, meta_ordenacao, ds_indicador) de int_metas_unidades.
SELECT
    (SELECT count(*) FROM {{ ref('int_metas_comparativo') }}) AS linhas_comparativo
    , (SELECT count(*) FROM (SELECT DISTINCT municipio, nu_ano_exercicio, meta_ordenacao, ds_indicador FROM {{ ref('int_metas_unidades') }})) AS chaves_distintas
WHERE (SELECT count(*) FROM {{ ref('int_metas_comparativo') }})
   <> (SELECT count(*) FROM (SELECT DISTINCT municipio, nu_ano_exercicio, meta_ordenacao, ds_indicador FROM {{ ref('int_metas_unidades') }}))
