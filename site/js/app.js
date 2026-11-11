// Site estático: lê os JSON gerados por export/exportar_site.py (pasta data/) e desenha a página.
import {
  $, h, s, numero, porcento, carregar, limitar, rotuloStatus, ligarDica, segmentado,
  barraClasses, legendaClasses, RELATORIOS, CLASSES, SEM_PROJETO, faixaParcial, detalharClasses,
} from './util.js';

const estado = {
  municipios: null, resumo: null, mapa: null, malha: null,
  mun: null, ano: null, rel: 'rag', meta: null, indicador: 0,
  modo: 'quantidade', nivel: 'diretriz', abertos: new Set(),
  relDados: null, metasDados: null,
};

const tipoDe = (chave) => RELATORIOS.find((d) => d.chave === chave);
const nomeDe = (id) => estado.municipios.municipios.find((m) => m.id === id)?.nome ?? id;

// ---------- estado (todos os municípios) ----------
const ORDEM_STATUS = ['Aprovado', 'Aprovado com Ressalvas', 'Avaliado', 'Não Aprovado', 'Em Análise no Conselho de Saúde',
  'Retornado para Ajustes', 'Em Elaboração', 'Não Iniciado', 'sem_projeto_identificado', 'sem_dados'];

function barrasStatus(lista, statusMun, nomeMun) {
  const maximo = Math.max(1, ...lista.map(([, n]) => n));
  const total = lista.reduce((a, [, n]) => a + n, 0);
  return h('div', { class: 'barras-status' }, lista.map(([status, n]) => {
    const p = (n / total) * 100;
    const doMunicipio = statusMun != null && status === statusMun;
    const barra = h('div', {
      class: `barra-simples${status === 'sem_dados' ? ' sem-valor' : ''}${doMunicipio ? ' destaque' : ''}`, tabindex: 0, role: 'img',
      style: `width:${Math.max(0.6, (n / maximo) * 100)}%`,
      'aria-label': `${rotuloStatus(status)}: ${n} municípios (${porcento(p)})${doMunicipio ? `, situação de ${nomeMun}` : ''}`,
    });
    ligarDica(barra, `${numero(n, 0)} ${n === 1 ? 'município' : 'municípios'} (${porcento(p)})`, rotuloStatus(status));
    return h('div', { class: `linha-status${doMunicipio ? ' destaque' : ''}` },
      h('div', { class: 'rotulo-status' }, rotuloStatus(status), doMunicipio ? h('span', { class: 'marca-mun', text: `● ${limitar(nomeMun, 26)}` }) : null),
      h('div', { class: 'trilho-status' }, barra),
      h('div', { class: 'valor-status', text: `${numero(n, 0)} · ${porcento(p, 0)}` }));
  }));
}

