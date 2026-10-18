export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];

export function formatarTempo(seg) {
  const s = Math.max(0, Math.ceil(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const PREFIXO = 'batalhalab.';

export function ler(chave, padrao) {
  try {
    const v = localStorage.getItem(PREFIXO + chave);
    return v === null ? padrao : JSON.parse(v);
  } catch { return padrao; }
}

export function salvar(chave, valor) {
  try { localStorage.setItem(PREFIXO + chave, JSON.stringify(valor)); } catch { /* armazenamento indisponível */ }
}

export function lerHistorico() { return ler('historico', []); }

export function salvarRodada(r) {
  const h = lerHistorico();
  const i = h.findIndex((x) => x.id === r.id);
  if (i >= 0) h[i] = r; else h.push(r);
  salvar('historico', h.slice(-300));
}

export function limparHistorico() { salvar('historico', []); }

export function recorde(chave, valor) {
  const atual = ler('recorde.' + chave, 0);
  if (valor > atual) { salvar('recorde.' + chave, valor); return { novo: true, valor }; }
  return { novo: false, valor: atual };
}

export const NOMES_MODO = { livre: 'Livre', tema: 'Tema', surpresa: 'Palavras-surpresa', ataque: 'Ataque e resposta' };
