-- Evolução de cada meta + indicador ao longo do ano: 1º, 2º, 3º RDQA e RAG lado a lado
-- (plano, executado, alcançado e status de cada relatório). Cada RDQA vale só para o seu
-- quadrimestre e o RAG para o ano inteiro; os valores não são acumulados entre si.
-- Vem de int_metas_comparativo, sem alterar valores.
SELECT
    c.id_indicador_base
    , c.id_meta_base
    , c.id_objetivo_base
    , c.id_diretriz_base
    , c.municipio_id
    , c.municipio
    , CAST(c.nu_ano_exercicio AS INT) AS ano
    , c.diretriz_ordenacao
    , c.objetivo_ordenacao
    , c.meta_ordenacao
    , c.ds_meta
    , c.ds_indicador
    , c.tipo_valor_meta
    , c.qtd_relatorios_presentes
    , c.flag_texto_meta_diferente
    , c.flag_plano_diferente
    , c.status_1q, c.status_2q, c.status_3q, c.status_rag
    , c.vl_projetado_plano_1q, c.vl_projetado_plano_2q, c.vl_projetado_plano_3q, c.vl_projetado_plano_rag
    , c.vl_executado_1q, c.vl_executado_2q, c.vl_executado_3q, c.vl_executado_rag
    , c.vl_alcancado_1q, c.vl_alcancado_2q, c.vl_alcancado_3q, c.vl_alcancado_rag
    , c.situacao_1q, c.situacao_2q, c.situacao_3q, c.situacao_rag
    , c.qtd_relatorios_com_flag_extrema
FROM {{ ref('int_metas_comparativo') }} AS c
WHERE CAST(c.nu_ano_exercicio AS INT) >= {{ var('ano_inicial') }}
