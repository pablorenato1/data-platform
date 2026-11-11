# 0011. Marts, status do relatório, preenchimento e ano inicial

**Contexto.** Os dados vão alimentar um site estático. O `status` de cada relatório indica se ele foi validado pelos órgãos competentes e tem vocabulários diferentes nos RDQAs (`Avaliado` etc.) e no RAG (`Aprovado`, `Aprovado com Ressalvas`, `Não Aprovado` etc.). Em 2016 e 2017 todas as linhas são `sem_projeto_identificado` (716 por ano, 179 municípios x 4 relatórios). Os textos das metas mudam entre relatórios em 14 metas, em parte por mudança legítima de nomenclatura (por exemplo, NASF tipo I para EMULTI).

**Decisão.**
- Usar o `status` original, sem renomear nem agrupar, em todas as tabelas. Municípios que não vieram na extração têm `status` nulo e `tem_dados_na_extracao` falso.
- Ignorar 2016 e 2017 na modelagem (`var('ano_inicial')` = 2018). A extração e a tabela raw não foram alteradas.
- Acompanhar a mesma meta entre relatórios pela numeração (`meta_ordenacao`) e manter o texto de cada relatório como foi preenchido, sem escolher um. Diferenças de texto ficam só registradas em `int_metas_unidades` e `int_inconsistencias`.
- Considerar meta **preenchida** quando `vl_alcancado` é maior ou igual a zero (não nulo). Zero e nulo são respostas dos responsáveis e aparecem separados: `situacao_preenchimento` = `acima_de_zero`, `zero` ou `nulo`.
- Calcular `media_alcancado` (média simples de `vl_alcancado` das metas do nível, incluindo zeros e ignorando nulos) por relatório, diretriz, objetivo e meta.
- Criar marts como tabelas: `mart_relatorios` (município x ano x relatório, com status e taxas), `fact_metas` (meta + indicador x relatório, com a hierarquia e os textos), `fact_inconsistencias` (o registro, com o município) e `mart_completude_niveis` (diretriz, objetivo e meta). O seed `municipios_pe` (mesma lista do tap) faz municípios sem dados na extração aparecerem.

**Consequências.** Uma média de `vl_alcancado` sofre influência de valores acima de 100 (superação) e de zeros; por isso `qtd_metas_com_flag_extrema`, `taxa_zero` e `taxa_nulo` acompanham a média. `descricao` em `mart_completude_niveis` é o texto de uma das metas do nível (`max`), o que só importa quando a mesma numeração é usada para diretrizes diferentes (registrado em `int_inconsistencias`). A modelagem toda roda com `dbt build` (cerca de 3 minutos, 76 passos) e é reprodutível a cada ingestão.
