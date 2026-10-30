-- Registro de inconsistências (int_inconsistencias) com o código do município, para o site.
-- Os dados não são corrigidos: só se registra o que foi observado.
SELECT
    m.municipio_id
    , i.*
FROM {{ ref('int_inconsistencias') }} AS i
LEFT JOIN (
    SELECT DISTINCT municipio, municipio_id FROM {{ ref('int_metas_unidades') }}
) AS m ON i.municipio = m.municipio
WHERE CAST(i.nu_ano_exercicio AS INT) >= {{ var('ano_inicial') }}
