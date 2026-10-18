// Dicionário de rimas: usa a lista de 50 mil palavras mais frequentes do português
// brasileiro (projeto FrequencyWords, legendas do OpenSubtitles) e indexa pelo som.
import { analisar, limpar } from './rima.js';
import { PALAVRAS_BASE, TEMAS, PALAVRAS_SURPRESA, SEMENTES_CORRENTE } from './dados.js';

const URL_LISTA = 'https://cdn.jsdelivr.net/gh/hermitdave/FrequencyWords@master/content/2018/pt_br/pt_br_50k.txt';
const SO_LETRAS = /^[a-záàâãéêíóôõúüç]+$/;

let estado = null; // { palavras: [{w, f, a}], porCC, porCCBase, porCT, fonte }
let carregando = null;

function indexar(lista, fonte) {
  const palavras = [];
  const porCC = new Map();
  const porCCBase = new Map();
  const porCT = new Map();
  const add = (m, k, item) => { if (!m.has(k)) m.set(k, []); m.get(k).push(item); };
  const vistas = new Set();
  for (const { w, f } of lista) {
    if (vistas.has(w)) continue;
    vistas.add(w);
    const a = analisar(w);
    if (!a) continue;
    const item = { w, f, a };
    palavras.push(item);
    add(porCC, a.cc, item);
    add(porCCBase, a.ccBase, item);
    add(porCT, a.ctBase, item);
  }
  estado = { palavras, porCC, porCCBase, porCT, fonte };
  return estado;
}

function listaReserva() {
  const extra = [...PALAVRAS_BASE, ...PALAVRAS_SURPRESA, ...SEMENTES_CORRENTE, ...TEMAS.flatMap((t) => t.palavras)];
  return extra.map((w) => limpar(w)).filter((w) => w.length > 1).map((w) => ({ w, f: 1 }));
}

export function dicionarioPronto() { return !!estado; }
export function fonteDicionario() { return estado?.fonte || ''; }

export function carregarDicionario() {
  if (estado) return Promise.resolve(estado);
  if (carregando) return carregando;
  carregando = (async () => {
    try {
      const resp = await fetch(URL_LISTA);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const texto = await resp.text();
      const lista = [];
      for (const linha of texto.split('\n')) {
        const [w, f] = linha.trim().split(' ');
        if (!w || w.length < 2 || !SO_LETRAS.test(w)) continue;
        if (/[ky]|w(?!$)|th|sh(?!ow)|ck/.test(w)) continue; // filtra nomes/palavras em inglês
        lista.push({ w, f: Number(f) || 1 });
      }
      return indexar(lista.concat(listaReserva()), 'lista de 50 mil palavras (FrequencyWords)');
    } catch (err) {
      console.warn('Dicionário grande indisponível, usando lista reserva:', err);
      return indexar(listaReserva(), 'lista reserva (offline)');
    }
  })();
  return carregando;
}

const porFreq = (a, b) => b.f - a.f;

// Quantas vogais do fim batem entre duas palavras
function sufixoVogais(a, b) {
  let i = a.vogais.length - 1;
  let j = b.vogais.length - 1;
  let n = 0;
  while (i >= 0 && j >= 0 && a.vogais[i].v === b.vogais[j].v) { n++; i--; j--; }
  return n;
}

export function buscarRimas(palavra, limite = 80) {
  const a = analisar(palavra);
  if (!a || !estado) return null;
  const w = a.palavra;
  const fora = (it) => it.w !== w;
  const perfeitas = (estado.porCC.get(a.cc) || []).filter(fora);
  const setPerf = new Set(perfeitas.map((x) => x.w));
  const quase = (estado.porCCBase.get(a.ccBase) || []).filter((x) => fora(x) && !setPerf.has(x.w));
  const setQuase = new Set(quase.map((x) => x.w));
  const toantes = (estado.porCT.get(a.ctBase) || []).filter((x) => fora(x) && !setPerf.has(x.w) && !setQuase.has(x.w));
  // Multis: rimas cujas vogais batem também antes da tônica
  const base = a.vogais.length - a.tonica;
  const multis = [
    ...[...perfeitas, ...quase].map((x) => ({ ...x, m: sufixoVogais(a, x.a), p: 1 })).filter((x) => x.m >= base + 1),
    ...toantes.map((x) => ({ ...x, m: sufixoVogais(a, x.a), p: 0 })).filter((x) => x.m >= base + 2),
  ].sort((p, q) => q.m - p.m || q.p - p.p || q.f - p.f);
  return {
    analise: a,
    perfeitas: perfeitas.sort(porFreq).slice(0, limite),
    quase: quase.sort(porFreq).slice(0, limite),
    toantes: toantes.sort(porFreq).slice(0, limite),
    multis: multis.slice(0, limite),
    totalPerfeitas: perfeitas.length + quase.length,
  };
}

// 0 = terminação muito comum (-ão, -ar), 1 = rima rara
export function raridade(palavra) {
  const a = typeof palavra === 'string' ? analisar(palavra) : palavra;
  if (!a || !estado || estado.palavras.length < 5000) return null;
  const n = (estado.porCCBase.get(a.ccBase) || []).length;
  return Math.max(0, Math.min(1, 1 - Math.log10(n + 1) / Math.log10(3000)));
}
