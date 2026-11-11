# 0010. Registro de inconsistências, sem alterar os dados, e reprodutível a cada ingestão

**Contexto.** Os dados são informados por prefeituras e gestores e são públicos. O objetivo do projeto é processá-los e apresentá-los, e não corrigi-los. Há diferenças entre os 4 relatórios (meta ou indicador ausente, texto ou plano diferentes) e valores muito fora do comum, e o site precisará apontar esses casos. A modelagem roda de novo a cada ingestão (recarga completa, ADR 0001).

**Decisão.**
- Registrar as inconsistências em `int_inconsistencias` (uma linha por ocorrência: tipo, município, ano, meta, indicador, relatórios afetados e detalhe), sem corrigir, remover nem alterar nenhum valor.
- Manter os textos públicos (título e descrição neutros) no seed `tipos_inconsistencia`, editável sem mexer em SQL, e os limites dos valores extremos como `vars` em `dbt_project.yml`.
- Garantir a reprodutibilidade: o registro é derivado só de SQL sobre `raw.resultados_metas`, em views, sem estado, sem etapa manual e sem número fixo. A cada ingestão basta rodar `dbt build`; o resultado é determinístico (duas execuções sobre os mesmos dados deram 3.131 ocorrências e o mesmo hash).

**Consequências.** O registro reflete sempre os dados da última ingestão: se um município corrigir um valor, a ocorrência some na reexecução. Os testes são estruturais (unicidade, valores aceitos, relação com o seed), e não dependem de contagens fixas. Um relatório, unidade ou tipo de inconsistência novos fazem os testes falharem de propósito, e a correção é acrescentar uma linha ao seed. Por enquanto o `dbt build` é executado manualmente, depois do notebook de carga; automatizá-lo no Airflow ficou para depois.
