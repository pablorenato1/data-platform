// Site estático: lê os JSON gerados por export/exportar_site.py (pasta data/) e desenha a página.
import {
  $, h, s, numero, porcento, carregar, limitar, rotuloStatus, ligarDica, segmentado,
  esconderDica, barraClasses, legendaClasses, RELATORIOS, CLASSES, SEM_PROJETO, faixaParcial, detalharClasses,
} from './util.js?v=20261112s';

const estado = {
  municipios: null, resumo: null, resumoMeso: null, mapa: null, malha: null, mesoDe: new Map(),
  pagina: 'panorama', munResumo: null, statusMun: '',
  meso: '', mun: null, ano: null, rel: 'rag', meta: null, indicador: 0,
  modo: 'quantidade', nivel: 'diretriz', abertos: new Set(),
  relDados: null, metasDados: null,
};

const tipoDe = (chave) => RELATORIOS.find((d) => d.chave === chave);
const MESORREGIOES = ['Metropolitana de Recife', 'Mata Pernambucana', 'Agreste Pernambucano', 'Sertão Pernambucano', 'São Francisco Pernambucano'];
const NOMES_MESO = { 'Mata Pernambucana': 'Zona da Mata' };
const rotuloMeso = (m) => NOMES_MESO[m] ?? m;
const lugar = () => (estado.meso ? rotuloMeso(estado.meso) : 'Pernambuco');
const resumoAtual = () => (estado.meso ? estado.resumoMeso?.[estado.meso] : estado.resumo);
const noRegiao = (id) => !estado.meso || estado.mesoDe.get(id) === estado.meso;
const situacaoDoMun = (id) => estado.munResumo?.[id]?.[String(estado.ano)]?.[tipoDe(estado.rel).tipo]?.s || 'sem_dados';
const statusOk = (id) => !estado.statusMun || !estado.munResumo || situacaoDoMun(id) === estado.statusMun;
// Mesorregião e situação do relatório escolhidas nos filtros (números, mapa, distribuição, alcance e regiões)
const noLugar = (id) => noRegiao(id) && statusOk(id);
const totalDoLugar = () => estado.municipios.municipios.filter((m) => noLugar(m.id)).length;
const totalDaRegiao = () => estado.municipios.municipios.filter((m) => noRegiao(m.id)).length;


// Soma indicadores por classe, faixas e situações de um conjunto de municípios (a partir de municipios_resumo.json)
function agregar(ids, ano, tipo) {
  const status = new Map(); const faixas = new Map();
  const classes = { atingida: 0, parcial: 0, zero: 0, sem_valor: 0 };
  for (const id of ids) {
    const r = estado.munResumo?.[id]?.[ano]?.[tipo];
    if (!r) continue;
    status.set(r.s || 'sem_dados', (status.get(r.s || 'sem_dados') || 0) + 1);
    classes.atingida += r.c[0] || 0; classes.parcial += r.c[1] || 0; classes.zero += r.c[2] || 0; classes.sem_valor += r.c[3] || 0;
    for (const [o, q] of r.f) faixas.set(o, (faixas.get(o) || 0) + q);
  }
  return { status: [...status], classes: detalharClasses(classes, [...faixas]), faixas: [...faixas] };
}

// Resumo do ano para o painel: o da região, ou o recalculado quando há filtro de situação
function resumoDoAno(ano) {
  if (!estado.statusMun || !estado.munResumo) return resumoAtual()?.[ano];
  const ids = estado.municipios.municipios.filter((m) => noLugar(m.id)).map((m) => m.id);
  const saida = {};
  for (const d of RELATORIOS) saida[d.tipo] = agregar(ids, ano, d.tipo);
  const base = resumoAtual()?.[ano]?.[tipoDe(estado.rel).tipo];
  if (base) saida[tipoDe(estado.rel).tipo].statusRegiao = base.status; // as barras de situação mostram a região toda
  return saida;
}

const FRASE_FILTRO = () => (estado.statusMun ? `Mostra todos os municípios, sem o filtro de situação.` : '');

// Situações que existem no ano e relatório escolhidos (dentro da mesorregião), com a contagem
function preencherStatus() {
  if (!estado.munResumo) return;
  const contagem = new Map();
  for (const m of estado.municipios.municipios) if (noRegiao(m.id)) contagem.set(situacaoDoMun(m.id), (contagem.get(situacaoDoMun(m.id)) || 0) + 1);
  if (estado.statusMun && !contagem.has(estado.statusMun)) estado.statusMun = '';
  const ordenadas = [...contagem.keys()].sort((a, b) => ORDEM_STATUS.indexOf(a) - ORDEM_STATUS.indexOf(b));
  const total = [...contagem.values()].reduce((a, n) => a + n, 0);
  $('filtro-status').replaceChildren(h('option', { value: '', text: `Todas as situações (${numero(total, 0)})` }),
    ...ordenadas.map((st) => h('option', { value: st, text: `${rotuloStatus(st)} (${numero(contagem.get(st), 0)})` })));
  $('filtro-status').value = estado.statusMun;
}
const PAGINAS = ['panorama', 'municipios', 'municipio', 'sobre'];
const REPOSITORIO = 'https://github.com/pablorenato1/data-platform';
const semAcento = (t) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
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
  const resumo = resumoDoAno(ano);
  const mun = estado.mun;
  const nomeMun = mun ? nomeDe(mun) : null;
  $('t-estado').textContent = mun ? `${lugar()} em ${ano}, com destaque para ${nomeMun}` : `${lugar()} em ${ano}`;
  const faixa = $('faixa-filtro');
  if (estado.statusMun) {
    const n = totalDoLugar();
    faixa.textContent = `Filtro ativo: ${tipoDe(estado.rel).tipo} de ${ano}, situação “${rotuloStatus(estado.statusMun)}” (${numero(n, 0)} ${n === 1 ? 'município' : 'municípios'}${estado.meso ? ` em ${rotuloMeso(estado.meso)}` : ''}). Os números, o mapa, a distribuição, o alcance dos indicadores e as mesorregiões mostram só esses municípios.`;
    faixa.hidden = false;
  } else faixa.hidden = true;
  const verDetalhes = $('ver-detalhes');
  verDetalhes.hidden = !mun;
  if (mun) verDetalhes.textContent = `Abrir a página de ${nomeMun}`;
  const def = tipoDe(estado.rel);
  const dados = resumo?.[def.tipo];
  const porTipoMun = mun ? new Map((estado.relDados?.anos?.[ano] ?? []).map((r) => [r.tipo, r])) : null;
  const relMun = porTipoMun?.get(def.tipo);
  if (!dados) {
    $('kpis').replaceChildren();
    for (const id of ['estado-status', 'estado-classes', 'estado-mapa', 'estado-distribuicao', 'estado-evolucao', 'estado-meso']) $(id).replaceChildren(h('p', { class: 'painel-vazio', text: 'Sem dados para este ano.' }));
    return;
  }

  // indicadores
  const classes = dados.classes;
  const totalInd = CLASSES.reduce((a, c) => a + (classes[c.chave] || 0), 0);
  const semDados = (dados.status.find(([st]) => st === 'sem_dados') ?? [, 0])[1];
  const totalMun = totalDoLugar();
  const kpi = (rotulo, valor, nota, texto = false) => h('div', { class: 'kpi' },
    h('div', { class: 'kpi-rotulo', text: rotulo }), h('div', { class: `kpi-valor${texto ? ' texto' : ''}`, text: valor }), h('div', { class: 'kpi-nota', text: nota }));
  const pctPE = totalInd ? ((classes.atingida || 0) / totalInd) * 100 : null;
  if (mun) {
    const statusMun = relMun && relMun.tem_dados && relMun.status ? relMun.status : 'sem_dados';
    const mesmos = ((dados.statusRegiao ?? dados.status).find(([st]) => st === statusMun) ?? [, 0])[1];
    const indMun = relMun?.qtd_indicadores ?? 0;
    const pctMun = indMun ? ((relMun.classes.atingida || 0) / indMun) * 100 : null;
    $('kpis').replaceChildren(
      kpi(`Situação do ${def.tipo} em ${nomeMun}`, rotuloStatus(statusMun), `${numero(mesmos, 0)} de ${numero(totalDaRegiao(), 0)} municípios na mesma situação`, true),
      kpi(`Indicadores em ${nomeMun}`, numero(indMun, 0), `${lugar()}: ${numero(totalInd, 0)}`),
      kpi('Indicadores atingidos', pctMun == null ? '–' : porcento(pctMun, 0), `${indMun ? `${numero(relMun.classes.atingida || 0, 0)} de ${numero(indMun, 0)} indicadores. ` : ''}${lugar()}: ${pctPE == null ? '–' : porcento(pctPE, 0)}`));
  } else {
    $('kpis').replaceChildren(
      kpi(estado.statusMun || estado.meso ? 'Municípios no filtro' : 'Municípios na extração', `${numero(totalMun - semDados, 0)} de ${numero(estado.municipios.total_municipios, 0)}`, [`${def.tipo}, ${ano}`, estado.meso ? rotuloMeso(estado.meso) : null, estado.statusMun ? rotuloStatus(estado.statusMun) : null].filter(Boolean).join(', ')),
      kpi('Indicadores', numero(totalInd, 0), `somando os municípios, ${def.tipo}`),
      kpi('Indicadores atingidos', pctPE == null ? '–' : porcento(pctPE, 0), 'alcance de 100% ou mais'));
  }

  // situação dos relatórios dos municípios
  const ordenado = [...(dados.statusRegiao ?? dados.status)].sort((a, b) => ORDEM_STATUS.indexOf(a[0]) - ORDEM_STATUS.indexOf(b[0]));
  $('estado-status').replaceChildren(
    h('h3', { text: `Situação do ${def.tipo} nos municípios` }),
    h('p', { class: 'sub', text: mun ? `Quantos municípios estão em cada situação. A situação de ${nomeMun} está marcada.` : (estado.statusMun ? 'Quantos municípios estão em cada situação, como informada no DigiSUS. A situação escolhida no filtro está marcada; esta barra mostra todos para dar a proporção.' : 'Quantos municípios estão em cada situação, como informada no DigiSUS.') }),
    barrasStatus(ordenado, mun ? (relMun && relMun.tem_dados && relMun.status ? relMun.status : 'sem_dados') : (estado.statusMun || null), mun ? nomeMun : 'filtro ativo'));

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
    linhasTabela.push(h('tr', { class: 'inicio-grupo' }, h('td', { class: 'col-relatorio', text: d.tipo }), h('td', { text: lugar() }),
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
    h('p', { class: 'sub', text: mun ? `Município escolhido, nos quatro relatórios (${lugar()} está na tabela, abaixo). Cada RDQA vale só para o seu quadrimestre; o RAG, para o ano inteiro.` : `Todos os municípios ${estado.meso ? 'da mesorregião ' : ''}somados. Cada RDQA vale só para o seu quadrimestre; o RAG, para o ano inteiro.` }),
    ...linhas, legendaClasses());
  $('estado-tabela').replaceChildren(
    h('details', { class: 'tabela-alt tabela-solta' }, h('summary', { text: 'Ver como tabela: alcance dos indicadores por relatório' }), h('div', { class: 'rolagem' }, tabela)));

  renderMeso();
  renderMapa();
  renderDistribuicao();
  renderEvolucaoMapa();
}