function renderEstado() {
  const ano = String(estado.ano);
  const resumo = estado.resumo?.[ano];
  const mun = estado.mun;
  const nomeMun = mun ? nomeDe(mun) : null;
  $('t-estado').textContent = mun ? `Pernambuco em ${ano} · destaque: ${nomeMun}` : `Pernambuco em ${ano}`;
  const verDetalhes = $('ver-detalhes');
  verDetalhes.hidden = !mun;
  if (mun) verDetalhes.textContent = `Ver detalhes de ${nomeMun} ↓`;
  const def = tipoDe(estado.rel);
  const dados = resumo?.[def.tipo];
  const porTipoMun = mun ? new Map((estado.relDados?.anos?.[ano] ?? []).map((r) => [r.tipo, r])) : null;
  const relMun = porTipoMun?.get(def.tipo);
  if (!dados) {
    $('kpis').replaceChildren();
    for (const id of ['estado-status', 'estado-classes', 'estado-mapa']) $(id).replaceChildren(h('p', { class: 'painel-vazio', text: 'Sem dados para este ano.' }));
    return;
  }

  // indicadores
  const classes = dados.classes;
  const totalInd = CLASSES.reduce((a, c) => a + (classes[c.chave] || 0), 0);
  const semDados = (dados.status.find(([st]) => st === 'sem_dados') ?? [, 0])[1];
  const totalMun = estado.municipios.total_municipios;
  const kpi = (rotulo, valor, nota, texto = false) => h('div', { class: 'kpi' },
    h('div', { class: 'kpi-rotulo', text: rotulo }), h('div', { class: `kpi-valor${texto ? ' texto' : ''}`, text: valor }), h('div', { class: 'kpi-nota', text: nota }));
  const pctPE = totalInd ? ((classes.atingida || 0) / totalInd) * 100 : null;
  if (mun) {
    const statusMun = relMun && relMun.tem_dados && relMun.status ? relMun.status : 'sem_dados';
    const mesmos = (dados.status.find(([st]) => st === statusMun) ?? [, 0])[1];
    const indMun = relMun?.qtd_indicadores ?? 0;
    const pctMun = indMun ? ((relMun.classes.atingida || 0) / indMun) * 100 : null;
    $('kpis').replaceChildren(
      kpi(`Situação do ${def.tipo} em ${nomeMun}`, rotuloStatus(statusMun), `${numero(mesmos, 0)} de ${numero(totalMun, 0)} municípios na mesma situação`, true),
      kpi(`Indicadores em ${nomeMun}`, numero(indMun, 0), `Pernambuco: ${numero(totalInd, 0)}`),
      kpi('Indicadores atingidos', pctMun == null ? '–' : porcento(pctMun, 0), `Pernambuco: ${pctPE == null ? '–' : porcento(pctPE, 0)}`));
  } else {
    $('kpis').replaceChildren(
      kpi('Municípios na extração', `${numero(totalMun - semDados, 0)} de ${numero(totalMun, 0)}`, `${def.tipo}, ${ano}`),
      kpi('Indicadores', numero(totalInd, 0), `somando os municípios, ${def.tipo}`),
      kpi('Indicadores atingidos', pctPE == null ? '–' : porcento(pctPE, 0), 'alcance de 100% ou mais'));
  }

  // situação dos relatórios dos municípios
  const ordenado = [...dados.status].sort((a, b) => ORDEM_STATUS.indexOf(a[0]) - ORDEM_STATUS.indexOf(b[0]));
  $('estado-status').replaceChildren(
    h('h3', { text: `Situação do ${def.tipo} nos municípios` }),
    h('p', { class: 'sub', text: mun ? `Quantos municípios estão em cada situação. A situação de ${nomeMun} está marcada.` : 'Quantos municípios estão em cada situação, como informada no DigiSUS.' }),
    barrasStatus(ordenado, mun ? (relMun && relMun.tem_dados && relMun.status ? relMun.status : 'sem_dados') : null, nomeMun));

  // classes de alcance por relatório (os quatro, em percentual)
  // mostra só o que está selecionado: o município escolhido ou, sem escolha, Pernambuco inteiro
  const linhas = RELATORIOS.map((d) => {
    const relM = mun ? porTipoMun.get(d.tipo) : null;
    const barra = !mun
      ? barraClasses(resumo[d.tipo]?.classes ?? {}, 'percentual', 1)
      : (relM && relM.tem_metas ? barraClasses(relM.classes, 'percentual', 1) : h('span', { class: 'barra-vazia', text: 'sem indicadores' }));
    return h('div', { class: 'linha-classes' }, h('div', { class: 'rotulo-linha', text: d.tipo }), barra);
  });
  const linhasTabela = [];
  const celulas = (classes) => CLASSES.map((c) => h('td', { class: 'num', text: numero(classes?.[c.chave] ?? 0, 0) }));
  for (const d of RELATORIOS) {
    linhasTabela.push(h('tr', { class: 'inicio-grupo' }, h('td', { class: 'col-relatorio', text: d.tipo }), h('td', { text: 'Pernambuco' }),
      ...celulas(resumo[d.tipo]?.classes)));
    if (mun) linhasTabela.push(h('tr', {}, h('td', {}), h('td', { class: 'col-mun', text: nomeMun }), ...celulas(porTipoMun.get(d.tipo)?.classes)));
  }
  const tabela = h('table', { class: 'tabela-classes' },
    h('thead', {},
      h('tr', {}, h('th', { rowspan: 2, text: 'Relatório' }), h('th', { rowspan: 2, text: 'Onde' }),
        h('th', { class: 'num', rowspan: 2, text: 'Atingida' }), h('th', { class: 'grupo-parcial', colspan: 3, text: 'Parcial' }),
        h('th', { class: 'num', rowspan: 2, text: 'Zero' }), h('th', { class: 'num', rowspan: 2, text: 'Sem valor' })),
      h('tr', {}, h('th', { class: 'num', text: 'Alto' }), h('th', { class: 'num', text: 'Médio' }), h('th', { class: 'num', text: 'Baixo' }))),
    h('tbody', {}, linhasTabela));
  $('estado-classes').replaceChildren(
    h('h3', { text: mun ? `Alcance dos indicadores em ${nomeMun}` : 'Alcance dos indicadores em cada relatório' }),
    h('p', { class: 'sub', text: mun ? `Município escolhido, nos quatro relatórios (Pernambuco está na tabela, abaixo). Cada RDQA vale só para o seu quadrimestre; o RAG, para o ano inteiro.` : 'Todos os municípios somados. Cada RDQA vale só para o seu quadrimestre; o RAG, para o ano inteiro.' }),
    ...linhas, legendaClasses());
  $('estado-tabela').replaceChildren(
    h('details', { class: 'tabela-alt tabela-solta' }, h('summary', { text: 'Ver como tabela: alcance dos indicadores por relatório' }), h('div', { class: 'rolagem' }, tabela)));

  renderMapa();
}

