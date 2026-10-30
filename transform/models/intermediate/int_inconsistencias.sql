-- Registro de inconsistências observadas nos dados informados pelos municípios.
-- Os dados NÃO são corrigidos nem removidos: este modelo só registra o que foi observado,
-- para ser exibido depois (por exemplo, no site). Uma linha por ocorrência.
-- Os textos públicos (titulo, descricao) vêm do seed tipos_inconsistencia.
WITH base AS (
    SELECT * FROM {{ ref('int_metas_unidades') }}
)

, comparativo AS (
    SELECT * FROM {{ ref('int_metas_comparativo') }}
)

, relatorios AS (
    SELECT array('1º RDQA', '2º RDQA', '3º RDQA', 'RAG') AS todos
)

-- Em quais relatórios cada meta (sem considerar indicador) aparece
, presenca_meta AS (
    SELECT
        municipio
        , nu_ano_exercicio
        , meta_ordenacao
        , array_sort(collect_set(projeto_tipo)) AS presentes
    FROM base
    GROUP BY municipio, nu_ano_exercicio, meta_ordenacao
)

-- A. Meta ausente de algum relatório
, meta_ausente AS (
    SELECT
        'meta_ausente_em_relatorio' AS codigo
        , 'meta' AS escopo
        , p.municipio, p.nu_ano_exercicio, p.meta_ordenacao
        , CAST(NULL AS STRING) AS ds_indicador
        , array_join(array_except(r.todos, p.presentes), ', ') AS relatorios_afetados
        , concat('Consta em: ', array_join(p.presentes, ', ')) AS detalhe
    FROM presenca_meta AS p
    CROSS JOIN relatorios AS r
    WHERE size(p.presentes) < 4
)

-- B. Indicador ausente de algum relatório, com a meta presente nos quatro
, indicador_ausente AS (
    SELECT
        'indicador_ausente_em_relatorio' AS codigo
        , 'indicador' AS escopo
        , c.municipio, c.nu_ano_exercicio, c.meta_ordenacao
        , c.ds_indicador
        , concat_ws(', '
            , CASE WHEN c.situacao_1q IS NULL THEN '1º RDQA' END
            , CASE WHEN c.situacao_2q IS NULL THEN '2º RDQA' END
            , CASE WHEN c.situacao_3q IS NULL THEN '3º RDQA' END
            , CASE WHEN c.situacao_rag IS NULL THEN 'RAG' END) AS relatorios_afetados
        , CAST(NULL AS STRING) AS detalhe
    FROM comparativo AS c
    INNER JOIN presenca_meta AS p
        ON c.municipio = p.municipio
        AND c.nu_ano_exercicio = p.nu_ano_exercicio
        AND c.meta_ordenacao = p.meta_ordenacao
    WHERE c.qtd_relatorios_presentes < 4 AND size(p.presentes) = 4
)

-- B2. Número de indicadores da meta diferente entre relatórios
, qtd_indicadores AS (
    SELECT
        municipio, nu_ano_exercicio, meta_ordenacao, projeto_tipo
        , count(DISTINCT coalesce(ds_indicador, '<sem indicador>')) AS n
    FROM base
    GROUP BY municipio, nu_ano_exercicio, meta_ordenacao, projeto_tipo
)

, numero_indicadores AS (
    SELECT
        'numero_indicadores_difere' AS codigo
        , 'meta' AS escopo
        , municipio, nu_ano_exercicio, meta_ordenacao
        , CAST(NULL AS STRING) AS ds_indicador
        , CAST(NULL AS STRING) AS relatorios_afetados
        , concat('Indicadores por relatório: ', array_join(sort_array(collect_list(concat(projeto_tipo, '=', n))), ' | ')) AS detalhe
    FROM qtd_indicadores
    GROUP BY municipio, nu_ano_exercicio, meta_ordenacao
    HAVING count(*) = 4 AND min(n) <> max(n)
)

-- C. Texto da meta diferente entre relatórios / D. Plano diferente entre relatórios
, por_meta AS (
    SELECT
        municipio, nu_ano_exercicio, meta_ordenacao
        , max(flag_texto_meta_diferente) AS texto_diferente
        , max(flag_plano_diferente) AS plano_diferente
        , concat_ws(' | '
            , concat('1º RDQA=', coalesce(CAST(max(vl_projetado_plano_1q) AS STRING), 'nulo'))
            , concat('2º RDQA=', coalesce(CAST(max(vl_projetado_plano_2q) AS STRING), 'nulo'))
            , concat('3º RDQA=', coalesce(CAST(max(vl_projetado_plano_3q) AS STRING), 'nulo'))
            , concat('RAG=', coalesce(CAST(max(vl_projetado_plano_rag) AS STRING), 'nulo'))) AS planos
    FROM comparativo
    GROUP BY municipio, nu_ano_exercicio, meta_ordenacao
)

