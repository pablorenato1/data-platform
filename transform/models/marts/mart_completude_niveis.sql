-- Por nível da hierarquia (diretriz, objetivo e meta), em cada relatório: taxa de preenchimento e
-- média de vl_alcancado. O nível de indicador está em fact_metas (uma meta pode ter vários indicadores).
-- Preenchida = vl_alcancado maior ou igual a zero (não nulo). Zero e nulo são respostas dos
-- responsáveis, por isso aparecem separados (taxa_zero, taxa_nulo) e não como erro.
-- media_alcancado = média simples de vl_alcancado das metas do nível, incluindo zeros e ignorando nulos.
-- Os valores não são alterados. Para filtrar por nível, use nivel e ordenacao (a numeração).
WITH metas AS (
    SELECT
        municipio_id
        , municipio
        , CAST(nu_ano_exercicio AS INT) AS ano
        , projeto_tipo
        , diretriz_ordenacao
        , objetivo_ordenacao
        , meta_ordenacao
        , max(ds_diretriz) AS ds_diretriz
        , max(ds_objetivo) AS ds_objetivo
        , max(ds_meta) AS ds_meta
        , max(situacao_preenchimento) AS situacao_preenchimento
        , max(vl_alcancado) AS vl_alcancado
        , max(tem_flag_valor_extremo) AS tem_flag_valor_extremo
    FROM {{ ref('int_metas_unidades') }}
    WHERE CAST(nu_ano_exercicio AS INT) >= {{ var('ano_inicial') }}
    GROUP BY municipio_id, municipio, CAST(nu_ano_exercicio AS INT), projeto_tipo, diretriz_ordenacao, objetivo_ordenacao, meta_ordenacao
)

, niveis AS (
    SELECT 'diretriz' AS nivel, municipio_id, municipio, ano, projeto_tipo, diretriz_ordenacao AS ordenacao, ds_diretriz AS descricao, situacao_preenchimento, vl_alcancado, tem_flag_valor_extremo FROM metas
    UNION ALL
    SELECT 'objetivo' AS nivel, municipio_id, municipio, ano, projeto_tipo, objetivo_ordenacao AS ordenacao, ds_objetivo AS descricao, situacao_preenchimento, vl_alcancado, tem_flag_valor_extremo FROM metas
    UNION ALL
    SELECT 'meta' AS nivel, municipio_id, municipio, ano, projeto_tipo, meta_ordenacao AS ordenacao, ds_meta AS descricao, situacao_preenchimento, vl_alcancado, tem_flag_valor_extremo FROM metas
)

SELECT
    nivel
    , municipio_id
    , municipio
    , ano
    , projeto_tipo
    , ordenacao
    , max(descricao) AS descricao
    , count(*) AS qtd_metas
    , sum(CASE WHEN situacao_preenchimento <> 'nulo' THEN 1 ELSE 0 END) AS qtd_metas_preenchidas
    , sum(CASE WHEN situacao_preenchimento = 'acima_de_zero' THEN 1 ELSE 0 END) AS qtd_metas_acima_de_zero
    , sum(CASE WHEN situacao_preenchimento = 'zero' THEN 1 ELSE 0 END) AS qtd_metas_zero
    , sum(CASE WHEN situacao_preenchimento = 'nulo' THEN 1 ELSE 0 END) AS qtd_metas_nulo
    , round(sum(CASE WHEN situacao_preenchimento <> 'nulo' THEN 1 ELSE 0 END) / count(*), 4) AS taxa_preenchimento
    , round(sum(CASE WHEN situacao_preenchimento = 'acima_de_zero' THEN 1 ELSE 0 END) / count(*), 4) AS taxa_acima_de_zero
    , round(sum(CASE WHEN situacao_preenchimento = 'zero' THEN 1 ELSE 0 END) / count(*), 4) AS taxa_zero
    , round(sum(CASE WHEN situacao_preenchimento = 'nulo' THEN 1 ELSE 0 END) / count(*), 4) AS taxa_nulo
    , round(avg(vl_alcancado), 2) AS media_alcancado
    , sum(CASE WHEN tem_flag_valor_extremo THEN 1 ELSE 0 END) AS qtd_metas_com_flag_extrema
FROM niveis
GROUP BY nivel, municipio_id, municipio, ano, projeto_tipo, ordenacao