// ---------- mapa ----------
const FAIXAS_MAPA = [
  { ate: 20, rotulo: '20% a 0%' }, { ate: 40, rotulo: '40% a 20%' }, { ate: 60, rotulo: '60% a 40%' },
  { ate: 80, rotulo: '80% a 60%' }, { ate: Infinity, rotulo: '100% a 80%' },
];
const faixaMapa = (pct) => FAIXAS_MAPA.findIndex((f) => pct < f.ate);

// Aproximar e afastar o mapa (botões + e −; com zoom, arrastar move o mapa). O zoom é guardado em estado.zoom
// e sobrevive a um novo desenho do mapa (por exemplo, ao escolher um município).
function caixaComZoom(svg, malha) {
  const z = estado.zoom ?? (estado.zoom = { k: 1, cx: malha.largura / 2, cy: malha.altura / 2 });
  const botoes = {};
  const aplicar = () => {
    // com zoom a área visível fica mais alta (4:3), senão o mapa viraria uma faixa fina
    const w = malha.largura / z.k, alt = z.k > 1 ? (w * 3) / 4 : malha.altura;
    z.cx = Math.min(Math.max(z.cx, w / 2), malha.largura - w / 2);
    z.cy = alt >= malha.altura ? malha.altura / 2 : Math.min(Math.max(z.cy, alt / 2), malha.altura - alt / 2);
    svg.setAttribute('viewBox', `${z.cx - w / 2} ${z.cy - alt / 2} ${w} ${alt}`);
    svg.classList.toggle('ampliado', z.k > 1);
    botoes.mais.disabled = z.k >= 8;
    botoes.menos.disabled = z.k <= 1;
    botoes.deslizante.value = String(z.k);
  };
  const mudar = (fator) => definir(z.k * fator);
  const definir = (novo) => {
    if (z.k === 1 && novo > 1) {
      const sel = svg.querySelector('.selecionado'); // a primeira aproximação centra no município escolhido
      if (sel) { const b = sel.getBBox(); z.cx = b.x + b.width / 2; z.cy = b.y + b.height / 2; }
    }
    z.k = Math.min(8, Math.max(1, novo));
    if (z.k === 1) { z.cx = malha.largura / 2; z.cy = malha.altura / 2; }
    aplicar();
  };
  const botao = (chave, texto, rotulo, aoClicar) => {
    const b = h('button', { type: 'button', 'aria-label': rotulo, title: rotulo, text: texto });
    b.addEventListener('click', aoClicar);
    botoes[chave] = b;
    return b;
  };
  const deslizante = h('input', { type: 'range', min: '1', max: '8', step: '0.05', value: String(z.k), 'aria-label': 'Aproximação do mapa' });
  deslizante.addEventListener('input', () => definir(Number(deslizante.value)));
  const controles = h('div', { class: 'zoom-mapa' },
    botao('menos', '−', 'Afastar o mapa', () => mudar(1 / 1.5)),
    deslizante,
    botao('mais', '+', 'Aproximar o mapa', () => mudar(1.5)));
  botoes.deslizante = deslizante;

  let arraste = null, moveu = false;
  svg.addEventListener('pointerdown', (e) => {
    if (z.k === 1) return;
    arraste = { x: e.clientX, y: e.clientY, cx: z.cx, cy: z.cy }; moveu = false;
  });
  svg.addEventListener('pointermove', (e) => {
    if (!arraste) return;
    const dx = e.clientX - arraste.x, dy = e.clientY - arraste.y;
    if (!moveu && Math.abs(dx) + Math.abs(dy) < 6) return;
    moveu = true; esconderDica();
    const escala = (malha.largura / z.k) / svg.getBoundingClientRect().width;
    z.cx = arraste.cx - dx * escala; z.cy = arraste.cy - dy * escala;
    aplicar();
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) svg.addEventListener(ev, () => { arraste = null; });
  // depois de arrastar, o toque final não deve escolher o município que está embaixo
  svg.addEventListener('click', (e) => { if (moveu) { e.stopPropagation(); moveu = false; } }, true);

  aplicar();
  return h('div', { class: 'mapa-caixa' }, controles, svg);
}

function renderMapa() {
  const alvo = $('estado-mapa');
  const def = tipoDe(estado.rel);
  const dados = estado.mapa?.[String(estado.ano)]?.[def.tipo] ?? {};
  const malha = estado.malha;
  const titulo = [
    h('h3', { text: `Indicadores atingidos por município, ${def.tipo}` }),
    h('p', { class: 'sub', text: 'Participação dos indicadores com alcance de 100% ou mais. Sem ordenação entre municípios.' }),
  ];
  if (!malha) {
    alvo.replaceChildren(...titulo, h('p', { class: 'painel-vazio', text: 'Mapa indisponível.' }));
    return;
  }
  const svg = s('svg', { class: 'mapa', viewBox: `0 0 ${malha.largura} ${malha.altura}`, role: 'img', 'aria-label': 'Mapa de Pernambuco colorido pela participação de indicadores atingidos em cada município' });
  for (const [id, d] of Object.entries(malha.municipios)) {
    const dado = dados[id];
    const pct = dado ? (dado[0] / dado[1]) * 100 : null;
    const caminho = s('path', { d, class: `mun-mapa ${pct == null ? 'mapa-sem' : `mapa-${faixaMapa(pct)}`}${id === estado.mun ? ' selecionado' : ''}${noLugar(id) ? '' : ' fora'}` });
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
    (estado.meso || estado.statusMun) ? h('li', {}, h('span', { class: 'chave fora' }), h('span', { text: estado.statusMun ? 'fora do filtro' : `fora de ${lugar()}` })) : null,
  ]);
  const notaLegenda = h('p', { class: 'nota-tabela', text: 'Em cada faixa, o limite menor está incluído e o maior não (a primeira vai até 100%).' });
  const linhas = Object.keys(dados).filter(noLugar)
    .sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), 'pt-BR'))
    .map((id) => h('tr', {}, h('td', { text: nomeDe(id) }), h('td', { class: 'num', text: numero(dados[id][0], 0) }),
      h('td', { class: 'num', text: numero(dados[id][1], 0) }), h('td', { class: 'num', text: porcento((dados[id][0] / dados[id][1]) * 100, 0) })));
  // qual município está escolhido, por escrito (a altura é reservada, então nada se mexe ao escolher)
  const dadoMun = estado.mun ? dados[estado.mun] : null;
  const selecao = h('p', { class: 'mapa-selecao', role: 'status', text: !estado.mun
    ? 'Clique ou toque em um município para ver o nome e o resultado dele.'
    : dadoMun ? `${nomeDe(estado.mun)}: ${porcento((dadoMun[0] / dadoMun[1]) * 100, 0)} atingidos (${numero(dadoMun[0], 0)} de ${numero(dadoMun[1], 0)} indicadores)`
      : `${nomeDe(estado.mun)}: sem indicadores neste relatório` });
  if (estado.mun) selecao.classList.add('ativa');
  alvo.replaceChildren(...titulo, caixaComZoom(svg, malha), selecao, legenda, notaLegenda,
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


// ---------- distribuição dos municípios ----------
// Quantos municípios caem em cada faixa de 10 pontos de indicadores atingidos. Não ordena municípios: só conta.
function renderDistribuicao() {
  const alvo = $('estado-distribuicao');
  const def = tipoDe(estado.rel);
  const dados = estado.mapa?.[String(estado.ano)]?.[def.tipo] ?? {};
  const faixaDe = (pct) => Math.min(9, Math.floor(pct / 10));
  const contagem = Array(10).fill(0);
  for (const [id, [at, total]] of Object.entries(dados)) if (total && noLugar(id)) contagem[faixaDe((at / total) * 100)] += 1;
  const total = contagem.reduce((a, n) => a + n, 0);
  const maximo = Math.max(1, ...contagem);
  const dadoMun = estado.mun ? dados[estado.mun] : null;
  const faixaMun = dadoMun && dadoMun[1] ? faixaDe((dadoMun[0] / dadoMun[1]) * 100) : -1;
  const rotuloFaixa = (i) => `${i * 10}% a ${i === 9 ? 100 : (i + 1) * 10}%`;
  const sub = estado.mun && faixaMun >= 0
    ? `${nomeDe(estado.mun)} está na faixa de ${rotuloFaixa(faixaMun)} (marcada).`
    : 'Cada coluna é uma faixa de 10 pontos; a altura é o número de municípios.';
  const colunas = contagem.map((n, i) => {
    const col = h('div', { class: `col-dist${i === faixaMun ? ' destaque' : ''}`, tabindex: 0, role: 'img',
      'aria-label': `${rotuloFaixa(i)}: ${n} ${n === 1 ? 'município' : 'municípios'}${i === faixaMun ? `, faixa de ${nomeDe(estado.mun)}` : ''}` },
      h('span', { class: 'val-dist', text: numero(n, 0) }),
      h('div', { class: `barra-dist mapa-${faixaMapa(i * 10 + 5)}`, style: `height:${Math.max(n ? 3 : 0, (n / maximo) * 100)}%` }),
      h('span', { class: 'eixo-dist', text: String(i * 10) }));
    ligarDica(col, `${numero(n, 0)} ${n === 1 ? 'município' : 'municípios'}`, rotuloFaixa(i));
    return col;
  });
  alvo.replaceChildren(
    h('h3', { text: `Como os municípios se distribuem no ${def.tipo}` }),
    h('p', { class: 'sub', text: total ? sub : 'Sem indicadores neste relatório.' }),
    h('div', { class: 'dist' }, colunas),
    h('p', { class: 'nota-tabela', text: 'Eixo: participação dos indicadores com alcance de 100% ou mais, em % (início de cada faixa).' }));
}

// ---------- o mapa ao longo dos anos ----------
// Caixa (viewBox) que enquadra um município, com a mesma proporção do mapa inteiro, para os mini-mapas dos anos.
const enquadramentos = new Map();
function enquadrar(id, malha) {
  if (enquadramentos.has(id)) return enquadramentos.get(id);
  const teste = s('svg', { viewBox: `0 0 ${malha.largura} ${malha.altura}`, style: 'position:absolute;visibility:hidden;width:0;height:0', 'aria-hidden': 'true' });
  teste.append(s('path', { d: malha.municipios[id] }));
  document.body.append(teste);
  const b = teste.firstChild.getBBox();
  teste.remove();
  const proporcao = malha.largura / malha.altura;
  let w = b.width * 1.2, alt = b.height * 1.2;
  if (w / alt < proporcao) w = alt * proporcao; else alt = w / proporcao;
  const caixa = `${b.x + b.width / 2 - w / 2} ${b.y + b.height / 2 - alt / 2} ${w} ${alt}`;
  enquadramentos.set(id, caixa);
  return caixa;
}

function renderEvolucaoMapa() {
  const alvo = $('estado-evolucao');
  const def = tipoDe(estado.rel);
  const malha = estado.malha;
  if (!malha) { alvo.replaceChildren(); return; }
  const anos = [...estado.municipios.anos].sort((a, b) => a - b);
  const itens = [];
  for (const ano of anos) {
    const dados = estado.mapa?.[String(ano)]?.[def.tipo] ?? {};
    // com um município escolhido, cada mini-mapa mostra só ele
    const ids = estado.mun ? (dados[estado.mun] ? [estado.mun] : []) : Object.keys(dados).filter(noRegiao);
    if (!ids.length) continue;
    const at = ids.reduce((a, id) => a + dados[id][0], 0);
    const tot = ids.reduce((a, id) => a + dados[id][1], 0);
    const svg = s('svg', { class: 'mini-mapa-svg', viewBox: estado.mun ? enquadrar(estado.mun, malha) : `0 0 ${malha.largura} ${malha.altura}`, 'aria-hidden': 'true', focusable: 'false' });
    for (const [id, d] of Object.entries(malha.municipios)) {
      if (estado.mun && id !== estado.mun) continue;
      const dado = dados[id];
      const pct = dado && dado[1] ? (dado[0] / dado[1]) * 100 : null;
      svg.append(s('path', { d, class: `${pct == null ? 'mapa-sem' : `mapa-${faixaMapa(pct)}`}${noRegiao(id) ? '' : ' fora'}` }));
    }
    const andamento = ano === new Date().getFullYear();
    const botao = h('button', { type: 'button', class: `mini-mapa${ano === estado.ano ? ' atual' : ''}`, 'aria-pressed': String(ano === estado.ano),
      'aria-label': `${ano}: ${tot ? porcento((at / tot) * 100, 0) : '–'} dos indicadores atingidos${andamento ? ' (ano em andamento)' : ''}. Ver este ano` },
      svg,
      h('span', { class: 'mini-ano', text: String(ano) }),
      h('span', { class: 'mini-valor', text: tot ? `${porcento((at / tot) * 100, 0)} atingidos${andamento ? ', em andamento' : ''}` : '–' }));
    botao.addEventListener('click', () => { estado.ano = ano; $('sel-ano').value = String(ano); estado.meta = null; atualizar(); });
    itens.push(botao);
  }
  alvo.replaceChildren(
    h('h3', { text: `${estado.mun ? `${nomeDe(estado.mun)} ao longo dos anos` : 'O mapa ao longo dos anos'}, ${def.tipo}` }),
    h('p', { class: 'sub', text: `As cores são as do mapa principal${estado.mun ? ` (aqui, só ${nomeDe(estado.mun)})` : ''}. Escolha um ano para ver os números dele.` + (estado.statusMun ? ` ${FRASE_FILTRO()}` : '') }),
    h('div', { class: 'mini-mapas' }, itens));
}

// ---------- mesorregiões ----------
// As cinco mesorregiões do IBGE, sempre na mesma ordem (de leste a oeste), sem classificação entre elas.
function renderMeso() {
  const alvo = $('estado-meso');
  const def = tipoDe(estado.rel);
  const ano = String(estado.ano);
  const linhas = MESORREGIOES.filter((m) => estado.resumoMeso?.[m]).map((m) => {
    const ids = estado.statusMun ? estado.municipios.municipios.filter((x) => x.mesorregiao === m && statusOk(x.id)).map((x) => x.id) : null;
    const dados = ids ? agregar(ids, ano, def.tipo) : estado.resumoMeso[m]?.[ano]?.[def.tipo];
    const classes = dados?.classes ?? {};
    const total = CLASSES.reduce((a, c) => a + (classes[c.chave] || 0), 0);
    const qtd = ids ? ids.length : estado.municipios.municipios.filter((x) => x.mesorregiao === m).length;
    const doMunicipio = Boolean(estado.mun) && estado.mesoDe.get(estado.mun) === m;
    const botao = h('button', { type: 'button', class: `linha-meso${m === estado.meso ? ' atual' : ''}${doMunicipio ? ' do-municipio' : ''}`, 'aria-pressed': String(m === estado.meso) },
      h('span', { class: 'meso-nome' }, h('strong', { text: rotuloMeso(m) }), h('span', { text: `${numero(qtd, 0)} municípios` }),
        doMunicipio ? h('span', { class: 'marca-mun', text: `● ${limitar(nomeDe(estado.mun), 26)}` }) : null),
      total ? barraClasses(classes, 'percentual', 1) : h('span', { class: 'barra-vazia', text: 'sem indicadores' }),
      h('span', { class: 'meso-valor', text: total ? porcento((classes.atingida / total) * 100, 0) : '–' }));
    botao.addEventListener('click', (e) => { if (e.target.closest('.segmento')) return; selecionarMeso(m === estado.meso ? '' : m); });
    return botao;
  });
  alvo.replaceChildren(
    h('h3', { text: `Alcance dos indicadores por mesorregião, ${def.tipo}` }),
    h('p', { class: 'sub', text: 'As cinco mesorregiões do IBGE, de leste a oeste. O número à direita é a parte dos indicadores com alcance de 100% ou mais. Clique em uma para ver só os municípios dela; clique de novo para voltar a Pernambuco.' + (estado.mun ? ` A região de ${nomeDe(estado.mun)} está marcada.` : '') }),
    h('div', { class: 'linhas-meso' }, linhas), legendaClasses());
}

function selecionarMeso(meso) {
  estado.meso = meso;
  if (estado.mun && !noRegiao(estado.mun)) { estado.mun = ''; estado.meta = null; estado.indicador = 0; }
  $('sel-meso').value = meso;
  preencherMunicipios();
  atualizar();
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
      h('div', { class: 'numero-legenda', text: 'dos indicadores' }),
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
          ...CLASSES.map((c) => h('th', { class: 'num', title: `${c.rotulo}: ${c.regra}` },
            c.rotulo, h('span', { class: 'faixa-coluna', text: c.regra }))), h('th', { class: 'num', text: 'Mediana do alcance' }))),
        h('tbody', {}, linhas))),
      h('p', { class: 'nota-tabela', text: 'Parcial é dividido em três faixas, só para exibição: baixo (acima de 0 e abaixo de 40%), médio (40% a menos de 80%) e alto (80% a menos de 100%). Um município só tem parcial quando algum indicador informa um valor entre 0 e 100; quando os valores são sempre 0 ou 100 ou campo vazio, como em Ribeirão, essas três colunas ficam em 0. A mediana considera só os indicadores com valor (ignora os campos vazios). Como os valores costumam se concentrar em 0 e em 100, ela tende a saltar entre os dois e não substitui a divisão por classes.' })));
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

