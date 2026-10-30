-- Distribuição dos indicadores por faixa de vl_alcancado, de 10 em 10 pontos, em cada relatório.
-- Níveis para filtrar: relatorio (ordenacao = 'todas'), diretriz, objetivo e meta. Em todos eles
-- a contagem e a porcentagem são de indicadores (uma linha de int_metas_unidades = uma meta + um indicador).
-- Faixas: 0 = sem valor (nulo); 1 = menos de 10%; 2 a 10 = de 10% a menos de 20% até de 90% a menos de 100%;
-- 11 = 100% ou mais. Zero entra na faixa 1 (taxa_zero, em mart_completude_niveis, mostra só o zero).
-- Só aparecem as faixas que têm indicadores; o total do nível está em qtd_indicadores_nivel.
-- Os valores não são alterados.
WITH indicadores AS (
    SELECT
        municipio_id
        , municipio
        , CAST(nu_ano_exercicio AS INT) AS ano
        , projeto_tipo
        , diretriz_ordenacao
        , objetivo_ordenacao
        , meta_ordenacao
        , ds_diretriz
        , ds_objetivo
        , ds_meta
        , CASE
            WHEN vl_alcancado IS NULL THEN 0
            WHEN vl_alcancado >= 100 THEN 11
            ELSE CAST(floor(vl_alcancado / 10) AS INT) + 1
          END AS faixa_ordem
    FROM {{ ref('int_metas_unidades') }}
    WHERE CAST(nu_ano_exercicio AS INT) >= {{ var('ano_inicial') }}
)

, niveis AS (
    SELECT 'relatorio' AS nivel, municipio_id, municipio, ano, projeto_tipo, 'todas' AS ordenacao, CAST(NULL AS STRING) AS descricao, faixa_ordem FROM indicadores
    UNION ALL
    SELECT 'diretriz' AS nivel, municipio_id, municipio, ano, projeto_tipo, diretriz_ordenacao AS ordenacao, ds_diretriz AS descricao, faixa_ordem FROM indicadores
    UNION ALL
    SELECT 'objetivo' AS nivel, municipio_id, municipio, ano, projeto_tipo, objetivo_ordenacao AS ordenacao, ds_objetivo AS descricao, faixa_ordem FROM indicadores
    UNION ALL
    SELECT 'meta' AS nivel, municipio_id, municipio, ano, projeto_tipo, meta_ordenacao AS ordenacao, ds_meta AS descricao, faixa_ordem FROM indicadores
)

, contagem AS (
    SELECT
        nivel, municipio_id, municipio, ano, projeto_tipo, ordenacao, faixa_ordem
        , max(descricao) AS descricao
        , count(*) AS qtd_indicadores
    FROM niveis
    GROUP BY nivel, municipio_id, municipio, ano, projeto_tipo, ordenacao, faixa_ordem
)

SELECT
    nivel
    , municipio_id
    , municipio
    , ano
    , projeto_tipo
    , ordenacao
    , descricao
    , faixa_ordem
    , CASE
        WHEN faixa_ordem = 0 THEN 'sem valor'
        WHEN faixa_ordem = 1 THEN 'menos de 10%'
        WHEN faixa_ordem = 11 THEN '100% ou mais'
        ELSE concat((faixa_ordem - 1) * 10, '% a menos de ', faixa_ordem * 10, '%')
      END AS faixa
    , qtd_indicadores
    , sum(qtd_indicadores) OVER (PARTITION BY nivel, municipio_id, ano, projeto_tipo, ordenacao) AS qtd_indicadores_nivel
    , round(qtd_indicadores / sum(qtd_indicadores) OVER (PARTITION BY nivel, municipio_id, ano, projeto_tipo, ordenacao), 4) AS pct_indicadores
FROM contagem
