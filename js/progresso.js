// Página "Progresso": histórico salvo no navegador.
import { analisarTexto, renderizarAnalise, escapar } from './rima.js';
import { DIMENSOES, rotuloNota } from './avaliacao.js';
import { $, $$, lerHistorico, limparHistorico, ler, NOMES_MODO, formatarTempo } from './util.js';

function diasSeguidos(h) {
  const dias = new Set(h.map((r) => new Date(r.data).toDateString()));
  let n = 0;
  const d = new Date();
  if (!dias.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (dias.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function grafico(h) {
  const pts = h.slice(-30);
  if (pts.length < 2) return '<p class="nota-rodape">Faça pelo menos duas rodadas para ver o gráfico.</p>';
  const W = 720; const H = 220; const p = 32;
  const x = (i) => p + (i * (W - 2 * p)) / (pts.length - 1);
  const y = (v) => H - p - (v / 100) * (H - 2 * p);
  const linha = pts.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.nota).toFixed(1)}`).join(' ');
  const area = `${linha} L${x(pts.length - 1)},${H - p} L${x(0)},${H - p} Z`;
  const grade = [0, 25, 50, 75, 100].map((v) => `<line x1="${p}" x2="${W - p}" y1="${y(v)}" y2="${y(v)}" stroke="var(--borda)" stroke-dasharray="3 5"/><text x="${p - 8}" y="${y(v) + 4}" fill="var(--texto-3)" font-size="11" text-anchor="end">${v}</text>`).join('');
  const pontos = pts.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.nota)}" r="4" fill="var(--amarelo)"><title>${new Date(r.data).toLocaleString('pt-BR')} · ${r.nota}</title></circle>`).join('');
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Notas das últimas rodadas">
    <defs><linearGradient id="gArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffd60a" stop-opacity=".35"/><stop offset="1" stop-color="#ffd60a" stop-opacity="0"/></linearGradient></defs>
    ${grade}<path d="${area}" fill="url(#gArea)"/><path d="${linha}" fill="none" stroke="var(--amarelo)" stroke-width="3" stroke-linejoin="round"/>${pontos}</svg>`;
}

export function renderProgresso() {
  const el = $('#conteudo-progresso');
  const h = lerHistorico();
  const recs = {
    corrente: ler('recorde.corrente', 0), completar: ler('recorde.completar', 0),
    multi: ler('recorde.multi', 0), associacao: ler('recorde.associacao', 0),
  };
  if (!h.length) {
    el.innerHTML = `<div class="painel vazio"><p>Nenhuma rodada ainda.</p><a class="btn" href="#treinar">Fazer a primeira rodada</a></div>${recordes(recs)}`;
    return;
  }
  const ult = h.slice(-10);
  const media = Math.round(ult.reduce((s, r) => s + r.nota, 0) / ult.length);
  const melhor = Math.max(...h.map((r) => r.nota));
  const mediasDim = Object.keys(DIMENSOES).map((k) => [k, Math.round(ult.reduce((s, r) => s + (r.dims?.[k] || 0), 0) / ult.length)]);
  el.innerHTML = `
    <div class="resumo">
      <div><b>${h.length}</b><span>rodadas</span></div>
      <div><b>${media}</b><span>média (últimas 10)</span></div>
      <div><b>${melhor}</b><span>melhor nota</span></div>
      <div><b>${diasSeguidos(h)}</b><span>dias seguidos</span></div>
    </div>
    <div class="painel"><h2>Evolução</h2>${grafico(h)}</div>
    <div class="painel"><h2>Média por critério <small class="nota-rodape">(últimas 10)</small></h2>
      <div class="dims">${mediasDim.map(([k, v]) => `<div class="dim"><span class="dim-nome">${DIMENSOES[k]}</span><div class="dim-barra"><span style="width:${v}%"></span></div><span class="dim-valor">${v}</span></div>`).join('')}</div>
    </div>
    ${recordes(recs)}
    <div class="painel"><h2>Rodadas</h2><div class="historico">${h.slice().reverse().slice(0, 60).map((r) => `
      <div class="item-historico">
        <div class="n">${r.nota}</div>
        <div><div><b>${NOMES_MODO[r.modo] || r.modo}</b>${r.contexto ? ' · ' + escapar(r.contexto) : ''} <span class="meta">· ${rotuloNota(r.nota)}</span></div>
          <div class="meta">${new Date(r.data).toLocaleString('pt-BR')} · ${formatarTempo(r.duracao || 0)} · ${r.bpm || ''} BPM</div>
          <div class="trecho">${escapar((r.barras || []).join(' / ') || 'sem transcrição')}</div></div>
        <div class="acoes-item"><button class="btn btn-sec btn-peq" data-ver="${r.id}">Ver barras</button></div>
      </div>
      <div class="letra-analisada" data-barras="${r.id}" hidden></div>`).join('')}</div>
      <div class="acoes"><button class="btn btn-sec btn-peq" id="btn-limpar">Apagar histórico</button></div>
    </div>`;

  $$('[data-ver]', el).forEach((b) => b.addEventListener('click', () => {
    const alvo = $(`[data-barras="${b.dataset.ver}"]`, el);
    const r = h.find((x) => String(x.id) === b.dataset.ver);
    if (alvo.hidden) alvo.innerHTML = r.barras?.length ? renderizarAnalise(analisarTexto(r.barras)) : '<p class="placeholder">Sem transcrição.</p>';
    alvo.hidden = !alvo.hidden;
  }));
  $('#btn-limpar').addEventListener('click', () => {
    if (confirm('Apagar todas as rodadas salvas neste navegador?')) { limparHistorico(); renderProgresso(); }
  });
}

function recordes(r) {
  return `<div class="painel"><h2>Recordes dos exercícios</h2><div class="chips">
    <span class="chip">⛓️ Corrente: <b>${r.corrente}</b> pts</span>
    <span class="chip">✍️ Completa a barra: <b>${r.completar}</b>/100</span>
    <span class="chip">🧩 Maior multi: <b>${r.multi}</b> vogais</span>
    <span class="chip">💭 Associação: <b>${r.associacao}</b> palavras</span></div></div>`;
}
