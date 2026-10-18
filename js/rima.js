// Motor fonético de rimas para português brasileiro.
// Converte cada palavra numa representação aproximada do som, acha a sílaba
// tônica e compara rimas: perfeita (consoante), toante (só vogais) e
// multissilábica (sequência de vogais iguais no fim das barras).

const VOGAIS = 'aeiouáéíóúâêôãõàüy';
const BASE = { á: 'a', à: 'a', â: 'a', ã: 'a', é: 'e', ê: 'e', í: 'i', ó: 'o', ô: 'o', õ: 'o', ú: 'u', ü: 'u', y: 'i' };
const COM_ACENTO = 'áéíóúâêô';
const COM_TIL = 'ãõ';
const FRONTAIS = 'eiéêíy';
const NAO_VOGAL_SEGUINTE = /^[rlmnz](?![aeiouáéíóúâêôãõ])/;

// Palavras átonas que, na fala, viram "di", "ki", "u"... (importa para as multis)
const CLITICOS = new Set(['de', 'do', 'dos', 'o', 'os', 'no', 'nos', 'que', 'se', 'me', 'te', 'lhe', 'e', 'pro', 'pros', 'como']);

// Palavras de ligação ignoradas na contagem de rimas internas e de vocabulário
export const STOPWORDS = new Set(`a o as os um uma uns umas de do da dos das no na nos nas em num numa
e é ou que se me te lhe nos vos eu tu ele ela eles elas você vocês mim ti si meu minha teu tua seu sua
pra pro pras pros para por pelo pela com sem mas mais já lá aí só aqui ali isso isto esse essa este esta
aquele aquela não sim né tá to tô ta vai vou foi ser ter tem quem qual quando onde como muito pouco
também então porque pois até ao à aos às num the mano tipo tipo assim cara`.split(/\s+/));

const cache = new Map();

export function limpar(palavra) {
  return (palavra || '').toLowerCase().normalize('NFC').replace(/[^a-záàâãéêíóôõúüçy]/g, '');
}

function tokenizar(w) {
  const n = w.length;
  const tk = [];
  const ehV = (i) => i >= 0 && i < n && VOGAIS.includes(w[i]);
  const frontal = (i) => i < n && FRONTAIS.includes(w[i]);
  const C = (c) => tk.push({ t: 'C', c });
  const anterior = () => tk[tk.length - 1];
  const nasalizarAnterior = () => {
    const a = anterior();
    if (a && a.t === 'V') { a.nasal = true; return true; }
    return false;
  };

  for (let i = 0; i < n; i++) {
    const c = w[i];
    const nx = w[i + 1];
    if (VOGAIS.includes(c)) {
      let v = BASE[c] || c;
      const tok = { t: 'V', v, acento: COM_ACENTO.includes(c), til: COM_TIL.includes(c), nasal: COM_TIL.includes(c), glide: false, src: i };
      const ant = anterior();
      if (ant && ant.t === 'V') {
        if (ant.til && (v === 'o' || v === 'e')) {
          // ão -> ãu, ãe/õe -> ãi/õi
          tok.v = v === 'o' ? 'u' : 'i';
          tok.glide = true;
        } else if (ant.v === 'o' && v === 'u' && !tok.acento && !ant.glide) {
          continue; // "ou" vira "o" na fala (falou, sou)
        } else if (!tok.acento && !tok.til && (v === 'i' || v === 'u') && !ant.glide) {
          const resto = w.slice(i + 1);
          const hiato = /^nh/.test(resto) || NAO_VOGAL_SEGUINTE.test(resto) || (/^[iu]s?$/.test(resto) && resto[0] !== v);
          if (!hiato) tok.glide = true;
        }
      }
      tk.push(tok);
      continue;
    }
    switch (c) {
      case 'c':
        if (nx === 'h') { C('X'); i++; } else if (frontal(i + 1)) C('s'); else C('k');
        break;
      case 'ç': C('s'); break;
      case 'l':
        if (nx === 'h') { C('L'); i++; } else if (!ehV(i + 1) && ehV(i - 1)) tk.push({ t: 'V', v: 'u', glide: true, nasal: false, src: i });
        else C('l');
        break;
      case 'n':
        if (nx === 'h') { C('N'); i++; } else if (!ehV(i + 1) && nasalizarAnterior()) { /* nasal */ } else C('n');
        break;
      case 'm':
        if (!ehV(i + 1) && nasalizarAnterior()) { /* nasal */ } else C('m');
        break;
      case 'r':
        if (nx === 'r') { C('R'); i++; } else if (i === 0 || 'nls'.includes(w[i - 1])) C('R'); else C('r');
        break;
      case 's':
        if (nx === 's') { C('s'); i++; } else if (nx === 'c' && frontal(i + 2)) { C('s'); i++; } else if (ehV(i - 1) && ehV(i + 1)) C('z'); else C('s');
        break;
      case 'x': C('X'); break;
      case 'z': C(i === n - 1 ? 's' : 'z'); break;
      case 'g':
        if (nx === 'u' && ehV(i + 2)) { C('g'); i++; } else if (frontal(i + 1)) C('j'); else C('g');
        break;
      case 'q':
        C('k');
        if (nx === 'u' || nx === 'ü') i++;
        break;
      case 'h': break;
      case 'w': tk.push({ t: 'V', v: 'u', glide: ehV(i - 1), nasal: false, src: i }); break;
      default: C(c);
    }
  }

  // Finais nasais: -am soa "ãu", -em/-ens soa "ẽi"
  if (/am$/.test(w)) tk.push({ t: 'V', v: 'u', glide: true, nasal: false, src: n - 1 });
  if (/[eéê](m|ns)$/.test(w)) {
    const pos = w.endsWith('s') ? tk.length - 1 : tk.length;
    tk.splice(pos, 0, { t: 'V', v: 'i', glide: true, nasal: false, src: n - 1 });
  }
  return tk;
}

