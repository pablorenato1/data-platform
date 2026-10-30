-- Falha (retorna linha) se mart_relatorios não tiver uma linha para cada combinação de
-- município (seed), ano (de stg_relatorios) e os 4 tipos de relatório.
SELECT
    (SELECT count(*) FROM {{ ref('mart_relatorios') }}) AS linhas_mart
    , (SELECT count(*) FROM {{ ref('municipios_pe') }})
      * (SELECT count(DISTINCT ano) FROM {{ ref('stg_relatorios') }})
      * 4 AS linhas_esperadas
WHERE (SELECT count(*) FROM {{ ref('mart_relatorios') }})
   <> (SELECT count(*) FROM {{ ref('municipios_pe') }})
      * (SELECT count(DISTINCT ano) FROM {{ ref('stg_relatorios') }})
      * 4
