// Utilitários compartilhados: formatação, criação de elementos, carga de dados e dica (tooltip).
// Todo texto vindo dos dados entra no DOM por textContent / nós de texto, nunca por innerHTML.

export const RELATORIOS = [
  { tipo: '1º RDQA', chave: '1q', quadrimestre: '1º quadrimestre', periodo: 'Janeiro a abril' },
  { tipo: '2º RDQA', chave: '2q', quadrimestre: '2º quadrimestre', periodo: 'Maio a agosto' },
  { tipo: '3º RDQA', chave: '3q', quadrimestre: '3º quadrimestre', periodo: 'Setembro a dezembro' },
  { tipo: 'RAG', chave: 'rag', quadrimestre: 'Ano inteiro', periodo: 'Ano inteiro' },
];

// Classes de alcance (regra definida no dbt, int_metas_unidades.classe_alcance)
export const CLASSES = [
  { chave: 'atingida', rotulo: 'Atingida', regra: '100% ou mais' },
  { chave: 'parcial_alto', rotulo: 'Parcial alto', regra: '80% a menos de 100%' },
  { chave: 'parcial_medio', rotulo: 'Parcial médio', regra: '40% a menos de 80%' },
  { chave: 'parcial_baixo', rotulo: 'Parcial baixo', regra: 'acima de 0 e abaixo de 40%' },
  { chave: 'zero', rotulo: 'Zero', regra: 'igual a zero' },
  { chave: 'sem_valor', rotulo: 'Sem valor', regra: 'campo vazio' },
];

// O parcial (acima de 0 e abaixo de 100%) é dividido em 3 faixas, só para exibição
export function faixaParcial(alcancado) {
  return alcancado < 40 ? 'parcial_baixo' : alcancado < 80 ? 'parcial_medio' : 'parcial_alto';
}

// Acrescenta parcial_baixo/medio/alto a {atingida, parcial, zero, sem_valor}, somando as faixas de 10 pontos.
// Faixa 1 (menos de 10%) inclui o zero, que é descontado.
export function detalharClasses(classes, faixas) {
  if (!classes || classes.parcial_alto != null) return classes;
  const f = new Map(faixas ?? []);
  const soma = (de, ate) => { let n = 0; for (let i = de; i <= ate; i++) n += f.get(i) || 0; return n; };
  const baixo = Math.max(0, soma(1, 4) - (classes.zero || 0));
  const medio = soma(5, 8);
  return { ...classes, parcial_baixo: baixo, parcial_medio: medio, parcial_alto: Math.max(0, (classes.parcial || 0) - baixo - medio) };
}

export const SEM_PROJETO = 'sem_projeto_identificado';
const NAMESPACE_SVG = 'http://www.w3.org/2000/svg';

export const $ = (id) => document.getElementById(id);
export const numero = (n, casas = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas });
export const porcento = (n, casas = 1) => `${numero(n, casas)}%`;

export function h(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f != null) e.append(f);
  return e;
}

export function s(tag, props = {}, ...filhos) {
  const e = document.createElementNS(NAMESPACE_SVG, tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const f of filhos.flat()) if (f != null) e.append(f);
  return e;
}

const cache = new Map();
export async function carregar(url) {
  if (cache.has(url)) return cache.get(url);
  const resposta = await fetch(url);
  const dados = resposta.ok ? await resposta.json() : null;
  cache.set(url, dados);
  return dados;
}

export function limitar(texto, tamanho) {
  if (!texto) return '';
  return texto.length > tamanho ? `${texto.slice(0, tamanho - 1).trimEnd()}…` : texto;
}

const ROTULOS_STATUS = {
  [SEM_PROJETO]: 'Sem projeto',
  sem_dados: 'Sem dados na extração',
};
export function rotuloStatus(status) {
  return ROTULOS_STATUS[status] ?? status ?? 'Sem dados';
}

// ---------- dica (tooltip) ----------
const dica = $('dica');