export function analisar(palavraOriginal) {
  const w = limpar(palavraOriginal);
  if (!w) return null;
  if (cache.has(w)) return cache.get(w);

  const tk = tokenizar(w);
  const nucleos = [];
  tk.forEach((tok, k) => {
    if (tok.t !== 'V') return;
    const ult = nucleos[nucleos.length - 1];
    if (tok.glide && ult && ult.fim === k - 1) {
      ult.fim = k;
      return;
    }
    nucleos.push({ k, fim: k, v: tok.v, nasal: tok.nasal, acento: tok.acento, til: tok.til, src: tok.src });
  });
  if (!nucleos.length) { cache.set(w, null); return null; }
  // A nasalização pode ter sido aplicada depois de o núcleo ser criado
  nucleos.forEach((nu) => { nu.nasal = tk[nu.k].nasal; });

  let tonica = nucleos.findIndex((nu) => nu.acento);
  if (tonica < 0) tonica = nucleos.findIndex((nu) => nu.til);
  if (tonica < 0) {
    const paroxitona = /([aeo]s?|[ae]m|ens)$/.test(w);
    tonica = paroxitona && nucleos.length > 1 ? nucleos.length - 2 : nucleos.length - 1;
  }

  // Vogais átonas finais: "e" soa "i" e "o" soa "u" (verde -> verdi, gato -> gatu)
  const reduzir = (nu) => {
    if (nu.nasal) return;
    if (nu.v === 'e') { nu.v = 'i'; tk[nu.k].v = 'i'; }
    if (nu.v === 'o') { nu.v = 'u'; tk[nu.k].v = 'u'; }
  };
  const ultimo = nucleos[nucleos.length - 1];
  if (nucleos.length - 1 > tonica) reduzir(ultimo);
  const clitico = CLITICOS.has(w);
  if (clitico) nucleos.forEach(reduzir);

  const simbolo = (tok) => {
    if (tok.t === 'C') return tok.c;
    if (tok.glide) return tok.v === 'i' ? 'y' : 'w';
    return tok.v + (tok.nasal ? '~' : '');
  };
  const cc = tk.slice(nucleos[tonica].k).map(simbolo).join('');
  const vogaisPos = nucleos.slice(tonica).map((nu) => nu.v + (nu.nasal ? '~' : ''));

  const res = {
    palavra: w,
    silabas: nucleos.length,
    tonica,
    clitico,
    cc, // chave de rima perfeita: som da vogal tônica até o fim
    ccBase: cc.replace(/[srz]$/, ''), // ignora plural e "r" final (falar ~ já)
    ct: vogaisPos.join('.'), // chave toante: só as vogais
    ctBase: vogaisPos.map((v) => v.replace('~', '')).join('.'),
    vogais: nucleos.map((nu, i) => ({ v: nu.v, nasal: nu.nasal, tonica: i === tonica })),
    srcTonica: nucleos[tonica].src,
    tipo: tonica === nucleos.length - 1 ? 'oxítona' : tonica === nucleos.length - 2 ? 'paroxítona' : 'proparoxítona',
  };
  cache.set(w, res);
  return res;
}

