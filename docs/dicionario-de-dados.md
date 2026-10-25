# Dicionário de dados

**Em andamento.** Esta página lista apenas os campos que existem no código; os significados ainda não foram documentados.

## Tabela raw `resultados_metas` (saída do tap-digisus)

| Campo | Tipo | Origem | Descrição |
|---|---|---|---|
| esfera | string | API | _a documentar_ |
| estado | string | API | _a documentar_ |
| municipio | string | API | _a documentar_ |
| projeto_tipo | string | API | _a documentar_ (exemplo observado: `1º RDQA`) |
| nu_ano_exercicio | string | API | _a documentar_ (exemplo observado: `2018`) |
| status | string | API | _a documentar_ (exemplo observado: `Avaliado`) |
| diretrizes | string (JSON aninhado) | API | _a documentar_ |
| _extract_municipio_id | string | contexto da extração | _a documentar_ |
| _extract_ano | integer | contexto da extração | _a documentar_ |
| _extract_tipo | integer | contexto da extração | _a documentar_ |

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
- Quando não há projeto para município/ano/tipo, o tap gera uma linha com `status = "sem_projeto_identificado"` e `diretrizes` nulo.

## Camadas staging e marts

_A documentar quando a modelagem estiver estável._