// Unidade que o município marcou na meta (o painel usa a mesma para decidir se escreve "%")
const ROTULO_UNIDADE = { percentual: 'Percentual', quantidade: 'Número', proporcao: 'Proporção', razao: 'Razão', monetario: 'Moeda', taxa: 'Taxa', indice: 'Índice', decimal: 'Decimal' };

function tabelaMetas(metas, chave) {
  const linhas = [];
  for (const meta of metas) {
    meta.indicadores.forEach((ind, i) => {
      const r = ind.rel[chave];
      const presente = r && r.status != null;
      const classe = presente ? CLASSES.find((c) => c.chave === classeDetalhada(r)) : null;
      linhas.push(h('tr', {},
        h('td', { class: 'col-meta', text: i === 0 ? `${meta.ordem} · ${meta.descricao ?? ''}` : '' }),
        h('td', { class: 'col-ind', 'data-rotulo': 'Indicador', text: ind.nome ?? '' }),
        h('td', { class: 'col-unidade', 'data-rotulo': 'Unidade', text: ROTULO_UNIDADE[meta.tipo_valor] ?? '–' }),
        h('td', { class: 'num', 'data-rotulo': 'Plano', text: presente ? formatarValor(r.plano, meta.tipo_valor) : '–' }),
        h('td', { class: 'num', 'data-rotulo': 'Executado', text: presente ? formatarValor(r.executado, meta.tipo_valor) : '–' }),
        h('td', { class: 'num', 'data-rotulo': 'Alcance', text: presente && r.alcancado != null ? porcento(r.alcancado, 2) : '–' }),
        h('td', { class: 'col-classe' }, classe
          ? h('span', { class: 'etiqueta-classe' }, h('span', { class: `chave seg-${classe.chave}` }), classe.rotulo)
          : h('span', { class: 'etiqueta-classe', text: 'Indicador não consta neste relatório' }))));
    });
  }
  return h('div', { class: 'rolagem' }, h('table', { class: 'tabela-metas' },
    h('thead', {}, h('tr', {}, h('th', { text: 'Meta' }), h('th', { text: 'Indicador' }),
      h('th', { title: 'Unidade que o município marcou na meta', text: 'Unidade' }),
      h('th', { class: 'num', text: 'Plano' }), h('th', { class: 'num', text: 'Executado' }),
      h('th', { class: 'num', title: 'Valor informado pelo DigiSUS, sem recálculo', text: 'Alcance (DigiSUS)' }), h('th', { text: 'Classe' }))),
    h('tbody', {}, linhas)));
}