// Mostra a palavra com a vogal tônica destacada: ri<b>m</b>a -> "rIma"
export function marcarTonica(palavra) {
  const a = analisar(palavra);
  const w = limpar(palavra);
  if (!a) return w;
  return w.slice(0, a.srcTonica) + '<b class="tonica">' + w[a.srcTonica] + '</b>' + w.slice(a.srcTonica + 1);
}

export const NIVEIS = {
  perfeita: { nome: 'Rima perfeita', score: 1 },
  quase: { nome: 'Rima perfeita (variação)', score: 0.9 },
  toante: { nome: 'Rima toante', score: 0.6 },
  toanteFraca: { nome: 'Toante fraca', score: 0.45 },
  repetida: { nome: 'Palavra repetida', score: 0.15 },
  nenhuma: { nome: 'Não rima', score: 0 },
};

export function compararRima(a, b) {
  if (typeof a === 'string') a = analisar(a);
  if (typeof b === 'string') b = analisar(b);
  if (!a || !b) return { nivel: 'nenhuma', score: 0 };
  let nivel = 'nenhuma';
  if (a.palavra === b.palavra) nivel = 'repetida';
  else if (a.cc === b.cc) nivel = 'perfeita';
  else if (a.ccBase === b.ccBase) nivel = 'quase';
  else if (a.ct === b.ct) nivel = 'toante';
  else if (a.ctBase === b.ctBase) nivel = 'toanteFraca';
  return { nivel, score: NIVEIS[nivel].score };
}

export function rimam(a, b, minimo = 0.45) {
  const r = compararRima(a, b);
  return r.nivel !== 'repetida' && r.score >= minimo;
}

