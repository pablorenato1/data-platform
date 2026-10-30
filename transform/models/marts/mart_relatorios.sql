-- Situação de cada relatório (1º, 2º, 3º RDQA e RAG) de cada município, por ano, com a taxa de
-- preenchimento das metas. Uma linha por município x ano x relatório, inclusive os casos
-- "sem projeto" e os municípios que não vieram na extração (status nulo, tem_dados_na_extracao falso).
-- O status é o original, sem alteração. Nenhum valor é alterado.
-- Preenchida = vl_alcancado maior ou igual a zero (não nulo); zero e nulo são respostas dos responsáveis.
WITH municipios AS (
    SELECT id_extracao AS municipio_id, nome AS municipio, microrregiao, mesorregiao
    FROM {{ ref('municipios_pe') }}
)

, anos AS (
    SELECT DISTINCT ano FROM {{ ref('stg_relatorios') }}
)

, tipos AS (
    SELECT * FROM VALUES
        (10, '1º RDQA', 1)
        , (11, '2º RDQA', 2)
        , (12, '3º RDQA', 3)
        , (13, 'RAG', 4)
    AS t(tipo_codigo, projeto_tipo, ordem_relatorio)
)

, espinha AS (
    SELECT m.*, a.ano, t.tipo_codigo, t.projeto_tipo, t.ordem_relatorio
    FROM municipios AS m
    CROSS JOIN anos AS a
    CROSS JOIN tipos AS t
)

-- Uma linha por meta e relatório (os indicadores da meta repetem os mesmos valores)
, metas AS (
    SELECT
        municipio_id
        , CAST(nu_ano_exercicio AS INT) AS ano
        , projeto_tipo
        , meta_ordenacao
        , max(situacao_preenchimento) AS situacao_preenchimento
        , max(vl_alcancado) AS vl_alcancado
    FROM {{ ref('int_metas_unidades') }}
    GROUP BY municipio_id, CAST(nu_ano_exercicio AS INT), projeto_tipo, meta_ordenacao
)

, completude AS (
    SELECT
        municipio_id, ano, projeto_tipo
        , count(*) AS qtd_metas
        , sum(CASE WHEN situacao_preenchimento <> 'nulo' THEN 1 ELSE 0 END) AS qtd_metas_preenchidas
        , sum(CASE WHEN situacao_preenchimento = 'acima_de_zero' THEN 1 ELSE 0 END) AS qtd_metas_acima_de_zero
        , sum(CASE WHEN situacao_preenchimento = 'zero' THEN 1 ELSE 0 END) AS qtd_metas_zero
        , sum(CASE WHEN situacao_preenchimento = 'nulo' THEN 1 ELSE 0 END) AS qtd_metas_nulo
        , round(avg(vl_alcancado), 2) AS media_alcancado
    FROM metas
    GROUP BY municipio_id, ano, projeto_tipo
)

SELECT
    e.municipio_id
    , e.municipio
    , e.microrregiao
    , e.mesorregiao
    , e.ano
    , e.projeto_tipo
    , e.ordem_relatorio
    , r.status
    , r.municipio_id IS NOT NULL AS tem_dados_na_extracao
    , coalesce(c.qtd_metas, 0) > 0 AS tem_metas
    , coalesce(c.qtd_metas, 0) AS qtd_metas
    , coalesce(c.qtd_metas_preenchidas, 0) AS qtd_metas_preenchidas
    , coalesce(c.qtd_metas_acima_de_zero, 0) AS qtd_metas_acima_de_zero
    , coalesce(c.qtd_metas_zero, 0) AS qtd_metas_zero
    , coalesce(c.qtd_metas_nulo, 0) AS qtd_metas_nulo
    , round(c.qtd_metas_preenchidas / c.qtd_metas, 4) AS taxa_preenchimento
    , round(c.qtd_metas_acima_de_zero / c.qtd_metas, 4) AS taxa_acima_de_zero
    , round(c.qtd_metas_zero / c.qtd_metas, 4) AS taxa_zero
    , round(c.qtd_metas_nulo / c.qtd_metas, 4) AS taxa_nulo
    , c.media_alcancado
FROM espinha AS e
LEFT JOIN {{ ref('stg_relatorios') }} AS r
    ON e.municipio_id = r.municipio_id AND e.ano = r.ano AND e.tipo_codigo = r.tipo_codigo
LEFT JOIN completude AS c
    ON e.municipio_id = c.municipio_id AND e.ano = c.ano AND e.projeto_tipo = c.projeto_tipo