// ---------- mapa ----------
const FAIXAS_MAPA = [
  { ate: 20, rotulo: '20% a 0%' }, { ate: 40, rotulo: '40% a 20%' }, { ate: 60, rotulo: '60% a 40%' },
  { ate: 80, rotulo: '80% a 60%' }, { ate: Infinity, rotulo: '100% a 80%' },
];
const faixaMapa = (pct) => FAIXAS_MAPA.findIndex((f) => pct < f.ate);

function renderMapa() {
  const alvo = $('estado-mapa');
  const def = tipoDe(estado.rel);
  const dados = estado.mapa?.[String(estado.ano)]?.[def.tipo] ?? {};
  const malha = estado.malha;
  const dadoMun = estado.mun ? dados[estado.mun] : null;
  const titulo = [
    h('h3', { text: `Indicadores atingidos por município, ${def.tipo}` }),
    h('p', { class: 'sub', text: 'Participação dos indicadores com alcance de 100% ou mais. Sem ordenação entre municípios.' }),
  ];
  if (estado.mun) {
    titulo.push(h('p', { class: 'destaque-mapa', text: dadoMun
      ? `${nomeDe(estado.mun)}: ${porcento((dadoMun[0] / dadoMun[1]) * 100, 0)} dos indicadores atingidos (${numero(dadoMun[0], 0)} de ${numero(dadoMun[1], 0)}), no círculo do mapa.`
      : `${nomeDe(estado.mun)}: sem indicadores neste relatório.` }));
  }
  if (!malha) {
    alvo.replaceChildren(...titulo, h('p', { class: 'painel-vazio', text: 'Mapa indisponível.' }));
    return;
  }
  const svg = s('svg', { class: 'mapa', viewBox: `0 0 ${malha.largura} ${malha.altura}`, role: 'img', 'aria-label': 'Mapa de Pernambuco colorido pela participação de indicadores atingidos em cada município' });
  for (const [id, d] of Object.entries(malha.municipios)) {
    const dado = dados[id];
    const pct = dado ? (dado[0] / dado[1]) * 100 : null;
    const caminho = s('path', { d, class: `mun-mapa ${pct == null ? 'mapa-sem' : `mapa-${faixaMapa(pct)}`}${id === estado.mun ? ' selecionado' : ''}` });
    ligarDica(caminho, pct == null ? 'Sem indicadores' : `${porcento(pct, 0)} atingidos (${numero(dado[0], 0)} de ${numero(dado[1], 0)})`, nomeDe(id));
    caminho.addEventListener('click', () => selecionarMunicipio(id));
    svg.append(caminho);
  }
  const selecionado = svg.querySelector('.selecionado');
  if (selecionado) svg.append(selecionado); // desenhado por último, para o contorno ficar por cima
  const legenda = h('ul', { class: 'legenda' }, [
    // do maior para o menor, como a legenda das classes
    ...FAIXAS_MAPA.map((f, i) => ({ f, i })).reverse().map(({ f, i }) => h('li', {}, h('span', { class: `chave mapa-${i}` }), h('span', { text: f.rotulo }))),
    h('li', {}, h('span', { class: 'chave mapa-sem' }), h('span', { text: 'sem indicadores' })),
  ]);
  const notaLegenda = h('p', { class: 'nota-tabela', text: 'Em cada faixa, o limite menor está incluído e o maior não (a primeira vai até 100%).' });
  const linhas = Object.keys(dados)
    .sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), 'pt-BR'))
    .map((id) => h('tr', {}, h('td', { text: nomeDe(id) }), h('td', { class: 'num', text: numero(dados[id][0], 0) }),
      h('td', { class: 'num', text: numero(dados[id][1], 0) }), h('td', { class: 'num', text: porcento((dados[id][0] / dados[id][1]) * 100, 0) })));
  alvo.replaceChildren(...titulo, svg, legenda, notaLegenda,
    h('details', { class: 'tabela-alt' }, h('summary', { text: 'Ver como tabela (ordem alfabética)' }),
      h('div', { class: 'rolagem tabela-alta' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', { text: 'Município' }), h('th', { class: 'num', text: 'Atingidos' }), h('th', { class: 'num', text: 'Indicadores' }), h('th', { class: 'num', text: '%' }))),
        h('tbody', {}, linhas)))));
  // anel em volta do município escolhido (precisa do SVG já na página para medir o contorno)
  const sel = svg.querySelector('.selecionado');
  if (sel) {
    const b = sel.getBBox();
    svg.append(s('circle', { class: 'anel-mun', cx: b.x + b.width / 2, cy: b.y + b.height / 2, r: Math.max(16, Math.max(b.width, b.height) / 2 + 9) }));
  }
}

