# 0008. Tipo de valor das unidades de medida na camada intermediate

**Contexto.** As metas trazem a unidade em `sg_unidade_meta` e `sg_unidade_indicador`. Em `stg_metas` há 8 siglas (Num, PERC, PROP, RAZ, MOE, TAXA, IND, DEC), e `vl_projetado_plano` varia de −120 a 180 milhões conforme a unidade. `vl_alcancado` fica quase sempre entre 0 e 100 em todas as unidades. A unidade do indicador é nula em 190.189 metas e difere da unidade da meta em 14.683.

**Decisão.** Manter o staging sem regra de negócio e criar na camada `intermediate`:
- o seed `unidades_medida` (sigla, nome, `tipo_valor`), com `tipo_valor` normalizado: quantidade, percentual, proporcao, razao, monetario, taxa, indice, decimal;
- o modelo `int_metas_unidades`, com a mesma granularidade de `stg_metas`, que acrescenta `tipo_valor_meta` e `tipo_valor_indicador` por join com o seed;
- flags apenas informativas, sem alterar nem remover valores: `flag_alcancado_extremo` (acima de 1000), `flag_plano_negativo`, `flag_plano_extremo` (quantidade acima de 1.000.000), `flag_percentual_fora_faixa` e a informativa `flag_alcancado_sem_plano`, mais o resumo `tem_flag_valor_extremo`. Os limites são `vars` em `dbt_project.yml`.

Também passam a sair do staging `vl_projetado_pas` e `vl_executado_relatorio`, que já eram lidos do JSON.

**Consequências.** O valor de `vl_projetado_plano` só deve ser lido junto de `tipo_valor_meta`; não se somam nem comparam tipos diferentes. `vl_alcancado` parece ser a proporção de cumprimento (50 para 1 executado de um plano de 2), mas isso é uma leitura dos dados, não uma definição oficial. Uma unidade nova na API faz os testes falharem (`not_null` e `accepted_values`), em vez de entrar sem classificação. `PROP` e `PERC` ficam como tipos separados, embora ambos usem a escala 0 a 100. Valores preenchidos pelos responsáveis são mantidos como estão; as flags servem só para revisão.