, texto_diferente AS (
    SELECT
        'texto_meta_diferente' AS codigo, 'meta' AS escopo
        , municipio, nu_ano_exercicio, meta_ordenacao
        , CAST(NULL AS STRING) AS ds_indicador
        , CAST(NULL AS STRING) AS relatorios_afetados
        , CAST(NULL AS STRING) AS detalhe
    FROM por_meta
    WHERE texto_diferente
)

, plano_diferente AS (
    SELECT
        'plano_diferente' AS codigo, 'meta' AS escopo
        , municipio, nu_ano_exercicio, meta_ordenacao
        , CAST(NULL AS STRING) AS ds_indicador
        , CAST(NULL AS STRING) AS relatorios_afetados
        , concat('Planejado: ', planos) AS detalhe
    FROM por_meta
    WHERE plano_diferente
)

-- E. Valores fora do comum, por meta e relatório (as flags de int_metas_unidades)
, flags_por_meta_relatorio AS (
    SELECT
        municipio, nu_ano_exercicio, meta_ordenacao, projeto_tipo
        , max(flag_alcancado_extremo) AS alcancado_extremo
        , max(flag_plano_negativo) AS plano_negativo
        , max(flag_plano_extremo) AS plano_extremo
        , max(flag_percentual_fora_faixa) AS percentual_fora_faixa
        , max(flag_alcancado_sem_plano) AS alcancado_sem_plano
        , max(vl_alcancado) AS vl_alcancado
        , max(vl_projetado_plano) AS vl_projetado_plano
    FROM base
    GROUP BY municipio, nu_ano_exercicio, meta_ordenacao, projeto_tipo
)

, flags_longo AS (
    SELECT
        municipio, nu_ano_exercicio, meta_ordenacao, projeto_tipo, vl_alcancado, vl_projetado_plano
        , stack(5
            , 'alcancado_extremo', alcancado_extremo
            , 'plano_negativo', plano_negativo
            , 'plano_extremo', plano_extremo
            , 'percentual_fora_faixa', percentual_fora_faixa
            , 'alcancado_sem_plano', alcancado_sem_plano
        ) AS (codigo, ativo)
    FROM flags_por_meta_relatorio
)

, valores_fora_do_comum AS (
    SELECT
        codigo
        , 'meta' AS escopo
        , municipio, nu_ano_exercicio, meta_ordenacao
        , CAST(NULL AS STRING) AS ds_indicador
        , array_join(array_sort(collect_list(projeto_tipo)), ', ') AS relatorios_afetados
        , concat('Alcançado: ', array_join(sort_array(collect_list(concat(projeto_tipo, '=', coalesce(CAST(vl_alcancado AS STRING), 'nulo')))), ' | ')
            , '; planejado: ', array_join(sort_array(collect_list(concat(projeto_tipo, '=', coalesce(CAST(vl_projetado_plano AS STRING), 'nulo')))), ' | ')) AS detalhe
    FROM flags_longo
    WHERE ativo
    GROUP BY codigo, municipio, nu_ano_exercicio, meta_ordenacao
)

, todas AS (
    SELECT * FROM meta_ausente
    UNION ALL SELECT * FROM indicador_ausente
    UNION ALL SELECT * FROM numero_indicadores
    UNION ALL SELECT * FROM texto_diferente
    UNION ALL SELECT * FROM plano_diferente
    UNION ALL SELECT * FROM valores_fora_do_comum
)

SELECT
    {{ dbt_utils.generate_surrogate_key(['todas.codigo', 'todas.municipio', 'todas.nu_ano_exercicio', 'todas.meta_ordenacao', 'todas.ds_indicador']) }} AS id_inconsistencia
    , {{ dbt_utils.generate_surrogate_key(['todas.municipio', 'todas.nu_ano_exercicio', 'todas.meta_ordenacao']) }} AS id_meta_base
    , todas.codigo
    , tipos.categoria
    , tipos.titulo
    , tipos.descricao
    , todas.escopo
    , todas.municipio
    , todas.nu_ano_exercicio
    , todas.meta_ordenacao
    , todas.ds_indicador
    , todas.relatorios_afetados
    , todas.detalhe
FROM todas
LEFT JOIN {{ ref('tipos_inconsistencia') }} AS tipos ON todas.codigo = tipos.codigo