// ---------- município: cartões ----------
function mensagemSemMetas(rel) {
  if (!rel || !rel.tem_dados) return 'O município ainda não consta na extração dos dados.';
  if (rel.status === SEM_PROJETO) return 'Sem projeto identificado neste relatório.';
  return 'Este relatório não tem metas registradas.';
}

function renderCartoes(porTipo) {
  $('t-municipio').textContent = `${nomeDe(estado.mun)} em ${estado.ano}`;
  $('cartoes').replaceChildren(...RELATORIOS.map((d) => {
    const rel = porTipo.get(d.tipo);
    const cartao = h('article', { class: 'cartao' },
      h('h3', { text: d.tipo }),
      h('div', { class: 'cartao-periodo', text: d.periodo }),
      h('div', {}, h('span', { class: 'chip', text: rel && rel.tem_dados ? rotuloStatus(rel.status) : 'Sem dados' })));
    if (!rel || !rel.tem_metas) {
      cartao.append(h('p', { class: 'cartao-vazio', text: mensagemSemMetas(rel) }));
      return cartao;
    }
    const total = rel.qtd_indicadores;
    const pctAtingidos = total ? (rel.classes.atingida / total) * 100 : 0;
    cartao.append(
      h('div', { class: 'numero-grande', text: porcento(pctAtingidos, 0) }),
      h('div', { class: 'numero-legenda', text: 'dos indicadores atingiram o plano' }),
      barraClasses(rel.classes, 'percentual', 1),
      h('div', { class: 'detalhe', text: `${numero(rel.classes.atingida, 0)} de ${numero(total, 0)} indicadores com alcance de 100% ou mais` }));
    return cartao;
  }));

  // tabela dos cartões, com a mediana (ela ignora os campos vazios e, com valores concentrados em 0 e 100, salta entre os dois)
  const linhas = RELATORIOS.map((d) => {
    const rel = porTipo.get(d.tipo);
    const com = rel && rel.tem_metas;
    return h('tr', {},
      h('td', { text: d.tipo }),
      h('td', { text: rel && rel.tem_dados ? rotuloStatus(rel.status) : 'Sem dados' }),
      h('td', { class: 'num', text: com ? numero(rel.qtd_indicadores, 0) : '–' }),
      ...CLASSES.map((c) => h('td', { class: 'num', text: com ? numero(rel.classes[c.chave], 0) : '–' })),
      h('td', { class: 'num', text: com && rel.mediana_alcancado != null ? porcento(rel.mediana_alcancado, 1) : '–' }));
  });
  $('cartoes-legenda').replaceChildren(
    legendaClasses(),
    h('details', { class: 'tabela-alt' }, h('summary', { text: 'Ver como tabela' }),
      h('div', { class: 'rolagem' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', { text: 'Relatório' }), h('th', { text: 'Status' }), h('th', { class: 'num', text: 'Indicadores' }),
          ...CLASSES.map((c) => h('th', { class: 'num', text: c.rotulo })), h('th', { class: 'num', text: 'Mediana do alcance' }))),
        h('tbody', {}, linhas))),
      h('p', { class: 'nota-tabela', text: 'A mediana considera só os indicadores com valor (ignora os campos vazios). Como os valores costumam se concentrar em 0 e em 100, ela tende a saltar entre os dois e não substitui a divisão por classes.' })));
}