const CODIGO_PROJETO = { '1q': 10, '2q': 11, '3q': 12, rag: 13 };

// Endereço da API do DigiSUS com os dados originais do município, ano e relatório escolhidos
function enderecoFonte() {
  const q = new URLSearchParams({ co_esfera: '1', sg_uf: 'PE', co_municipio_ibge: estado.mun, nu_ano_exercicio: String(estado.ano), co_projeto_tipo: String(CODIGO_PROJETO[estado.rel]) });
  return `https://digisusgmp.saude.gov.br/v1.5/api/relatorio/resultados-metas?${q}`;
}

function renderArvore() {
  const alvo = $('arvore');
  const todos = estado.metasDados;
  const def = tipoDe(estado.rel);
  const chave = def.chave;
  $('t-arvore-rel').textContent = def.tipo;
  $('fonte-link').replaceChildren('Conferir na fonte: ',
    h('a', { href: enderecoFonte(), target: '_blank', rel: 'noopener noreferrer', text: `dados originais do ${def.tipo} no DigiSUS` }),
    ' (abre o arquivo JSON da API, sem tratamento).');
  if (!todos || !todos.diretrizes.length) {
    alvo.replaceChildren(h('p', { class: 'painel-vazio', text: 'Este município não tem metas registradas neste ano.' }));
    return;
  }

  // Só entra o que consta no relatório escolhido. Os indicadores que existem em outros relatórios do ano
  // (o município pode trocar o indicador de uma meta de um relatório para o outro) ficam fora, e uma nota avisa quantos são.
  const consta = (ind) => ind.rel[chave]?.status != null;
  const apenasDoRelatorio = (diretrizes) => diretrizes
    .map((d) => ({ ...d, objetivos: d.objetivos
      .map((o) => ({ ...o, metas: o.metas.map((m) => ({ ...m, indicadores: m.indicadores.filter(consta) })).filter((m) => m.indicadores.length) }))
      .filter((o) => o.metas.length) }))
    .filter((d) => d.objetivos.length);
  const ausentes = todos.diretrizes.flatMap((d) => d.objetivos).flatMap((o) => o.metas).flatMap((m) => m.indicadores).filter((i) => !consta(i)).length;
  const dados = estado.mostrarAusentes ? todos : { ...todos, diretrizes: apenasDoRelatorio(todos.diretrizes) };
  const notaAusentes = ausentes ? h('p', { class: 'nota-tabela nota-ausentes' },
    `${numero(ausentes, 0)} ${ausentes === 1 ? 'indicador' : 'indicadores'} deste ano ${ausentes === 1 ? 'não consta' : 'não constam'} no ${def.tipo} (${ausentes === 1 ? 'aparece' : 'aparecem'} só em outros relatórios) e ${estado.mostrarAusentes ? 'estão sendo mostrados' : 'não são mostrados aqui'}. `,
    (() => {
      const b = h('button', { type: 'button', class: 'botao-link', text: estado.mostrarAusentes ? 'Ocultar' : 'Mostrar mesmo assim' });
      b.addEventListener('click', () => { estado.mostrarAusentes = !estado.mostrarAusentes; renderArvore(); });
      return b;
    })()) : null;
  if (!dados.diretrizes.length) {
    alvo.replaceChildren(h('p', { class: 'painel-vazio', text: `Este município não tem indicadores no ${def.tipo} deste ano.` }), ...(notaAusentes ? [notaAusentes] : []));
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
        h('div', { class: 'abrir-fechar' },
          botao('Abrir tudo', () => { chavesDoNivel.forEach((k) => estado.abertos.add(k)); renderArvore(); }),
          botao('Fechar tudo', () => { chavesDoNivel.forEach((k) => estado.abertos.delete(k)); renderArvore(); }))),
      legendaClasses()),
    ...(notaAusentes ? [notaAusentes] : []),
    ...lista);
}

