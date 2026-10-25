# 0002. Execução local, best-effort

**Contexto.** O Airflow roda em Docker Compose na máquina do autor, com a DAG agendada para o dia 1 de cada mês.

**Decisão.** A orquestração é local e *best-effort*: sem servidor dedicado e sem garantia de execução no horário.

**Consequências.** Não há custo de infraestrutura. Se a máquina estiver desligada no dia 1, a execução não acontece (`catchup=False`) e deve ser disparada manualmente.