// ---------- município: diretrizes, objetivos e metas ----------
function classeDetalhada(r) {
  return r.classe === 'parcial' ? faixaParcial(r.alcancado) : r.classe;
}

function contar(metas, chave) {
  const c = { atingida: 0, parcial_alto: 0, parcial_medio: 0, parcial_baixo: 0, zero: 0, sem_valor: 0 };
  for (const m of metas) for (const ind of m.indicadores) {
    const r = ind.rel[chave];
    if (r && r.classe) c[classeDetalhada(r)] += 1;
  }
  return c;
}
const soma = (c) => CLASSES.reduce((a, x) => a + (c[x.chave] || 0), 0);

function formatarValor(v, tipoValor) {
  if (v == null) return '–';
  return tipoValor === 'percentual' ? porcento(v, 2) : numero(v, 2);
}

function tabelaMetas(metas, chave) {
  const linhas = [];
  for (const meta of metas) {
    meta.indicadores.forEach((ind, i) => {
      const r = ind.rel[chave];
      const presente = r && r.status != null;
      const classe = presente ? CLASSES.find((c) => c.chave === classeDetalhada(r)) : null;
      linhas.push(h('tr', {},
        h('td', { class: 'col-meta', text: i === 0 ? `${meta.ordem} · ${meta.descricao ?? ''}` : '' }),
        h('td', { text: ind.nome ?? '' }),
        h('td', { class: 'num', text: presente ? formatarValor(r.plano, meta.tipo_valor) : '–' }),
        h('td', { class: 'num', text: presente ? formatarValor(r.executado, meta.tipo_valor) : '–' }),
        h('td', { class: 'num', text: presente && r.alcancado != null ? porcento(r.alcancado, 2) : '–' }),
        h('td', {}, classe
          ? h('span', { class: 'etiqueta-classe' }, h('span', { class: `chave seg-${classe.chave}` }), classe.rotulo)
          : h('span', { class: 'etiqueta-classe', text: 'Meta não consta' }))));
    });
  }
  return h('div', { class: 'rolagem' }, h('table', { class: 'tabela-metas' },
    h('thead', {}, h('tr', {}, h('th', { text: 'Meta' }), h('th', { text: 'Indicador' }),
      h('th', { class: 'num', text: 'Plano' }), h('th', { class: 'num', text: 'Executado' }),
      h('th', { class: 'num', title: 'Valor informado pelo DigiSUS, sem recálculo', text: 'Alcance (DigiSUS)' }), h('th', { text: 'Classe' }))),
    h('tbody', {}, linhas)));
}

