# Dicionário de dados

**Em andamento.** Esta página lista apenas os campos que existem no código; os significados ainda não foram documentados.

## Tabela raw `resultados_metas` (saída do tap-digisus)

| Campo | Tipo | Origem | Descrição |
|---|---|---|---|
| esfera | string | API | _a documentar_ |
| estado | string | API | _a documentar_ |
| municipio | string | API | _a documentar_ (exemplo observado: `ABREU E LIMA`) |
| projeto_tipo | string | API | _a documentar_ (exemplo observado: `1º RDQA`) |
| nu_ano_exercicio | string | API | _a documentar_ (exemplo observado: `2018`) |
| status | string | API | _a documentar_ (exemplo observado: `Avaliado`) |
| diretrizes | string (JSON aninhado) | API | _a documentar_ |
| _extract_municipio_id | string | contexto da extração | _a documentar_ |
| _extract_ano | integer | contexto da extração | _a documentar_ |
| _extract_tipo | integer | contexto da extração | _a documentar_ (no código: 10 a 13 = 1º RDQA, 2º RDQA, 3º RDQA, RAG; observado: 10 com `projeto_tipo` = `1º RDQA`) |

## Estrutura do campo `diretrizes`

Texto com um array JSON, com a hierarquia abaixo (nomes e tipos conforme uma amostra real da API de Abreu e Lima, 2018, e o schema do `from_json` em `stg_base_planejamento`). Os significados ainda não foram documentados.

- **diretriz:** `ds_diretriz`, `nu_ordenacao`, `objetivos[]`
  - **objetivo:** `ds_objetivo`, `nu_ordenacao`, `metas[]`
    - **meta:** `ds_meta`, `nu_ordenacao`, `ds_indicador`, `sg_unidade_meta`, `no_unidade_meta`, `sg_unidade_indicador`, `no_unidade_indicador`, `nu_ano_linha_base`, `nu_linha_base`, `vl_projetado_plano`, `vl_projetado_pas`, `st_valor_apuravel`, `vl_executado_relatorio`, `vl_alcancado`, `iniciativas[]`, `subfuncoes[]`
      - **iniciativa:** `ds_iniciativa`
      - **subfuncao:** `nu_codigo_interno`, `no_subfuncao`

## Observações sobre os dados (amostra)

- `nu_ano_linha_base` e `nu_linha_base` chegam como texto (`"2017"`, `"0"`) ou `null`; os campos `vl_*` chegam como número ou `null`.
- Os textos podem conter quebras de linha (a sequência \r\n no JSON, dentro do texto) e caracteres corrompidos (por exemplo `¿`).
- Há repetições dentro do próprio dado da API: a mesma `ds_iniciativa` duas vezes na mesma meta, e a mesma `ds_diretriz` com `nu_ordenacao` diferentes.
- Uma requisição (município 260005, ano 2018, tipo 10) gerou **uma linha**, com `diretrizes` como `str` de 165.095 caracteres e 127 diretrizes. O volume por linha é grande.
- Quando não há projeto para município/ano/tipo, o tap gera uma linha com `status = "sem_projeto_identificado"` e `diretrizes` nulo.

## Unidades de medida e valores da meta (observado nos dados, não é definição oficial)

`sg_unidade_meta` / `no_unidade_meta` têm 8 valores, mapeados em `transform/seeds/unidades_medida.csv`:

| sg_unidade | no_unidade | tipo_valor |
|---|---|---|
| Num | Número | quantidade |
| PERC | Percentual | percentual |
| PROP | Proporção | proporcao |
| RAZ | Razão | razao |
| MOE | Moeda | monetario |
| TAXA | Taxa | taxa |
| IND | Índice | indice |
| DEC | Decimal | decimal |

- `vl_projetado_plano` está na unidade da meta (`Num`: −120 a 180.000.000; `MOE`: até 64,5 milhões; `PERC` e `PROP`: 0 a 100).
- `vl_alcancado` fica entre 0 e 100 em 87% a 100% das metas de **todas** as unidades, e parece ser a proporção de cumprimento (exemplo: plano 2, executado 1, alcançado 50). 19.771 metas têm valor acima de 100, 1.014 acima de 1000, e 28.503 metas `Num` não têm valor.
- `vl_executado_relatorio` e `vl_projetado_pas` vêm do JSON e estão preenchidos em 504.728 e 671.285 das 708.327 metas de `stg_metas`.
- A unidade do indicador é nula em 190.189 metas e difere da unidade da meta em 14.683.
- Os valores são preenchidos pelos responsáveis em cada município e não são corrigidos: `int_metas_unidades` apenas sinaliza os muito fora do comum com flags.

## Relatórios e status (observado nos dados)

Cada município tem 4 relatórios por ano (`projeto_tipo`): `1º RDQA`, `2º RDQA`, `3º RDQA` (quadrimestres) e `RAG` (anual). O `status` do relatório, na origem, tem valores como `Avaliado`, `Em Elaboração`, `Não Iniciado`, `Em Análise no Conselho` e `Retornado para Ajuste`; as linhas sem projeto têm `sem_projeto_identificado`.

- Em `stg_metas`, cada relatório tem cerca de 177 mil metas em 178 municípios, e 99,8% das metas (município, ano e `meta_ordenacao`) aparecem nos 4 relatórios.
- `vl_alcancado` é classificado em `nulo`, `zero` ou `preenchido` (`situacao_preenchimento`). Zero e nulo são respostas dos responsáveis ("sem dado para a meta"). Por relatório (1º, 2º, 3º RDQA, RAG): zero em 98.195, 95.212, 87.129 e 41.602 metas; nulo em cerca de 9,2 mil em todos.
- Em 97.844 das 177.070 metas o `vl_alcancado` difere entre relatórios; em 245 o texto da meta e em 235 o plano mudam entre relatórios.
- Flags extremas: 456 metas em um só relatório (pontual) e 238 em dois ou mais (recorrente).

## Camadas staging e marts

_A documentar quando a modelagem estiver estável._