export function palavrasDe(texto) {
  return (texto || '').split(/[\s,.;:!?()"“”…]+/).map((p) => p.trim()).filter((p) => limpar(p));
}

export function vogaisDoTrecho(palavras) {
  const out = [];
  palavras.forEach((p, wi) => {
    const a = analisar(p);
    if (a) a.vogais.forEach((v) => out.push({ ...v, wi }));
  });
  return out;
}

// Quantas vogais batem de trás pra frente no fim de dois trechos (tamanho da multi)
export function tamanhoMulti(palavrasA, palavrasB) {
  const va = vogaisDoTrecho(palavrasA);
  const vb = vogaisDoTrecho(palavrasB);
  let i = va.length - 1;
  let j = vb.length - 1;
  let n = 0;
  while (i >= 0 && j >= 0 && va[i].v === vb[j].v) { n++; i--; j--; }
  return n;
}

export function padraoVogais(palavras, quantas = 4) {
  const v = vogaisDoTrecho(palavras);
  return v.slice(-quantas).map((x) => (x.tonica ? x.v.toUpperCase() : x.v));
}

export function contarSilabas(texto) {
  return palavrasDe(texto).reduce((s, p) => s + (analisar(p)?.silabas || 0), 0);
}

const CORES = 12;

// Analisa um texto dividido em barras (linhas): esquema de rima, multis,
// rimas internas e estatísticas.
export function analisarTexto(linhasTexto) {
  const linhas = linhasTexto
    .map((t) => t.trim())
    .filter(Boolean)
    .map((texto) => {
      const palavras = palavrasDe(texto).map((orig) => ({ orig, limpa: limpar(orig), a: analisar(orig), grupo: null }));
      const comAnalise = palavras.filter((p) => p.a);
      const fimP = comAnalise[comAnalise.length - 1] || null;
      return {
        texto,
        palavras,
        fim: fimP ? fimP.a : null,
        fimIdx: fimP ? palavras.indexOf(fimP) : -1,
        silabas: palavras.reduce((s, p) => s + (p.a?.silabas || 0), 0),
        letra: '',
        melhor: { nivel: 'nenhuma', score: 0, com: null, multi: 0 },
      };
    })
    .filter((l) => l.palavras.length);

  // Melhor rima de fim de barra com as vizinhas (até 2 barras de distância)
  const pares = [];
  linhas.forEach((l, i) => {
    for (const d of [-1, 1, -2, 2]) {
      const j = i + d;
      if (j < 0 || j >= linhas.length) continue;
      const r = compararRima(l.fim, linhas[j].fim);
      const melhorAtual = l.melhor;
      if (r.score > melhorAtual.score) {
        const multi = r.score >= 0.45 && r.nivel !== 'repetida'
          ? tamanhoMulti(l.palavras.map((p) => p.orig), linhas[j].palavras.map((p) => p.orig))
          : 0;
        l.melhor = { ...r, com: j, multi };
      }
    }
    if (l.melhor.com !== null && l.melhor.com > i) return;
    if (l.melhor.com !== null) pares.push({ i: l.melhor.com, j: i, ...l.melhor });
  });

  // Letras do esquema (AABB, ABAB...)
  let proxLetra = 0;
  linhas.forEach((l, i) => {
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      if (linhas[j].fim && l.fim && rimam(l.fim, linhas[j].fim, 0.6)) { l.letra = linhas[j].letra; return; }
    }
    l.letra = String.fromCharCode(65 + (proxLetra++ % 26));
  });

  // Rimas internas: palavras de conteúdo com a mesma chave de rima perfeita
  const mapa = new Map();
  linhas.forEach((l, li) => l.palavras.forEach((p, pi) => {
    if (!p.a || p.limpa.length < 2 || STOPWORDS.has(p.limpa)) return;
    const k = p.a.ccBase;
    if (!mapa.has(k)) mapa.set(k, { chave: k, ocorrencias: [], distintas: new Set() });
    const g = mapa.get(k);
    g.ocorrencias.push([li, pi]);
    g.distintas.add(p.limpa);
  }));
  const grupos = [...mapa.values()].filter((g) => g.distintas.size >= 2).sort((a, b) => b.ocorrencias.length - a.ocorrencias.length);
  grupos.forEach((g, gi) => {
    g.cor = gi % CORES;
    g.ocorrencias.forEach(([li, pi]) => { linhas[li].palavras[pi].grupo = g.cor; });
  });

  const todas = linhas.flatMap((l) => l.palavras);
  const conteudo = todas.filter((p) => p.a && !STOPWORDS.has(p.limpa) && p.limpa.length >= 2);
  const unicas = new Set(conteudo.map((p) => p.limpa));
  const coloridas = conteudo.filter((p) => p.grupo !== null).length;
  const comRima = linhas.filter((l) => l.melhor.score >= 0.45 && l.melhor.nivel !== 'repetida');
  const multis = pares.filter((p) => p.multi > 0).map((p) => p.multi);
  const silabas = linhas.map((l) => l.silabas);
  const media = silabas.reduce((a, b) => a + b, 0) / (silabas.length || 1);
  const desvio = Math.sqrt(silabas.reduce((a, b) => a + (b - media) ** 2, 0) / (silabas.length || 1));

  return {
    linhas,
    pares,
    grupos,
    stats: {
      barras: linhas.length,
      palavras: todas.length,
      conteudo: conteudo.length,
      unicas: unicas.size,
      ttr: conteudo.length ? unicas.size / conteudo.length : 0,
      densidade: conteudo.length ? coloridas / conteudo.length : 0,
      rimasInternas: grupos.length,
      rimaFinal: linhas.length ? linhas.reduce((s, l) => s + (l.melhor.nivel === 'repetida' ? 0.15 : l.melhor.score), 0) / linhas.length : 0,
      barrasComRima: comRima.length,
      perfeitas: pares.filter((p) => p.nivel === 'perfeita' || p.nivel === 'quase').length,
      toantes: pares.filter((p) => p.nivel === 'toante' || p.nivel === 'toanteFraca').length,
      repetidas: linhas.filter((l) => l.melhor.nivel === 'repetida').length,
      multiMedio: multis.length ? multis.reduce((a, b) => a + b, 0) / multis.length : 0,
      maiorMulti: multis.length ? Math.max(...multis) : 0,
      multis3: multis.filter((m) => m >= 3).length,
      silabasMedia: media,
      silabasCV: media ? desvio / media : 0,
    },
  };
}

export function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// HTML das barras com rimas coloridas, letra do esquema e selo de multi
export function renderizarAnalise(analise, { mostrarEsquema = true } = {}) {
  return analise.linhas.map((l) => {
    const palavras = l.palavras.map((p, i) => {
      const classes = [];
      if (p.grupo !== null) classes.push('rg', 'g' + p.grupo);
      if (i === l.fimIdx) classes.push('fim');
      return classes.length ? `<span class="${classes.join(' ')}">${escapar(p.orig)}</span>` : escapar(p.orig);
    }).join(' ');
    const multi = l.melhor.multi >= 3 ? `<span class="selo-multi" title="Multissilábica: ${l.melhor.multi} vogais batendo">multi ${l.melhor.multi}</span>` : '';
    const letra = mostrarEsquema ? `<span class="letra-esquema l${(l.letra.charCodeAt(0) - 65) % 12}">${l.letra}</span>` : '';
    return `<div class="barra">${letra}<span class="texto-barra">${palavras}</span>${multi}</div>`;
  }).join('');
}