function renderArvore() {
  const alvo = $('arvore');
  const dados = estado.metasDados;
  const def = tipoDe(estado.rel);
  const chave = def.chave;
  $('t-arvore-rel').textContent = def.tipo;
  if (!dados || !dados.diretrizes.length) {
    alvo.replaceChildren(h('p', { class: 'painel-vazio', text: 'Este município não tem metas registradas neste ano.' }));
    return;
  }

  const base = `${estado.mun}-${estado.ano}`;
  const todasMetas = (d) => d.objetivos.flatMap((o) => o.metas);
  const objetivos = dados.diretrizes.flatMap((d) => d.objetivos);
  const metas = dados.diretrizes.flatMap(todasMetas);
  const maxDe = (lista) => Math.max(1, ...lista.map((metasDoNo) => soma(contar(metasDoNo, chave))));
  const escalaDir = maxDe(dados.diretrizes.map(todasMetas));
  const escalaObj = maxDe(objetivos.map((o) => o.metas));
  const escalaMeta = maxDe(metas.map((m) => [m]));

  const ligarAberto = (el, chaveNo) => {
    el.open = estado.abertos.has(chaveNo);
    el.addEventListener('toggle', () => {
      if (el.open) estado.abertos.add(chaveNo); else estado.abertos.delete(chaveNo);
    });
  };

  // item com tabela de metas e indicadores, montada só quando é aberto
  const no = (chaveNo, rotulo, metasDoNo, escala, raiz) => {
    const det = h('details', { class: `no-objetivo${raiz ? ' raiz' : ''}` },
      h('summary', {}, h('span', { class: 'rotulo-no', text: rotulo }), barraClasses(contar(metasDoNo, chave), estado.modo, escala)));
    const corpo = h('div', { class: 'corpo-no' });
    det.append(corpo);
    const montar = () => { if (!corpo.firstChild) corpo.append(tabelaMetas(metasDoNo, chave)); };
    det.addEventListener('toggle', () => { if (det.open) montar(); });
    ligarAberto(det, chaveNo);
    if (det.open) montar();
    return det;
  };
  const noObjetivo = (o, raiz) => no(`${base}-o${o.ordem}`, `${o.ordem} · ${o.descricao ?? 'Objetivo'}`, o.metas, escalaObj, raiz);
  const noMeta = (m) => no(`${base}-m${m.ordem}`, `${m.ordem} · ${m.descricao ?? 'Meta'}`, [m], escalaMeta, true);
  const grupo = (d) => h('div', { class: 'grupo-nivel', text: `Diretriz ${d.ordem} · ${limitar(d.descricao, 120) || ''}` });

  let lista;
  const chavesDoNivel = [];
  if (estado.nivel === 'meta') {
    lista = dados.diretrizes.flatMap((d) => [grupo(d), ...todasMetas(d).map((m) => { chavesDoNivel.push(`${base}-m${m.ordem}`); return noMeta(m); })]);
  } else if (estado.nivel === 'objetivo') {
    lista = dados.diretrizes.flatMap((d) => [grupo(d), ...d.objetivos.map((o) => { chavesDoNivel.push(`${base}-o${o.ordem}`); return noObjetivo(o, true); })]);
  } else {
    lista = dados.diretrizes.map((d) => {
      const chaveD = `${base}-d${d.ordem}`;
      chavesDoNivel.push(chaveD, ...d.objetivos.map((o) => `${base}-o${o.ordem}`));
      const det = h('details', { class: 'no-diretriz' },
        h('summary', {},
          h('span', { class: 'rotulo-no', text: `${d.ordem} · ${d.descricao ?? 'Diretriz'}` }),
          barraClasses(contar(todasMetas(d), chave), estado.modo, escalaDir)),
        h('div', { class: 'corpo-no' }, d.objetivos.map((o) => noObjetivo(o, false))));
      ligarAberto(det, chaveD);
      return det;
    });
  }

  const totais = { diretriz: dados.diretrizes.length, objetivo: objetivos.length, meta: metas.length };
  const botao = (rotulo, aoClicar) => {
    const b = h('button', { type: 'button', class: 'botao-link', text: rotulo });
    b.addEventListener('click', aoClicar);
    return b;
  };
  alvo.replaceChildren(
    h('div', { class: 'controles-arvore' },
      h('div', { class: 'grupo-controles' },
        segmentado('Nível', [
          { valor: 'diretriz', rotulo: `Diretrizes (${totais.diretriz})` },
          { valor: 'objetivo', rotulo: `Objetivos (${totais.objetivo})` },
          { valor: 'meta', rotulo: `Metas (${totais.meta})` },
        ], estado.nivel, (v) => { estado.nivel = v; renderArvore(); }),
        segmentado('Escala das barras', [{ valor: 'quantidade', rotulo: 'Quantidade' }, { valor: 'percentual', rotulo: 'Percentual' }], estado.modo, (v) => { estado.modo = v; renderArvore(); }),
        botao('Abrir tudo', () => { chavesDoNivel.forEach((k) => estado.abertos.add(k)); renderArvore(); }),
        botao('Fechar tudo', () => { chavesDoNivel.forEach((k) => estado.abertos.delete(k)); renderArvore(); })),
      legendaClasses()),
    ...lista);
}

