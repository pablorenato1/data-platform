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

- Em `stg_metas`, cada relatório tem cerca de 177 mil metas em 178 municípios. Há 177.070 metas (município, ano e `meta_ordenacao`) e 177.461 combinações meta + indicador, porque 106 metas têm mais de um indicador (até 3). 176.613 combinações aparecem nos 4 relatórios e, em 7 metas, o número de indicadores muda entre relatórios.
- `vl_alcancado` é classificado em `nulo`, `zero` ou `acima_de_zero` (`situacao_preenchimento`); a meta conta como preenchida quando é maior ou igual a zero. Zero e nulo são respostas dos responsáveis ("sem dado para a meta"). Por relatório (1º, 2º, 3º RDQA, RAG): zero em 98.195, 95.212, 87.129 e 41.602 metas; nulo em cerca de 9,2 mil em todos.
- Em 97.818 das 177.461 combinações meta + indicador o `vl_alcancado` difere entre relatórios; em 14 o texto da meta e em 161 o plano mudam entre relatórios.
- Flags extremas: 456 metas em um só relatório (pontual) e 238 em dois ou mais (recorrente).

## Registro de inconsistências

`int_inconsistencias` registra, sem alterar os dados, as diferenças entre relatórios e os valores fora do comum, em 10 tipos (seed `tipos_inconsistencia`). Na última execução: 3.131 ocorrências — meta ausente em algum relatório (293 metas), indicador ausente com a meta presente nos 4 (281 metas, 555 ocorrências), número de indicadores diferente (7), texto da meta diferente (14), plano diferente (161), valor alcançado muito acima do usual (681), plano negativo (10), plano muito alto (3) e, como informativa, alcance com plano zero (1.407).

## Marts (observado na última execução)

- `mart_relatorios`: 5.920 linhas (185 municípios x 8 anos, de 2018 a 2025, x 4 relatórios), com o status original. Nos RDQAs, cerca de 1.350 relatórios por tipo estão `Avaliado`. No RAG, 1.256 estão `Aprovado`, 85 `Aprovado com Ressalvas` e 8 `Não Aprovado`, além de `Em Análise no Conselho de Saúde`, `Retornado para Ajustes`, `Em Elaboração` e `Não Iniciado`. 21 relatórios por tipo são `sem_projeto_identificado`, e 48 por tipo vêm de 6 municípios cujo arquivo veio vazio (`tem_dados_na_extracao` falso, status nulo).
- `mart_completude_niveis`: 69.122 linhas de diretriz, 152.473 de objetivo e 707.880 de meta.
- `mart_faixas_alcancado`: indicadores por faixa de `vl_alcancado` de 10 em 10 pontos (faixa 0 = sem valor, 1 = menos de 10%, 2 a 10 = de 10% a menos de 20% até de 90% a menos de 100%, 11 = 100% ou mais), por relatório, diretriz, objetivo e meta (`nivel` e `ordenacao`). Em 111 metas os indicadores têm `vl_alcancado` diferentes, por isso a contagem é de indicadores. Cerca de 39% das linhas do intermediate têm `vl_alcancado` de 100 ou mais.
- `mart_metas_evolucao`: cada meta + indicador com 1º, 2º, 3º RDQA e RAG lado a lado. Premissa: cada RDQA vale só para o seu quadrimestre e o RAG para o ano inteiro; os valores não se acumulam.
- Os textos de diretriz, objetivo, meta e indicador pouco se repetem entre municípios (RAG, 2018 em diante, texto normalizado): das 2.930 diretrizes distintas, 520 aparecem em 2 municípios ou mais; objetivos 1.142 de 7.128; metas 4.526 de 36.597; indicadores 3.988 de 29.123. Por isso a comparação entre municípios exigiria similaridade de texto, ainda não feita.
- Meta preenchida = `vl_alcancado` maior ou igual a zero. Zero e nulo são respostas dos responsáveis e aparecem separados (`taxa_zero`, `taxa_nulo`). `media_alcancado` é a média simples, incluindo zeros e ignorando nulos.
- 2016 e 2017 são ignorados: todas as linhas desses anos são `sem_projeto_identificado`.
- O texto de cada meta é mantido como foi preenchido em cada relatório. Em 14 metas o texto muda entre relatórios, em parte por mudança de nomenclatura legítima (por exemplo, NASF tipo I para EMULTI); acompanha-se a meta pela numeração (`meta_ordenacao`).

## Camadas staging e marts

_A documentar quando a modelagem estiver estável._
