# site

Site estático que mostra, para o estado e para cada município de Pernambuco, os quatro relatórios do ano (1º, 2º e 3º RDQA e RAG): situação, alcance dos indicadores por classe, mapa, diretrizes, objetivos e metas, e a evolução do RAG pelos anos. Vive em HTML, CSS e JavaScript puros, sem framework, sem etapa de build e sem biblioteca de gráficos (os gráficos são SVG e HTML desenhados em `js/`). A escolha de um site próprio em vez de ferramentas de BI está no [ADR 0012](../docs/decisions/0012-site-proprio-em-vez-de-ferramentas-de-bi.md).

## Estrutura

- `index.html`, `css/style.css`, `js/app.js` (a página) e `js/util.js` (formatação, dica e barras de classes).
- `geo/pe-municipios.json`: contornos dos 185 municípios já projetados para SVG, gerados por [export/gerar_malha_pe.py](../export/README.md) a partir da malha do IBGE, sem Fernando de Noronha. É versionado (cerca de 38 KB).
- `data/`: JSON gerado por [export/](../export/README.md), **ignorado pelo Git**. Sem essa pasta, a página avisa que os dados ainda não foram gerados.

## Como ver localmente

```bash
python export/exportar_site.py              # gera site/data (ver export/README.md)
python -m http.server 8000 --directory site
```

Abra http://localhost:8000. O endereço guarda município, ano, relatório e meta escolhidos (por exemplo `#m=261160&a=2023&r=rag`), então pode ser compartilhado.

## O que a página mostra

Filtros no topo: município, ano e relatório. A página abre em **Todos os municípios**, no ano mais recente em que a maioria dos RAGs já foi aprovada (o ano em andamento ainda tem relatórios por fazer, com indicadores zerados). Escolher um município no filtro, ou clicar nele no mapa, **não rola a tela**: o topo da página passa a destacar o município (anel e contorno no mapa; situação marcada nas barras de status; indicadores do município ao lado dos de Pernambuco; o gráfico de classes mostra só o município, com Pernambuco na tabela) e acrescenta as seções do município mais abaixo, às quais "Ver detalhes" leva. "Ver todos os municípios" volta à visão do estado.

- **Pernambuco no ano (todos os municípios):** municípios na extração, total de indicadores e percentual atingido; situação do relatório escolhido em cada município (barras, com o status original); alcance dos indicadores nos 4 relatórios (barras empilhadas por classe); mapa colorido pela participação de indicadores atingidos, sem ordenar municípios. Clicar em um município no mapa o seleciona.
- **Município no ano:** cartões dos 4 relatórios com status, o percentual de indicadores atingidos e a divisão de todos os indicadores por classe (a mediana do alcance fica na tabela dos cartões).
- **Diretrizes, objetivos e metas:** barras por classe no relatório escolhido (quantidade ou percentual). Um seletor de nível lista todas as diretrizes, todos os objetivos ou todas as metas do município (por exemplo, Recife em 2025: 6, 76 e 294); abrir um item mostra o que há dentro, até os indicadores com plano, executado, alcance e classe. "Abrir tudo" e "Fechar tudo" abrem ou fecham todos os itens do nível.
- **RAG ao longo dos anos:** uma barra de classes de alcance por ano (do primeiro ao último com dados), com o ano escolhido destacado e o % de indicadores atingidos à direita. Na visão inicial, somando todos os municípios; com um município escolhido, só os dele. Usa o `resumo.json` e o `relatorios/<id>.json`, sem exportar nada a mais.

As classes (atingida, parcial, zero e sem valor) e a mediana são cálculos do projeto sobre o valor informado, descritos no [ADR 0013](../docs/decisions/0013-classes-de-alcance-mediana-e-indicadores-repetidos.md).

## Decisões de desenho

- Azul para a interface e para barras de uma série só (situação dos relatórios, faixas). As classes de alcance têm cores com sentido: verde (atingida), amarelo (parcial), vermelho (zero) e cinza (sem valor), sempre nessa ordem; o mapa usa as mesmas cores em 5 faixas (vermelho para poucos indicadores atingidos, amarelo no meio e verde para muitos), nos dois modos, então o verde só aparece onde foi de fato alcançado. Um zero pode ser só um campo não atualizado, e o vermelho não deve ser lido como juízo sobre o município: a página diz isso em "Como ler". A separação entre as cores vizinhas foi calculada para visão normal, protanopia e deuteranopia (mínimo de 8 entre as classes em OKLab × 100, nos dois modos; no mapa, amarelo e verde-claro chegam a 7 na protanopia, compensado pela legenda com rótulos, pela dica e pela tabela); o amarelo tem contraste baixo no fundo claro, compensado pelos números dentro das barras, pela legenda e pela tabela. Modo claro e escuro com valores próprios (segue o sistema e tem botão de tema).
- Toda informação dos gráficos também está em tabela, e as dicas funcionam com mouse e teclado.
- Os textos vindos dos dados entram na página como texto, nunca como HTML.
- Os valores aparecem como foram informados, sem correção. Pizzas e velocímetros foram evitados: com uma situação dominante e várias pequenas, barras mostram todas.

## Ainda não feito

Página de metodologia e avisos de qualidade dos dados (inconsistências registradas), comparação entre períodos de plano e a publicação (ver ADR 0012 e a discussão de hospedagem no homelab).
