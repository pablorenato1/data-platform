-- Uma linha por meta + indicador + relatório, com a hierarquia (diretriz, objetivo, meta, indicador),
-- valores, tipo de valor, status original do relatório, situação de preenchimento e flags. Nenhum valor é alterado; o texto de cada relatório é mantido
-- como foi preenchido (use meta_ordenacao para acompanhar a mesma meta entre relatórios).
SELECT
    u.municipio_id
    , u.municipio
    , CAST(u.nu_ano_exercicio AS INT) AS ano
    , u.projeto_tipo
    , u.status
    , {{ dbt_utils.generate_surrogate_key(['u.municipio', 'u.nu_ano_exercicio', 'u.meta_ordenacao', 'u.ds_indicador']) }} AS id_indicador_base
    , {{ dbt_utils.generate_surrogate_key(['u.municipio', 'u.nu_ano_exercicio', 'u.meta_ordenacao']) }} AS id_meta_base
    , {{ dbt_utils.generate_surrogate_key(['u.municipio', 'u.nu_ano_exercicio', 'u.objetivo_ordenacao']) }} AS id_objetivo_base
    , {{ dbt_utils.generate_surrogate_key(['u.municipio', 'u.nu_ano_exercicio', 'u.diretriz_ordenacao']) }} AS id_diretriz_base
    , u.diretriz_ordenacao
    , u.ds_diretriz
    , u.objetivo_ordenacao
    , u.ds_objetivo
    , u.meta_ordenacao
    , u.ds_meta
    , u.ds_indicador
    , u.sg_unidade_meta
    , u.no_unidade_meta
    , u.tipo_valor_meta
    , u.sg_unidade_indicador
    , u.no_unidade_indicador
    , u.tipo_valor_indicador
    , u.nu_linha_base
    , u.vl_projetado_plano
    , u.vl_projetado_pas
    , u.vl_executado_relatorio
    , u.vl_alcancado
    , u.situacao_preenchimento
    , u.flag_alcancado_extremo
    , u.flag_plano_negativo
    , u.flag_plano_extremo
    , u.flag_percentual_fora_faixa
    , u.flag_alcancado_sem_plano
    , u.tem_flag_valor_extremo
    , u._ingested_at
FROM {{ ref('int_metas_unidades') }} AS u
WHERE CAST(u.nu_ano_exercicio AS INT) >= {{ var('ano_inicial') }}