// ---------- evolução do RAG pelos anos ----------
function renderEvolucaoAnos(doEstado) {
  const sufixo = doEstado ? '' : '-mun';
  const def = tipoDe(estado.rel);
  $(`t-anos${sufixo}`).textContent = `${def.tipo} ao longo dos anos${doEstado ? `, ${estado.meso ? `em ${rotuloMeso(estado.meso)}` : 'em Pernambuco'}` : ''}`;
  const natureza = def.chave === 'rag' ? 'relatório anual' : 'relatório do quadrimestre';
  $(`anos-legenda${sufixo}`).textContent = `Como ficou o ${def.tipo} (${natureza}) de cada ano${doEstado ? ', somando todos os municípios' + (estado.meso ? ' da mesorregião' : '') : ''}. Cada barra mostra as classes de alcance dos indicadores daquele ano, e o número à direita é a parte dos indicadores que atingiu a meta.${doEstado && estado.statusMun ? ' ' + FRASE_FILTRO() : ''}`;
  const anos = [...estado.municipios.anos].sort((a, b) => a - b);
  const linhas = anos.map((ano) => {
    let classes = null;
    if (doEstado) {
      classes = resumoAtual()?.[String(ano)]?.[def.tipo]?.classes ?? null;
    } else {
      const r = (estado.relDados?.anos?.[String(ano)] ?? []).find((x) => x.tipo === def.tipo);
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
  $(`anos${sufixo}`).replaceChildren(...linhas, legendaClasses());
}


// ---------- aba Municípios ----------
function cartaoMunicipio(m, dadoRel, tipo) {
  const classes = dadoRel ? detalharClasses({ atingida: dadoRel.c[0], parcial: dadoRel.c[1], zero: dadoRel.c[2], sem_valor: dadoRel.c[3] }, dadoRel.f) : null;
  const total = classes ? CLASSES.reduce((a, c) => a + (classes[c.chave] || 0), 0) : 0;
  const status = dadoRel ? (dadoRel.s || 'sem_dados') : 'sem_dados';
  const abrir = () => abrirMunicipio(m.id);
  const nome = h('button', { type: 'button', class: 'nome-mun', text: m.nome, 'aria-label': `${m.nome}: ver detalhes` });
  nome.addEventListener('click', (e) => { e.stopPropagation(); abrir(); });
  const cartao = h('article', { class: 'cartao-mun' },
    h('h4', {}, nome),
    h('div', { class: 'micro-mun', text: `Microrregião ${m.microrregiao}` }),
    h('div', {}, h('span', { class: 'chip', text: rotuloStatus(status) })));
  if (!total) {
    cartao.append(h('p', { class: 'cartao-vazio', text: `Sem indicadores no ${tipo}.` }));
  } else {
    cartao.append(
      h('div', { class: 'pct-mun' }, h('strong', { text: porcento((classes.atingida / total) * 100, 0) }), h('span', { text: ` atingidos (${numero(classes.atingida, 0)} de ${numero(total, 0)})` })),
      barraClasses(classes, 'percentual', 1));
  }
  cartao.addEventListener('click', (e) => { if (!e.target.closest('.segmento')) abrir(); });
  return cartao;
}

async function abrirMunicipio(id) {
  estado.mun = id; estado.meta = null; estado.indicador = 0;
  $('sel-municipio').value = id;
  await mostrarPagina('municipio');
}

function renderMunicipios() {
  const def = tipoDe(estado.rel);
  const ano = String(estado.ano);
  const termo = semAcento($('busca-mun').value.trim());
  const dados = estado.munResumo ?? {};
  let mostrados = 0;
  preencherStatus();
  const situacaoDe = (m) => situacaoDoMun(m.id);
  const grupos = MESORREGIOES.filter((m) => !estado.meso || m === estado.meso).map((meso) => {
    const lista = estado.municipios.municipios
      .filter((m) => m.mesorregiao === meso && (!termo || semAcento(m.nome).includes(termo)) && (!estado.statusMun || situacaoDe(m) === estado.statusMun))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!lista.length) return null;
    mostrados += lista.length;
    const cl = estado.resumoMeso?.[meso]?.[ano]?.[def.tipo]?.classes;
    const tot = cl ? CLASSES.reduce((a, c) => a + (cl[c.chave] || 0), 0) : 0;
    return h('section', { class: 'grupo-meso', 'aria-label': rotuloMeso(meso) },
      h('div', { class: 'cabeca-meso' },
        h('h3', { text: rotuloMeso(meso) }),
        h('span', { text: `${numero(lista.length, 0)} ${lista.length === 1 ? 'município' : 'municípios'}${tot ? `, ${porcento((cl.atingida / tot) * 100, 0)} dos indicadores atingidos na região` : ''}` })),
      h('div', { class: 'grade-mun' }, lista.map((m) => cartaoMunicipio(m, dados[m.id]?.[ano]?.[def.tipo], def.tipo))));
  }).filter(Boolean);
  $('contagem-mun').textContent = `${numero(mostrados, 0)} de ${numero(estado.municipios.total_municipios, 0)} municípios, ${def.tipo} de ${estado.ano}${estado.statusMun ? `, situação: ${rotuloStatus(estado.statusMun)}` : ''}`;
  $('legenda-mun').replaceChildren(legendaClasses());
  $('lista-mun').replaceChildren(...(grupos.length ? grupos : [h('p', { class: 'painel-vazio', text: 'Nenhum município encontrado. Tente outra parte do nome ou outra situação.' })]));
}

// ---------- aba Sobre os dados ----------
function renderSobre() {
  const d = estado.municipios;
  const anos = [...d.anos].sort((a, b) => a - b);
  const anoRef = anoPadrao();
  const cl = estado.resumo?.[String(anoRef)]?.RAG?.classes;
  const indicadores = cl ? CLASSES.reduce((a, c) => a + (cl[c.chave] || 0), 0) : null;
  const quando = dataDosDados(d);
  const fato = (valor, rotulo) => h('div', { class: 'fato' }, h('dd', { text: valor }), h('dt', { text: rotulo }));
  const secao = (titulo, ...filhos) => h('section', { class: 'sobre-secao' }, h('h3', { text: titulo }), h('div', { class: 'sobre-corpo' }, ...filhos));
  const p = (texto) => h('p', { text: texto });
  const link = (texto, url) => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: texto });

  $('pg-sobre').replaceChildren(
    h('div', { class: 'titulo-secao' }, h('h2', { id: 't-sobre', text: 'Sobre os dados' })),
    h('p', { class: 'legenda-secao', text: 'De onde vêm os números deste painel, como chegam até aqui e o que cada um quer dizer.' }),
    h('dl', { class: 'fatos' },
      fato(numero(d.municipios_com_dados, 0), `municípios com dados, de ${numero(d.total_municipios, 0)} exibidos`),
      fato(`${anos[0]}–${anos[anos.length - 1]}`, 'anos cobertos'),
      fato('4', 'relatórios por ano: 1º, 2º e 3º RDQA e RAG'),
      fato(indicadores == null ? '–' : numero(indicadores, 0), `indicadores no RAG de ${anoRef}`),
      fato(quando.data, `${quando.rotulo}, às ${quando.hora}`)),
    h('div', { class: 'sobre-grade' },
    secao('De onde vêm os dados',
      p('A fonte é a API pública do DigiSUS Gestor, do Ministério da Saúde. Os municípios registram ali o planejamento em saúde: diretrizes, objetivos, metas e indicadores, com o que foi planejado (plano), o que foi realizado (executado) e o alcance informado, em cada relatório do ano.'),
      p('Os municípios podem atualizar os dados no DigiSUS a qualquer momento. Este painel, porém, é atualizado uma vez por mês: uma rotina coleta os dados da API, trata e exporta para cá. Por isso o que você vê pode estar um pouco atrás do que está no DigiSUS hoje. A data de atualização, no topo desta página, mostra até quando os dados do DigiSUS estão refletidos aqui.'),
      p('Os valores são mostrados como foram informados, sem correção. Fernando de Noronha não é exibido.')),
    secao('Como o planejamento é registrado',
      p('O município planeja no início e presta contas ao longo do ano, em relatórios com datas fixas:'),
      h('ol', { class: 'etapas' },
        h('li', {}, h('strong', { text: 'Planejamento.' }), h('span', { text: ' O município define o que quer fazer e, para cada indicador, o valor planejado (a coluna de plano).' })),
        h('li', {}, h('strong', { text: 'RDQA, a cada quadrimestre.' }), h('span', { text: ' O gestor informa o que foi executado no período. São três por ano: janeiro a abril, maio a agosto e setembro a dezembro.' })),
        h('li', {}, h('strong', { text: 'RAG, no fim do ano.' }), h('span', { text: ' O Relatório Anual de Gestão traz o executado do ano inteiro e passa pela análise do Conselho de Saúde.' }))),
      p('Para enviar um relatório, o gestor precisa confirmar que revisou todos os campos, inclusive os que ficaram vazios e os preenchidos com 0. O sistema só libera o envio depois dessa confirmação e não sugere nem preenche valores. Por isso tudo o que aparece neste painel, até os zeros e os vazios, é o que o município declarou.')),
    secao('Como os dados são organizados',
      p('Todo plano de saúde segue a mesma estrutura, do mais geral ao mais específico. Cada nível contém os do nível seguinte.'),
      h('div', { class: 'hierarquia' }, [
        ['Diretriz', 'a grande orientação da política de saúde do município, como ampliar o acesso à atenção básica.'],
        ['Objetivo', 'o que o município quer alcançar dentro de uma diretriz. Uma diretriz tem vários objetivos.'],
        ['Meta', 'o resultado concreto que se quer atingir para cumprir um objetivo.'],
        ['Indicador', 'a medida usada para acompanhar a meta. É nele que ficam o plano, o executado e o alcance.'],
      ].map(([nome, texto], i) => h('div', { class: 'nivel', style: `margin-left:${i * 28}px` }, h('strong', { text: nome }), h('span', { text: ` ${texto}` })))),
      p('Quase toda meta tem um único indicador. Algumas poucas têm dois ou três, e nesses casos cada indicador aparece em uma linha própria, abaixo da meta.'),
      p('Para cada indicador, o município informa o plano (o valor que se propôs a atingir), o executado (o que diz ter realizado) e o alcance (o percentual publicado pelo DigiSUS). Isso é registrado em cada um dos 4 relatórios do ano.')),
    secao('Como ler os números',
      h('ul', { class: 'lista-classes' }, CLASSES.map((c) => h('li', {}, h('span', { class: `chave seg-${c.chave}` }), h('span', {}, h('strong', { text: c.rotulo }), ` (${c.regra})`)))),
      p('As classes e a mediana são cálculos deste painel sobre o alcance registrado no DigiSUS. O alcance aparece como foi publicado e, em alguns casos, não bate com executado ÷ plano; o painel não corrige.'),
      p('O painel não avalia se um valor é bom ou ruim. "Atingida" significa apenas que o alcance informado é de 100% ou mais.'),
      p('Zero e campo vazio são declarações do gestor, confirmadas no envio do relatório. O que os dados não mostram é o motivo: um zero pode ser uma meta não cumprida ou uma ação que não se aplicou ao período. Por isso o vermelho não deve ser lido como juízo sobre o município.'),
      p('O painel não ordena municípios.')),
    secao('Código e documentação',
      p('O projeto é aberto e organizado em um único repositório, com o código de cada etapa, as decisões de projeto (ADRs) e o dicionário de dados.'),
      h('p', {}, link('Repositório no GitHub', REPOSITORIO), ' (pasta ', link('docs', `${REPOSITORIO}/tree/main/docs`), ' com decisões e dicionário de dados).'))));
}

