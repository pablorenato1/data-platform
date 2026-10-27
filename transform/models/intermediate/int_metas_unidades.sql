WITH metas AS (
    SELECT * FROM {{ ref('stg_metas') }}
)

, unidades AS (
    SELECT sg_unidade, tipo_valor
    FROM {{ ref('unidades_medida') }}
)

SELECT
    metas.*

    -- Tipo de valor normalizado, a partir da sigla da unidade (seed unidades_medida).
    -- O tipo do indicador fica nulo quando a unidade do indicador não existe.
    , um.tipo_valor AS tipo_valor_meta
    , ui.tipo_valor AS tipo_valor_indicador

    -- Flags: apenas sinalizam valores muito fora do comum. Nenhum valor é alterado.
    -- Os limites estão em vars no dbt_project.yml.
    , coalesce(metas.vl_alcancado > {{ var('limite_alcancado_extremo') }}, false) AS flag_alcancado_extremo
    , coalesce(metas.vl_projetado_plano < 0, false) AS flag_plano_negativo
    , coalesce(um.tipo_valor = 'quantidade' AND metas.vl_projetado_plano > {{ var('limite_plano_quantidade_extremo') }}, false) AS flag_plano_extremo
    , coalesce(um.tipo_valor IN ('percentual', 'proporcao') AND (metas.vl_projetado_plano > 100 OR metas.vl_projetado_plano < 0), false) AS flag_percentual_fora_faixa
    -- Informativa, fora de tem_flag_valor_extremo: plano zero com algum alcance.
    , coalesce(metas.vl_projetado_plano = 0 AND metas.vl_alcancado > 0, false) AS flag_alcancado_sem_plano

    -- Resumo das flags extremas (não inclui flag_alcancado_sem_plano).
    , coalesce(
        metas.vl_alcancado > {{ var('limite_alcancado_extremo') }}
        OR metas.vl_projetado_plano < 0
        OR (um.tipo_valor = 'quantidade' AND metas.vl_projetado_plano > {{ var('limite_plano_quantidade_extremo') }})
        OR (um.tipo_valor IN ('percentual', 'proporcao') AND (metas.vl_projetado_plano > 100 OR metas.vl_projetado_plano < 0))
      , false) AS tem_flag_valor_extremo

    -- Situação de preenchimento de vl_alcancado. Zero e nulo são respostas do responsável
    -- ("sem dado para esta meta"): aqui só são classificados, nunca descartados.
    , CASE
        WHEN metas.vl_alcancado IS NULL THEN 'nulo'
        WHEN metas.vl_alcancado = 0 THEN 'zero'
        ELSE 'preenchido'
      END AS situacao_preenchimento
FROM metas
LEFT JOIN unidades AS um ON metas.sg_unidade_meta = um.sg_unidade
LEFT JOIN unidades AS ui ON metas.sg_unidade_indicador = ui.sg_unidade
