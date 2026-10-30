-- Falha (retorna linha) se fact_metas perder ou duplicar linhas de int_metas_unidades
-- (considerando só os anos a partir de var ano_inicial).
SELECT
    (SELECT count(*) FROM {{ ref('fact_metas') }}) AS linhas_fact
    , (SELECT count(*) FROM {{ ref('int_metas_unidades') }} WHERE CAST(nu_ano_exercicio AS INT) >= {{ var('ano_inicial') }}) AS linhas_origem
WHERE (SELECT count(*) FROM {{ ref('fact_metas') }})
   <> (SELECT count(*) FROM {{ ref('int_metas_unidades') }} WHERE CAST(nu_ano_exercicio AS INT) >= {{ var('ano_inicial') }})