export function mostrarDica(valor, detalhe, x, y) {
  dica.replaceChildren(h('strong', { text: valor }), h('span', { text: detalhe }));
  dica.hidden = false;
  const r = dica.getBoundingClientRect();
  const px = Math.min(Math.max(8, x + 12), window.innerWidth - r.width - 8);
  const py = y - r.height - 12 < 8 ? y + 16 : y - r.height - 12;
  dica.style.left = `${px}px`;
  dica.style.top = `${py}px`;
}

export function esconderDica() {
  dica.hidden = true;
}

// A área de acerto responde ao mouse e ao foco do teclado, e mostra a mesma coisa nos dois.
export function ligarDica(alvo, valor, detalhe) {
  alvo.addEventListener('pointermove', (e) => mostrarDica(valor, detalhe, e.clientX, e.clientY));
  alvo.addEventListener('pointerleave', esconderDica);
  alvo.addEventListener('focus', () => {
    const r = alvo.getBoundingClientRect();
    mostrarDica(valor, detalhe, r.left + r.width / 2, r.top);
  });
  alvo.addEventListener('blur', esconderDica);
}

// ---------- componentes simples ----------

// Controle segmentado (abas): itens = [{valor, rotulo}]
export function segmentado(rotulo, itens, valor, aoMudar) {
  const grupo = h('div', { class: 'segmentado', role: 'group', 'aria-label': rotulo });
  for (const it of itens) {
    const b = h('button', { type: 'button', class: 'seg-item', 'aria-pressed': String(it.valor === valor), text: it.rotulo });
    b.addEventListener('click', () => {
      for (const o of grupo.children) o.setAttribute('aria-pressed', String(o === b));
      aoMudar(it.valor);
    });
    grupo.append(b);
  }
  return grupo;
}

// Barra de classes de alcance (empilhada). contagens = {atingida, parcial, zero, sem_valor}.
// escala: total máximo para o modo "quantidade" (comprimento comparável entre linhas); no modo
// "percentual" a barra ocupa toda a largura.
export function barraClasses(contagens, modo, escala) {
  const total = CLASSES.reduce((a, c) => a + (contagens[c.chave] || 0), 0);
  const trilho = h('div', { class: 'barra-classes' });
  if (!total) {
    trilho.append(h('span', { class: 'barra-vazia', text: 'sem indicadores' }));
    return trilho;
  }
  const larguraTotal = modo === 'percentual' ? 100 : (total / escala) * 100;
  const caixa = h('div', { class: 'barra-segmentos', style: `width:${larguraTotal}%` });
  for (const c of CLASSES) {
    const n = contagens[c.chave] || 0;
    if (!n) continue;
    const p = (n / total) * 100;
    const seg = h('div', {
      class: `segmento seg-${c.chave}`, style: `flex:${n} 1 0`, tabindex: 0, role: 'img',
      'aria-label': `${c.rotulo}: ${n} de ${total} indicadores (${porcento(p)})`,
    });
    // o número só aparece se o segmento tiver espaço (senão fica na dica e na tabela)
    const largura = (larguraTotal * p) / 100;
    if (largura >= 9) seg.append(h('span', { text: modo === 'percentual' ? porcento(p, 0) : numero(n, 0) }));
    ligarDica(seg, `${numero(n, 0)} ${n === 1 ? 'indicador' : 'indicadores'} (${porcento(p)})`, `${c.rotulo} · ${c.regra}`);
    caixa.append(seg);
  }
  trilho.append(caixa);
  return trilho;
}

export function legendaClasses() {
  return h('ul', { class: 'legenda' }, CLASSES.map((c) =>
    h('li', {}, h('span', { class: `chave seg-${c.chave}` }), h('span', { text: c.chave.startsWith('parcial') ? c.regra.charAt(0).toUpperCase() + c.regra.slice(1) : `${c.rotulo} (${c.regra})` }))));
}
