-- Uma linha por meta (município + ano + numeração), com os 4 relatórios lado a lado:
-- 1º RDQA, 2º RDQA, 3º RDQA e RAG. Serve para ver se uma diferença ou uma flag é pontual
-- (aparece em um relatório) ou recorrente (aparece em mais de um).
-- Nenhum valor é alterado; quando há mais de uma linha para a mesma meta no mesmo
-- relatório (numeração repetida na origem), usa-se max() e a flag_chave_repetida avisa.
WITH metas AS (
    -- Chaves sem projeto_tipo, para casar a mesma meta entre os relatórios
    SELECT
        *
        , {{ dbt_utils.generate_surrogate_key(['municipio', 'nu_ano_exercicio', 'meta_ordenacao']) }} AS id_meta_base
        , {{ dbt_utils.generate_surrogate_key(['municipio', 'nu_ano_exercicio', 'objetivo_ordenacao']) }} AS id_objetivo_base
        , {{ dbt_utils.generate_surrogate_key(['municipio', 'nu_ano_exercicio', 'diretriz_ordenacao']) }} AS id_diretriz_base
    FROM {{ ref('int_metas_unidades') }}
)

SELECT
    id_meta_base
    , max(id_objetivo_base) AS id_objetivo_base
    , max(id_diretriz_base) AS id_diretriz_base
    , municipio
    , nu_ano_exercicio
    , max(diretriz_ordenacao) AS diretriz_ordenacao
    , max(objetivo_ordenacao) AS objetivo_ordenacao
    , meta_ordenacao
    , max(ds_meta) AS ds_meta
    , max(ds_indicador) AS ds_indicador
    , max(tipo_valor_meta) AS tipo_valor_meta

    -- Quantos relatórios têm esta meta (1 a 4) e se ela é igual entre eles
    , count(DISTINCT projeto_tipo) AS qtd_relatorios_presentes
    , count(DISTINCT ds_meta) > 1 AS flag_texto_meta_diferente
    , count(DISTINCT ds_indicador) > 1 AS flag_indicador_diferente
    , count(DISTINCT vl_projetado_plano) > 1 AS flag_plano_diferente

    -- Status do relatório do município, por relatório
    , max(CASE WHEN projeto_tipo = '1º RDQA' THEN status END) AS status_1q
    , max(CASE WHEN projeto_tipo = '2º RDQA' THEN status END) AS status_2q
    , max(CASE WHEN projeto_tipo = '3º RDQA' THEN status END) AS status_3q
    , max(CASE WHEN projeto_tipo = 'RAG' THEN status END) AS status_rag

    -- Plano, executado e alcançado por relatório
    , max(CASE WHEN projeto_tipo = '1º RDQA' THEN vl_projetado_plano END) AS vl_projetado_plano_1q
    , max(CASE WHEN projeto_tipo = '2º RDQA' THEN vl_projetado_plano END) AS vl_projetado_plano_2q
    , max(CASE WHEN projeto_tipo = '3º RDQA' THEN vl_projetado_plano END) AS vl_projetado_plano_3q
    , max(CASE WHEN projeto_tipo = 'RAG' THEN vl_projetado_plano END) AS vl_projetado_plano_rag

    , max(CASE WHEN projeto_tipo = '1º RDQA' THEN vl_executado_relatorio END) AS vl_executado_1q
    , max(CASE WHEN projeto_tipo = '2º RDQA' THEN vl_executado_relatorio END) AS vl_executado_2q
    , max(CASE WHEN projeto_tipo = '3º RDQA' THEN vl_executado_relatorio END) AS vl_executado_3q
    , max(CASE WHEN projeto_tipo = 'RAG' THEN vl_executado_relatorio END) AS vl_executado_rag

    , max(CASE WHEN projeto_tipo = '1º RDQA' THEN vl_alcancado END) AS vl_alcancado_1q
    , max(CASE WHEN projeto_tipo = '2º RDQA' THEN vl_alcancado END) AS vl_alcancado_2q
    , max(CASE WHEN projeto_tipo = '3º RDQA' THEN vl_alcancado END) AS vl_alcancado_3q
    , max(CASE WHEN projeto_tipo = 'RAG' THEN vl_alcancado END) AS vl_alcancado_rag

    -- Situação do preenchimento de vl_alcancado por relatório (nulo, zero ou preenchido)
    , max(CASE WHEN projeto_tipo = '1º RDQA' THEN situacao_preenchimento END) AS situacao_1q
    , max(CASE WHEN projeto_tipo = '2º RDQA' THEN situacao_preenchimento END) AS situacao_2q
    , max(CASE WHEN projeto_tipo = '3º RDQA' THEN situacao_preenchimento END) AS situacao_3q
    , max(CASE WHEN projeto_tipo = 'RAG' THEN situacao_preenchimento END) AS situacao_rag

    -- Diferença de vl_alcancado entre os relatórios (ignora nulos)
    , min(vl_alcancado) AS vl_alcancado_min
    , max(vl_alcancado) AS vl_alcancado_max
    , max(vl_alcancado) - min(vl_alcancado) AS vl_alcancado_amplitude
    , count(DISTINCT vl_alcancado) > 1 AS flag_alcancado_varia_entre_relatorios

    -- Flags extremas: em quantos relatórios a meta está sinalizada (0 a 4)
    , count(DISTINCT CASE WHEN tem_flag_valor_extremo THEN projeto_tipo END) AS qtd_relatorios_com_flag_extrema
    , count(DISTINCT CASE WHEN tem_flag_valor_extremo THEN projeto_tipo END) = 1 AS flag_extrema_pontual
    , count(DISTINCT CASE WHEN tem_flag_valor_extremo THEN projeto_tipo END) >= 2 AS flag_extrema_recorrente

    -- Aviso: mais de uma linha da mesma meta no mesmo relatório (numeração repetida na origem)
    , count(*) > count(DISTINCT projeto_tipo) AS flag_chave_repetida
FROM metas
GROUP BY id_meta_base, municipio, nu_ano_exercicio, meta_ordenacao