// ---------- evolução do RAG pelos anos ----------
function renderEvolucaoAnos() {
  const doEstado = !estado.mun;
  $('t-anos').textContent = doEstado ? 'RAG ao longo dos anos, em Pernambuco' : 'RAG ao longo dos anos';
  $('anos-legenda').textContent = `Como ficou o RAG (relatório anual) de cada ano${doEstado ? ', somando todos os municípios' : ''}. Cada barra mostra as classes de alcance dos indicadores daquele ano, e o número à direita é a parte dos indicadores que atingiu a meta.`;
  const anos = [...estado.municipios.anos].sort((a, b) => a - b);
  const linhas = anos.map((ano) => {
    let classes = null;
    if (doEstado) {
      classes = estado.resumo?.[String(ano)]?.RAG?.classes ?? null;
    } else {
      const r = (estado.relDados?.anos?.[String(ano)] ?? []).find((x) => x.tipo === 'RAG');
      classes = r && r.tem_metas ? r.classes : null;
    }
    const total = classes ? CLASSES.reduce((a, c) => a + (classes[c.chave] || 0), 0) : 0;
    const selecionado = ano === estado.ano;
    const andamento = ano === new Date().getFullYear();
    return h('div', { class: `linha-ano${selecionado ? ' atual' : ''}` },
      h('span', { class: 'ano', text: String(ano) }),
      total ? barraClasses(classes, 'percentual', 1) : h('span', { class: 'barra-vazia', text: 'sem indicadores' }),
      h('span', { class: 'ano-valor', text: total ? porcento((classes.atingida / total) * 100, 0) : '–' }),
      andamento ? h('span', { class: 'ano-nota', text: 'ano em andamento' }) : null);
  });
  $('anos').replaceChildren(...linhas, legendaClasses());
}

// ---------- página ----------
function gravarHash() {
  const p = new URLSearchParams({ a: String(estado.ano), r: estado.rel });
  if (estado.mun) p.set('m', estado.mun);
  if (estado.meta) p.set('meta', estado.meta);
  history.replaceState(null, '', `#${p.toString()}`);
}

function renderPorMunicipio() {
  const porTipo = new Map((estado.relDados?.anos?.[String(estado.ano)] ?? []).map((r) => [r.tipo, r]));
  renderCartoes(porTipo);
  renderArvore();
  renderEvolucaoAnos();
}

// Aviso acima da área de conteúdo (dados desatualizados ou erro ao desenhar)
function avisar(texto) {
  let aviso = $('aviso-dados');
  if (!texto) { aviso?.remove(); return; }
  if (!aviso) {
    aviso = h('p', { class: 'aviso', id: 'aviso-dados', role: 'alert' });
    $('area').before(aviso);
  }
  aviso.textContent = texto;
}

async function atualizar() {
  const area = $('area');
  area.classList.add('carregando');
  try {
    const emMunicipio = Boolean(estado.mun);
    for (const id of ['municipio', 'sec-arvore']) $(id).hidden = !emMunicipio;
    if (emMunicipio) {
      const [rels, metas] = await Promise.all([
        carregar(`data/relatorios/${estado.mun}.json`),
        carregar(`data/metas/${estado.mun}-${estado.ano}.json`),
      ]);
      for (const rs of Object.values(rels.anos ?? {})) for (const r of rs) r.classes = detalharClasses(r.classes, r.faixas);
      estado.relDados = rels;
      estado.metasDados = metas;
    } else {
      estado.relDados = null;
      estado.metasDados = null;
    }
    avisar(null);
    renderEstado();
    if (emMunicipio) renderPorMunicipio();
    else renderEvolucaoAnos();
    gravarHash();
  } catch (erro) {
    console.error(erro);
    avisar('Não foi possível desenhar a página com estes dados. Eles podem estar desatualizados: rode export/exportar_site.py de novo.');
  } finally {
    // a área nunca fica apagada: ela só fica a 50% de opacidade enquanto os dados carregam
    area.classList.remove('carregando');
  }
}

function selecionarMunicipio(id) {
  estado.mun = id; estado.meta = null; estado.indicador = 0;
  $('sel-municipio').value = id;
  atualizar();
}

