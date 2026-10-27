# docs

Documentação de apoio ao projeto. Não contém código executável.

## Conteúdo

- [decisions/](decisions/): ADRs (*Architecture Decision Records*), um arquivo por decisão, com contexto, decisão e consequências.

  | ADR | Assunto |
  |---|---|
  | [0001](decisions/0001-recarga-completa.md) | Recarga completa a cada execução |
  | [0002](decisions/0002-execucao-local-best-effort.md) | Execução local, best-effort |
  | [0003](decisions/0003-databricks-como-processamento.md) | Databricks como processamento, não serving |
  | [0004](decisions/0004-monorepo.md) | Monorepo |
  | [0005](decisions/0005-modelos-reconstruidos.md) | Modelos raw/staging reconstruídos a partir do SQL compilado |
  | [0006](decisions/0006-remove-camada-raw-do-dbt.md) | Remoção da camada raw do dbt |
  | [0007](decisions/0007-projeto-tipo-nas-chaves.md) | `projeto_tipo` nas chaves dos modelos staging |
  | [0008](decisions/0008-unidades-de-medida-na-intermediate.md) | Tipo de valor das unidades na camada intermediate |
  | [0009](decisions/0009-comparativo-entre-relatorios.md) | Comparativo entre os 4 relatórios e zero/nulo como resposta |

- [dicionario-de-dados.md](dicionario-de-dados.md): **em andamento.** Lista os campos da tabela raw `resultados_metas`, com as descrições ainda por preencher. Camadas staging e marts entram quando a modelagem estiver estável (ADR 0005 explica a origem dos modelos atuais).

## Como manter

- Novo ADR: crie `decisions/NNNN-titulo-curto.md` com as seções *Contexto*, *Decisão* e *Consequências*, e adicione à tabela acima. Registre apenas decisões efetivamente tomadas; para mudar uma decisão, crie um ADR novo e indique qual ele substitui.
- Dicionário: só inclua o significado de um campo depois de confirmá-lo na fonte (API DigiSUS) ou no código dos modelos em [transform/](../transform/README.md).

## Como se conecta

O dicionário descreve os dados produzidos por [extraction/](../extraction/README.md) e modelados em [transform/](../transform/README.md). Os ADRs explicam as escolhas dessas etapas e do [airflow/](../airflow/README.md).
