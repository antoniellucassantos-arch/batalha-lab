// Nota de uma rodada de freestyle, a partir da análise de rimas e do tempo.
import { analisarTexto, limpar, palavrasDe, rimam, analisar, STOPWORDS } from './rima.js';
import { raridade } from './dicionario.js';
import { DICAS } from './dados.js';

const clamp = (x) => Math.max(0, Math.min(1, x));

export const DIMENSOES = {
  rima: 'Rima',
  complexidade: 'Complexidade',
  vocabulario: 'Vocabulário',
  flow: 'Flow',
  desafio: 'Desafio',
};

const PESOS = { rima: 0.35, complexidade: 0.2, vocabulario: 0.15, flow: 0.15, desafio: 0.15 };

export function rotuloNota(n) {
  if (n >= 90) return 'Lenda da roda';
  if (n >= 75) return 'Pronto pra batalha';
  if (n >= 60) return 'Sangue no olho';
  if (n >= 40) return 'Tá esquentando';
  return 'Treino é tudo';
}

// Palavra usada no texto? Aceita variações (plural, gênero) pelo radical
function usou(palavrasTexto, alvo) {
  const a = limpar(alvo);
  if (!a) return false;
  const radical = a.length >= 6 ? a.slice(0, a.length - 2) : a;
  return palavrasTexto.some((p) => p === a || (a.length >= 6 && p.startsWith(radical)));
}

/**
 * barras: string[]; duracaoSeg: number; travadas: number
 * modo: 'livre' | 'tema' | 'surpresa' | 'ataque' | 'texto'
 * extras: { tema, palavrasTema, palavrasMostradas, ataque: string[] }
 */
export function avaliarRodada({ barras, duracaoSeg = 0, travadas = 0, modo = 'livre', extras = {} }) {
  const analise = analisarTexto(barras);
  const s = analise.stats;
  const todas = analise.linhas.flatMap((l) => l.palavras.map((p) => p.limpa));
  const detalhes = [];

  // Rima: quantas barras fecham rimando com uma vizinha, pesado pela qualidade
  const rima = clamp(s.rimaFinal * 1.1);

  // Complexidade: multis e rimas internas
  const multiNota = clamp((s.multiMedio - 1) / 2.5);
  const densNota = clamp(s.densidade / 0.4);
  const complexidade = clamp(0.5 * multiNota + 0.35 * densNota + 0.15 * clamp(s.multis3 / 3));

  // Vocabulário: palavras diferentes, sem repetir rima, terminações menos batidas
  const rar = analise.linhas.map((l) => (l.melhor.score >= 0.45 && l.fim ? raridade(l.fim) : null)).filter((x) => x !== null);
  const rarMedia = rar.length ? rar.reduce((a, b) => a + b, 0) / rar.length : 0.4;
  const repet = s.barras ? s.repetidas / s.barras : 0;
  const vocabulario = s.conteudo < 4 ? 0.2 * clamp(s.conteudo / 4)
    : clamp(0.55 * clamp(s.ttr / 0.8) + 0.25 * (1 - clamp(repet * 3)) + 0.2 * clamp(rarMedia / 0.6));

  // Flow: velocidade, regularidade das barras e travadas
  let flow;
  const ppm = duracaoSeg > 5 ? (s.palavras / duracaoSeg) * 60 : null;
  const regular = clamp(1 - (s.silabasCV - 0.2) / 0.45);
  if (ppm !== null) {
    let vel;
    if (ppm < 60) vel = ppm / 60 * 0.5;
    else if (ppm < 100) vel = 0.5 + ((ppm - 60) / 40) * 0.5;
    else if (ppm <= 210) vel = 1;
    else vel = clamp(1 - (ppm - 210) / 120);
    flow = clamp(0.55 * vel + 0.45 * regular - Math.min(0.5, travadas * 0.12));
    detalhes.push(`${Math.round(ppm)} palavras por minuto`);
  } else {
    flow = regular;
  }
  if (travadas) detalhes.push(`${travadas} ${travadas === 1 ? 'travada' : 'travadas'} (silêncio longo)`);

  // Desafio: depende do modo
  let desafio;
  if (modo === 'tema' && extras.tema) {
    const lista = [extras.tema, ...(extras.palavrasTema || [])];
    const usadas = lista.filter((w) => usou(todas, w));
    desafio = clamp(usadas.length / 3);
    detalhes.push(`Palavras do tema usadas: ${usadas.length ? usadas.join(', ') : 'nenhuma'}`);
  } else if (modo === 'surpresa' && extras.palavrasMostradas?.length) {
    const usadas = extras.palavrasMostradas.filter((w) => usou(todas, w));
    desafio = clamp(usadas.length / extras.palavrasMostradas.length);
    extras.palavrasUsadas = usadas;
    detalhes.push(`Palavras-surpresa encaixadas: ${usadas.length} de ${extras.palavrasMostradas.length}`);
  } else if (modo === 'ataque' && extras.ataque?.length) {
    const finsAtaque = extras.ataque.map((b) => { const p = palavrasDe(b); return analisar(p[p.length - 1]); });
    const rimouNoAtaque = analise.linhas.some((l) => l.fim && finsAtaque.some((f) => rimam(l.fim, f)));
    const palavrasAtaque = new Set(extras.ataque.flatMap((b) => palavrasDe(b).map(limpar)).filter((w) => w.length > 3 && !STOPWORDS.has(w)));
    const citadas = new Set(todas.filter((w) => palavrasAtaque.has(w)));
    desafio = clamp((rimouNoAtaque ? 0.5 : 0) + 0.5 * clamp(citadas.size / 3));
    detalhes.push(rimouNoAtaque ? 'Respondeu rimando com o fim do ataque' : 'Não rimou com as palavras do ataque');
    if (citadas.size) detalhes.push(`Rebateu usando: ${[...citadas].join(', ')}`);
  } else if (ppm !== null) {
    desafio = clamp(ppm / 100) * clamp(s.barras / 6);
  } else {
    desafio = clamp(s.barras / 8);
  }

  const dims01 = { rima, complexidade, vocabulario, flow, desafio };
  let nota = Object.entries(PESOS).reduce((t, [k, p]) => t + dims01[k] * p, 0) * 100;
  if (s.palavras < 8) nota *= s.palavras / 8; // rodada quase vazia
  nota = Math.round(nota);
  const dims = Object.fromEntries(Object.entries(dims01).map(([k, v]) => [k, Math.round(v * 100)]));

  // Dicas para as duas dimensões mais fracas
  const fracas = Object.entries(dims).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k]) => k);
  const DICA_DESAFIO = { tema: 0, surpresa: 1, ataque: 2 };
  const dicas = fracas.map((k) => {
    const i = k === 'desafio' && modo in DICA_DESAFIO ? DICA_DESAFIO[modo] : Math.floor(Math.random() * DICAS[k].length);
    return { dim: DIMENSOES[k], texto: DICAS[k][i] };
  });

  return { nota, rotulo: rotuloNota(nota), dims, dicas, detalhes, analise, ppm };
}
