WITH source AS (
    SELECT * 
    FROM {{ source('databricks_raw', 'resultados_metas') }}
)

, parsed_json AS (
    SELECT
        esfera
        , estado
        , municipio
        , projeto_tipo
        , nu_ano_exercicio
        , _extract_municipio_id
        , _extract_ano
        , _ingested_at
        , from_json(diretrizes, 'ARRAY<STRUCT<
            ds_diretriz: STRING,
            nu_ordenacao: STRING,
            objetivos: ARRAY<STRUCT<
                ds_objetivo: STRING,
                nu_ordenacao: STRING,
                metas: ARRAY<STRUCT<
                    ds_meta: STRING,
                    nu_ordenacao: STRING,
                    ds_indicador: STRING,
                    sg_unidade_meta: STRING,
                    no_unidade_meta: STRING,
                    sg_unidade_indicador: STRING,
                    no_unidade_indicador: STRING,
                    nu_ano_linha_base: STRING,
                    nu_linha_base: STRING,
                    vl_projetado_plano: DOUBLE,
                    vl_projetado_pas: DOUBLE,
                    st_valor_apuravel: BOOLEAN,
                    vl_executado_relatorio: DOUBLE,
                    vl_alcancado: DOUBLE,
                    iniciativas: ARRAY<STRUCT<ds_iniciativa: STRING>>,
                    subfuncoes: ARRAY<STRUCT<nu_codigo_interno: STRING, no_subfuncao: STRING>>
                >>
            >>
        >>') AS diretrizes_array
    FROM source
    WHERE diretrizes IS NOT NULL
)

-- 2. Explodir a camada de Diretrizes
, explode_diretrizes AS (
    SELECT
        esfera
        , estado
        , municipio
        , projeto_tipo
        , nu_ano_exercicio
        , _extract_municipio_id
        , _ingested_at
        , dir.ds_diretriz
        , dir.nu_ordenacao AS diretriz_ordenacao
        , dir.objetivos AS objetivos_array
    FROM parsed_json
    LATERAL VIEW explode_outer(diretrizes_array) exploded_dir AS dir
)

-- 3. Explodir a camada de Objetivos
, explode_objetivos AS (
    SELECT
        esfera
        , estado
        , municipio
        , projeto_tipo
        , nu_ano_exercicio
        , _extract_municipio_id
        , _ingested_at
        , ds_diretriz
        , diretriz_ordenacao
        , obj.ds_objetivo
        , obj.nu_ordenacao AS objetivo_ordenacao
        , obj.metas AS metas_array
    FROM explode_diretrizes
    LATERAL VIEW explode_outer(objetivos_array) exploded_obj AS obj
)

-- 4. Explodir a camada de Metas
, explode_metas AS (
    SELECT
        esfera
        , estado
        , municipio
        , projeto_tipo
        , nu_ano_exercicio
        , _extract_municipio_id
        , _ingested_at
        , ds_diretriz
        , diretriz_ordenacao
        , ds_objetivo
        , objetivo_ordenacao
        , meta.ds_meta
        , meta.nu_ordenacao AS meta_ordenacao
        , meta.ds_indicador
        , meta.sg_unidade_meta
        , meta.no_unidade_meta
        , meta.sg_unidade_indicador
        , meta.no_unidade_indicador
        , meta.nu_linha_base
        , meta.vl_projetado_plano
        , meta.vl_alcancado
        , meta.iniciativas 
        , meta.subfuncoes
    FROM explode_objetivos
    LATERAL VIEW explode_outer(metas_array) exploded_meta AS meta
)

-- 5. Explodir a camada de Iniciativas
, explode_iniciativas AS (
    SELECT
        esfera
        , estado
        , municipio
        , projeto_tipo
        , nu_ano_exercicio
        , _extract_municipio_id
        , _ingested_at
        , ds_diretriz
        , diretriz_ordenacao
        , ds_objetivo
        , objetivo_ordenacao
        , ds_meta
        , meta_ordenacao
        , ds_indicador
        , sg_unidade_meta
        , sg_unidade_indicador
        , no_unidade_indicador
        , nu_linha_base
        , no_unidade_meta
        , vl_projetado_plano
        , vl_alcancado
        , ini.ds_iniciativa
        , subfuncoes
    FROM explode_metas
    LATERAL VIEW explode_outer(iniciativas) exploded_ini AS ini
)

SELECT * FROM explode_iniciativas