# 0012. Site próprio em vez de ferramentas de BI

**Contexto.** Os dados modelados (marts) devem ficar disponíveis ao público em geral, de forma permanente. Ferramentas de BI, como Looker Studio (antigo Data Studio) e Power BI, permitiriam montar painéis sem desenvolver um site. O [ADR 0003](0003-databricks-como-processamento.md) já define que o consumo final não depende do Databricks.

**Decisão.** Não usar Looker Studio, Power BI nem ferramentas semelhantes como camada de consumo. O público acessa um site próprio, que lê arquivos estáticos exportados dos marts.

**Razões.**
- **Consultas ao Databricks a cada acesso.** Um painel de BI ligado diretamente à fonte consulta o Databricks quando alguém o abre ou muda um filtro. Com acesso público, o volume de consultas não é controlável e pode esgotar a cota da conta Free Edition. Os arquivos estáticos tornam o custo de cada visita independente do Databricks.
- **Credencial em serviço de terceiros.** Para atualizar os dados, a ferramenta de BI precisa guardar uma credencial de acesso ao Databricks, que dá acesso à conta inteira. No site estático, o único acesso ao Databricks fica no pipeline local.
- **Dependência de terceiros.** A publicação passa a depender de conta, licença, limites e termos de um serviço externo, que podem mudar.
- **Controle da apresentação.** O site permite organizar a navegação pela hierarquia diretriz, objetivo, meta e indicador, os quatro relatórios do ano lado a lado, as faixas de alcance e os avisos de qualidade dos dados (flags e cobertura de municípios) como o projeto exigir.
- **Objetivo do projeto.** O repositório é um projeto de portfólio, e a camada de apresentação faz parte do que ele demonstra.

**Consequências.** O site precisa ser desenvolvido e mantido (`site/`), e gráficos e filtros são feitos à mão, sem os recursos prontos de uma ferramenta de BI. Em troca, não há consultas ao Databricks por visitante, nem credenciais em serviços externos. Os arquivos exportados continuam utilizáveis por outras ferramentas, caso a decisão mude.