function preencherFiltros() {
  const { municipios, anos } = estado.municipios;
  const selMun = $('sel-municipio'), selAno = $('sel-ano'), selRel = $('sel-relatorio');
  selMun.replaceChildren(h('option', { value: '', text: 'Todos os municípios' }),
    ...municipios.map((m) => h('option', { value: m.id, text: m.tem_dados ? m.nome : `${m.nome} (sem dados)` })));
  selAno.replaceChildren(...[...anos].reverse().map((a) => h('option', { value: String(a), text: String(a) })));
  selRel.replaceChildren(...RELATORIOS.map((d) => h('option', { value: d.chave, text: d.tipo })));
  selMun.value = estado.mun;
  selAno.value = String(estado.ano);
  selRel.value = estado.rel;
  $('ver-detalhes').addEventListener('click', () => $('municipio').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  $('ver-todos').addEventListener('click', () => { selMun.value = ''; estado.mun = ''; estado.meta = null; estado.indicador = 0; atualizar().then(() => window.scrollTo({ top: 0, behavior: 'smooth' })); });
  selMun.addEventListener('change', () => {
    estado.mun = selMun.value;
    estado.meta = null;
    estado.indicador = 0;
    atualizar();
  });
  selAno.addEventListener('change', () => { estado.ano = Number(selAno.value); estado.meta = null; estado.indicador = 0; atualizar(); });
  selRel.addEventListener('change', () => {
    estado.rel = selRel.value;
    renderEstado();
    if (estado.mun) renderArvore();
    gravarHash();
  });
}

function renderRodape() {
  const d = estado.municipios;
  const data = new Date(d.gerado_em).toLocaleDateString('pt-BR');
  $('rodape-texto').replaceChildren(
    h('p', { text: 'Fonte: DigiSUS Gestor (Ministério da Saúde), dados públicos de planejamento dos municípios de Pernambuco, a partir de 2018.' }),
    h('p', { text: `Os valores são mostrados como foram informados pelos municípios, sem correção. Cobertura: ${d.municipios_com_dados} de ${d.total_municipios} municípios. Dados gerados em ${data}.` }),
    h('p', { text: 'As classes de alcance (atingida, parcial em três faixas, zero e sem valor) e a mediana são cálculos deste painel sobre o valor de alcance informado. O painel não ordena municípios. Fernando de Noronha não é exibido.' }));
}

function iniciarTema() {
  const raiz = document.documentElement;
  const salvo = localStorage.getItem('tema');
  if (salvo) raiz.dataset.theme = salvo;
  $('tema').addEventListener('click', () => {
    const escuro = raiz.dataset.theme === 'dark';
    raiz.dataset.theme = escuro ? 'light' : 'dark';
    localStorage.setItem('tema', raiz.dataset.theme);
  });
}

// Ano que a página abre: o mais recente em que a maioria dos RAGs já foi aprovada (o ano em
// andamento ainda tem relatórios por fazer, com os indicadores zerados, e daria uma ideia errada).
function anoPadrao() {
  const anos = [...estado.municipios.anos].reverse();
  const aprovado = (st) => st === 'Aprovado' || st === 'Aprovado com Ressalvas';
  for (const ano of anos) {
    const status = estado.resumo[String(ano)]?.RAG?.status ?? [];
    const total = status.reduce((a, [, n]) => a + n, 0);
    const ok = status.filter(([st]) => aprovado(st)).reduce((a, [, n]) => a + n, 0);
    if (total && ok / total >= 0.5) return ano;
  }
  return anos[0];
}

async function iniciar() {
  iniciarTema();
  const [municipios, resumo, mapa, malha] = await Promise.all([
    carregar('data/municipios.json'), carregar('data/resumo.json'), carregar('data/mapa.json'), carregar('geo/pe-municipios.json'),
  ]);
  if (!municipios) {
    $('area').replaceChildren(h('p', { class: 'aviso', text: 'Os dados ainda não foram gerados. Rode export/exportar_site.py.' }));
    return;
  }
  for (const porTipo of Object.values(resumo ?? {})) for (const r of Object.values(porTipo)) r.classes = detalharClasses(r.classes, r.faixas);
  Object.assign(estado, { municipios, resumo, mapa, malha });
  if (!resumo || !mapa) {
    $('area').before(h('p', { class: 'aviso', role: 'alert', text: 'Os dados estão em um formato antigo (faltam resumo.json e mapa.json). Rode export/exportar_site.py para gerar de novo.' }));
    $('area').hidden = true;
    return;
  }
  const p = new URLSearchParams(location.hash.slice(1));
  const lista = municipios.municipios;
  estado.mun = lista.some((m) => m.id === p.get('m')) ? p.get('m') : '';
  const anoHash = Number(p.get('a'));
  estado.ano = municipios.anos.includes(anoHash) ? anoHash : anoPadrao();
  estado.rel = RELATORIOS.some((d) => d.chave === p.get('r')) ? p.get('r') : 'rag';
  estado.meta = p.get('meta');

  preencherFiltros();
  renderRodape();
  await atualizar();
}

iniciar();