// ---------- páginas ----------
async function mostrarPagina(pagina) {
  estado.pagina = PAGINAS.includes(pagina) ? pagina : 'panorama';
  const p = estado.pagina;
  $('pg-panorama').hidden = p !== 'panorama';
  $('pg-municipios').hidden = p !== 'municipios';
  $('pg-municipio').hidden = p !== 'municipio';
  $('pg-sobre').hidden = p !== 'sobre';
  $('filtros').hidden = p === 'sobre';
  $('rot-municipio').hidden = p === 'municipios';
  $('rot-status').hidden = p !== 'municipios' && p !== 'panorama';
  for (const b of document.querySelectorAll('.aba')) {
    if (b.dataset.pagina === p) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  await atualizar();
  if (p !== 'panorama') window.scrollTo({ top: 0 });
}

// ---------- página ----------
function gravarHash() {
  const p = new URLSearchParams({ a: String(estado.ano), r: estado.rel });
  if (estado.pagina !== 'panorama') p.set('p', estado.pagina);
  if (estado.meso) p.set('z', estado.meso);
  if (estado.statusMun) p.set('s', estado.statusMun);
  if (estado.mun) p.set('m', estado.mun);
  if (estado.meta) p.set('meta', estado.meta);
  history.replaceState(null, '', `#${p.toString()}`);
}

// ---------- município: indicadores com plano, plano zero e plano vazio ----------
const PARTES_PLANO = [
  { chave: 'com', rotulo: 'Com plano', regra: 'plano maior que zero' },
  { chave: 'zero', rotulo: 'Plano zero', regra: 'plano igual a zero' },
  { chave: 'vazio', rotulo: 'Plano vazio', regra: 'campo do plano não preenchido' },
];

function contarPlano(chave) {
  const c = { com: 0, zero: 0, vazio: 0, zeroComExecutado: 0 };
  for (const dz of estado.metasDados?.diretrizes ?? []) for (const o of dz.objetivos) for (const m of o.metas) for (const ind of m.indicadores) {
    const r = ind.rel[chave];
    if (!r || r.status == null) continue; // o indicador não consta neste relatório
    if (r.plano == null) c.vazio += 1;
    else if (r.plano === 0) { c.zero += 1; if ((r.executado || 0) > 0) c.zeroComExecutado += 1; }
    else c.com += 1;
  }
  return c;
}

function renderPlano() {
  $('t-plano-mun').textContent = nomeDe(estado.mun);
  const linhas = RELATORIOS.map((d) => {
    const c = contarPlano(d.chave);
    const total = c.com + c.zero + c.vazio;
    const atual = d.chave === estado.rel;
    if (!total) return h('div', { class: `linha-plano${atual ? ' atual' : ''}` }, h('span', { class: 'rotulo-plano', text: d.tipo }), h('span', { class: 'barra-vazia', text: 'sem indicadores' }), h('span', { class: 'valor-plano', text: '–' }));
    const trilho = h('div', { class: 'barra-plano' });
    for (const parte of PARTES_PLANO) {
      const n = c[parte.chave];
      if (!n) continue;
      const pct = (n / total) * 100;
      const seg = h('div', { class: `seg-plano plano-${parte.chave}`, style: `flex:${n} 1 0`, tabindex: 0, role: 'img',
        'aria-label': `${parte.rotulo}: ${n} de ${total} indicadores (${porcento(pct)})` });
      if (pct >= 9) seg.append(h('span', { text: porcento(pct, 0) }));
      ligarDica(seg, `${numero(n, 0)} ${n === 1 ? 'indicador' : 'indicadores'} (${porcento(pct)})`, `${parte.rotulo} · ${parte.regra}`);
      trilho.append(seg);
    }
    // texto neutro: descreve o que está no dado, sem dizer que "não houve plano"
    const zeroOuVazio = c.zero + c.vazio;
    const que = c.zero && c.vazio ? '0 ou vazio' : c.zero ? '0' : 'vazio';
    return h('div', { class: `linha-plano${atual ? ' atual' : ''}` },
      h('span', { class: 'rotulo-plano', text: d.tipo }), trilho,
      h('span', { class: 'valor-plano', text: zeroOuVazio ? `${porcento((zeroOuVazio / total) * 100, 0)} com plano ${que}` : 'todos com plano' }));
  });
  const c = contarPlano(estado.rel);
  const def = tipoDe(estado.rel);
  // só um fato, sem interpretação; sem casos, o destaque nem aparece
  const n = c.zeroComExecutado;
  const destaque = n ? h('div', { class: 'destaque-plano', role: 'note' },
    h('strong', { class: 'destaque-numero', text: numero(n, 0) }),
    h('p', { text: `${n === 1 ? 'indicador' : 'indicadores'} do ${def.tipo} ${n === 1 ? 'tem' : 'têm'} plano 0 e valor executado maior que 0.` })) : null;
  $('plano').replaceChildren(
    h('div', { class: 'linhas-plano' }, linhas),
    h('ul', { class: 'legenda' }, PARTES_PLANO.map((x) => h('li', {}, h('span', { class: `chave plano-${x.chave}` }), h('span', { text: `${x.rotulo} (${x.regra})` })))),
    ...(destaque ? [destaque] : []));
}

function renderPorMunicipio() {
  const porTipo = new Map((estado.relDados?.anos?.[String(estado.ano)] ?? []).map((r) => [r.tipo, r]));
  renderCartoes(porTipo);
  renderPlano();
  renderArvore();
  renderEvolucaoAnos(false);
}

// Aviso acima da área de conteúdo (dados desatualizados ou erro ao desenhar)
function avisar(texto) {
  let aviso = $('aviso-dados');
  if (!texto) { aviso?.remove(); return; }
  if (!aviso) {
    aviso = h('p', { class: 'aviso', id: 'aviso-dados', role: 'alert' });
    $('pg-panorama').before(aviso);
  }
  aviso.textContent = texto;
}

// Limpa só o município: mesorregião, ano e relatório continuam como estão.
function limparMunicipio() {
  estado.mun = ''; estado.meta = null; estado.indicador = 0;
  $('sel-municipio').value = '';
  return mostrarPagina(estado.pagina === 'municipio' ? 'panorama' : estado.pagina);
}

// Remove os filtros de "onde" (município, mesorregião, situação e busca); ano e relatório continuam.
function limparFiltros() {
  estado.mun = ''; estado.meso = ''; estado.statusMun = ''; estado.meta = null; estado.indicador = 0;
  $('sel-meso').value = ''; $('busca-mun').value = '';
  preencherMunicipios();
  return mostrarPagina(estado.pagina === 'municipio' ? 'panorama' : estado.pagina);
}

async function atualizar() {
  if (estado.pagina === 'sobre') { renderSobre(); gravarHash(); return; }
  if (estado.pagina === 'municipios') {
    estado.munResumo ??= await carregar('data/municipios_resumo.json');
    renderMunicipios();
    gravarHash();
    return;
  }
  const noMunicipio = estado.pagina === 'municipio';
  const area = noMunicipio ? $('mun-conteudo') : $('area');
  area.classList.add('carregando');
  try {
    const emMunicipio = Boolean(estado.mun);
    $('mun-vazio').hidden = !noMunicipio || emMunicipio;
    $('mun-conteudo').hidden = !noMunicipio || !emMunicipio;
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
    if (!noMunicipio) { estado.munResumo ??= await carregar('data/municipios_resumo.json'); preencherStatus(); preencherMunicipios(); }
    if (noMunicipio) { if (emMunicipio) renderPorMunicipio(); }
    else { renderEstado(); renderEvolucaoAnos(true); }
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
  if (estado.mun === id) { limparMunicipio(); return; }
  if (estado.meso && estado.mesoDe.get(id) !== estado.meso) { estado.meso = ''; $('sel-meso').value = ''; preencherMunicipios(); }
  estado.mun = id; estado.meta = null; estado.indicador = 0;
  $('sel-municipio').value = id;
  atualizar();
}

function preencherMunicipios() {
  const lista = estado.municipios.municipios.filter((m) => (!estado.meso || m.mesorregiao === estado.meso) && (statusOk(m.id) || m.id === estado.mun));
  $('sel-municipio').replaceChildren(h('option', { value: '', text: estado.meso || estado.statusMun ? `Todos (${lista.length})` : 'Todos os municípios' }),
    ...[...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((m) => h('option', { value: m.id, text: m.tem_dados ? m.nome : `${m.nome} (sem dados)` })));
  $('sel-municipio').value = estado.mun;
}

function preencherFiltros() {
  const { municipios, anos } = estado.municipios;
  const selMun = $('sel-municipio'), selAno = $('sel-ano'), selRel = $('sel-relatorio');
  $('sel-meso').replaceChildren(h('option', { value: '', text: 'Todo o estado' }), ...MESORREGIOES.filter((m) => estado.resumoMeso?.[m]).map((m) => h('option', { value: m, text: rotuloMeso(m) })));
  $('sel-meso').value = estado.meso;
  preencherMunicipios();
  selAno.replaceChildren(...[...anos].reverse().map((a) => h('option', { value: String(a), text: String(a) })));
  selRel.replaceChildren(...RELATORIOS.map((d) => h('option', { value: d.chave, text: d.tipo })));
  selAno.value = String(estado.ano);
  selRel.value = estado.rel;
  $('ver-detalhes').addEventListener('click', () => mostrarPagina('municipio'));
  $('ver-todos').addEventListener('click', limparMunicipio);
  $('limpar-mun').addEventListener('click', limparFiltros);
  $('sel-meso').addEventListener('change', () => selecionarMeso($('sel-meso').value));
  selMun.addEventListener('change', () => {
    estado.mun = selMun.value;
    estado.meta = null;
    estado.indicador = 0;
    atualizar();
  });
  selAno.addEventListener('change', () => { estado.ano = Number(selAno.value); estado.meta = null; estado.indicador = 0; atualizar(); });
  selRel.addEventListener('change', () => {
    estado.rel = selRel.value;
    if (estado.pagina !== 'panorama') { atualizar(); return; }
    preencherStatus();
    preencherMunicipios();
    renderEstado();
    renderEvolucaoAnos(true);
    if (estado.mun) renderArvore();
    gravarHash();
  });
}

// Data dos dados: a da extração, se a carga a registrou; senão a da carga no Databricks; senão (arquivos antigos)
// a da exportação do JSON. Mostrada sempre no horário de Pernambuco, para não depender do fuso de quem abre.
function dataDosDados(d) {
  const [valor, tipo] = d.extraido_em ? [d.extraido_em, 'extracao'] : d.carga_em ? [d.carga_em, 'carga'] : [d.gerado_em, 'exportacao'];
  const momento = new Date(valor);
  const fuso = { timeZone: 'America/Recife' };
  return {
    tipo,
    data: momento.toLocaleDateString('pt-BR', fuso),
    hora: momento.toLocaleTimeString('pt-BR', { ...fuso, hour: '2-digit', minute: '2-digit' }),
    rotulo: tipo === 'exportacao' ? 'última exportação dos dados' : 'última atualização com dados do DigiSUS',
  };
}

function renderRodape() {
  const d = estado.municipios;
  const anos = [...d.anos].sort((x, y) => x - y);
  const quando = dataDosDados(d);
  const aba = (rotulo, pagina) => {
    const b = h('button', { type: 'button', class: 'link-rodape', text: rotulo });
    b.addEventListener('click', () => mostrarPagina(pagina));
    return b;
  };
  const externo = (rotulo, url) => h('a', { class: 'link-rodape', href: url, target: '_blank', rel: 'noopener noreferrer', text: rotulo });
  const coluna = (titulo, ...filhos) => h('div', { class: 'rodape-coluna' }, h('h2', { class: 'rodape-titulo', text: titulo }), ...filhos);
  $('rodape-texto').replaceChildren(
    h('div', { class: 'rodape-grade' },
      coluna('Fonte e atualização',
        h('p', { text: `DigiSUS Gestor, do Ministério da Saúde. Dados de ${anos[0]} a ${anos[anos.length - 1]}.` }),
        h('p', { text: `Última atualização com dados do DigiSUS em ${quando.data}. Nova atualização todo mês.` })),
      coluna('Navegar', aba('Panorama', 'panorama'), aba('Municípios', 'municipios'), aba('Detalhe do município', 'municipio'), aba('Sobre os dados', 'sobre')),
      coluna('Projeto', externo('Código no GitHub', REPOSITORIO), externo('Documentação', `${REPOSITORIO}/tree/main/docs`), aba('Como os dados são tratados', 'sobre')),
      coluna('Encontrou um erro?',
        h('p', { text: 'Conte o que viu: município, ano, relatório e o que parece errado.' }),
        (() => {
          // o link leva ao formulário já com o endereço atual da página (e seus filtros) preenchido
          const link = externo('Abrir um relato no GitHub', `${REPOSITORIO}/issues/new?template=relato-de-erro.yml`);
          const preencher = () => { link.href = `${REPOSITORIO}/issues/new?template=relato-de-erro.yml&pagina=${encodeURIComponent(location.href)}`; };
          for (const evento of ['mouseover', 'focus', 'pointerdown', 'click']) link.addEventListener(evento, preencher);
          return link;
        })(),
        // o endereço é montado aqui, para não aparecer como texto simples no código-fonte da página
        (() => {
          const endereco = ['painelsus', 'gmail.com'].join('@');
          return h('a', { class: 'link-rodape', href: `mailto:${endereco}?subject=${encodeURIComponent('Painel de metas de saúde: relato')}`, text: endereco });
        })())),
    h('p', { class: 'rodape-nota' },
      'Painel independente, feito a partir de dados públicos, sem vínculo com o Ministério da Saúde. Os valores são mostrados como informados pelos municípios, sem correção.',
      h('span', { class: 'rodape-autor' }, 'Desenvolvido por ',
        h('a', { href: 'https://www.linkedin.com/in/pablo-renato/', target: '_blank', rel: 'noopener noreferrer', text: 'Páblo Renato' }),
        ' (LinkedIn).')));
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
  const [municipios, resumo, mapa, malha, resumoMeso] = await Promise.all([
    carregar('data/municipios.json'), carregar('data/resumo.json'), carregar('data/mapa.json'), carregar('geo/pe-municipios.json'), carregar('data/resumo_mesorregiao.json'),
  ]);
  if (!municipios) {
    $('area').replaceChildren(h('p', { class: 'aviso', text: 'Os dados ainda não foram gerados. Rode export/exportar_site.py.' }));
    return;
  }
  for (const porTipo of Object.values(resumo ?? {})) for (const r of Object.values(porTipo)) r.classes = detalharClasses(r.classes, r.faixas);
  for (const porAno of Object.values(resumoMeso ?? {})) for (const porTipo of Object.values(porAno)) for (const r of Object.values(porTipo)) r.classes = detalharClasses(r.classes, r.faixas);
  Object.assign(estado, { municipios, resumo, resumoMeso, mapa, malha, mesoDe: new Map(municipios.municipios.map((m) => [m.id, m.mesorregiao])) });
  if (!resumo || !mapa) {
    $('area').before(h('p', { class: 'aviso', role: 'alert', text: 'Os dados estão em um formato antigo (faltam resumo.json e mapa.json). Rode export/exportar_site.py para gerar de novo.' }));
    $('area').hidden = true;
    return;
  }
  const p = new URLSearchParams(location.hash.slice(1));
  const lista = municipios.municipios;
  estado.meso = MESORREGIOES.includes(p.get('z')) && resumoMeso?.[p.get('z')] ? p.get('z') : '';
  estado.mun = lista.some((m) => m.id === p.get('m')) ? p.get('m') : '';
  if (estado.mun && estado.meso && estado.mesoDe.get(estado.mun) !== estado.meso) estado.meso = '';
  const anoHash = Number(p.get('a'));
  estado.ano = municipios.anos.includes(anoHash) ? anoHash : anoPadrao();
  estado.rel = RELATORIOS.some((d) => d.chave === p.get('r')) ? p.get('r') : 'rag';
  estado.meta = p.get('meta');

  estado.pagina = PAGINAS.includes(p.get('p')) ? p.get('p') : 'panorama';
  estado.statusMun = p.get('s') || '';
  preencherFiltros();
  renderRodape();
  for (const b of document.querySelectorAll('.aba')) b.addEventListener('click', () => mostrarPagina(b.dataset.pagina));
  $('filtro-status').addEventListener('change', () => { estado.statusMun = $('filtro-status').value; preencherMunicipios(); atualizar(); });
  $('busca-mun').addEventListener('input', () => { if (estado.pagina === 'municipios' && estado.munResumo) renderMunicipios(); });
  await mostrarPagina(estado.pagina);
}

// Botão para voltar ao topo: aparece depois de rolar um pouco e sobe devagar
function iniciarBotaoTopo() {
  const botao = $('ao-topo');
  const atualizarBotao = () => {
    botao.hidden = window.scrollY < 480;
    // no fim da página o botão ganha cor, porque é aí que a pessoa mais precisa dele
    const noFim = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120;
    botao.classList.toggle('no-fim', noFim);
  };
  window.addEventListener('scroll', atualizarBotao, { passive: true });
  botao.addEventListener('click', () => {
    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduz ? 'auto' : 'smooth' });
  });
  atualizarBotao();
}

iniciarBotaoTopo();
iniciar();
