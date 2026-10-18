// Página "Laboratório": dicionário de rimas e analisador de letras.
import { analisarTexto, renderizarAnalise, marcarTonica, limpar, escapar } from './rima.js';
import { carregarDicionario, buscarRimas, fonteDicionario, raridade } from './dicionario.js';
import { $ } from './util.js';

let iniciado = false;

function grupo(titulo, desc, itens, mostrarM = false) {
  if (!itens.length) return '';
  return `<div class="grupo-rimas"><h3>${titulo} <small>${desc} · ${itens.length}</small></h3>
    <div class="palavras-rima">${itens.map((x) => `<button type="button" data-w="${escapar(x.w)}" title="${mostrarM ? x.m + ' vogais batendo' : ''}">${escapar(x.w)}${mostrarM ? ` <small style="opacity:.6">${x.m}</small>` : ''}</button>`).join('')}</div></div>`;
}

function buscar(palavra) {
  const out = $('#resultado-dicionario');
  const w = limpar(palavra);
  if (!w) return;
  $('#busca-palavra').value = palavra;
  const r = buscarRimas(w);
  if (!r) { out.innerHTML = '<p class="aviso">Não consegui analisar essa palavra.</p>'; return; }
  const a = r.analise;
  const rar = raridade(a);
  out.innerHTML = `
    <div class="analise-palavra">
      <span class="chip">Tônica: <b>${marcarTonica(w)}</b></span>
      <span class="chip"><b>${a.silabas}</b> ${a.silabas === 1 ? 'sílaba' : 'sílabas'}</span>
      <span class="chip">${a.tipo}</span>
      <span class="chip">rima em <b>-${escapar(w.slice(a.srcTonica))}</b></span>
      ${rar !== null ? `<span class="chip">${rar > 0.6 ? 'rima rara 💎' : rar > 0.3 ? 'rima média' : 'rima muito comum'}</span>` : ''}
    </div>
    ${grupo('Multissilábicas', 'batem mais sílabas', r.multis, true)}
    ${grupo('Perfeitas', 'mesmo som da tônica até o fim', r.perfeitas)}
    ${grupo('Variações', 'plural ou "r" final (falar ~ já)', r.quase)}
    ${grupo('Toantes', 'só as vogais batem', r.toantes)}
    ${!r.perfeitas.length && !r.quase.length && !r.toantes.length ? '<p class="nota-rodape">Nenhuma rima encontrada no dicionário.</p>' : ''}`;
}

function analisarLetra() {
  const linhas = $('#texto-analisar').value.split('\n');
  const out = $('#resultado-analise');
  const an = analisarTexto(linhas);
  if (!an.linhas.length) { out.innerHTML = ''; return; }
  const s = an.stats;
  out.innerHTML = `
    <div class="chips" style="margin:14px 0">
      <span class="chip">Esquema: <b>${an.linhas.map((l) => l.letra).join('')}</b></span>
      <span class="chip"><b>${s.barrasComRima}</b>/${s.barras} barras rimando</span>
      <span class="chip"><b>${s.perfeitas}</b> perfeitas · <b>${s.toantes}</b> toantes</span>
      <span class="chip">maior multi: <b>${s.maiorMulti}</b></span>
      <span class="chip"><b>${Math.round(s.densidade * 100)}%</b> das palavras em rima</span>
      <span class="chip">média de <b>${s.silabasMedia.toFixed(1)}</b> sílabas por barra</span>
    </div>
    <div class="letra-analisada">${renderizarAnalise(an)}</div>`;
}

export async function iniciarLab() {
  if (iniciado) return;
  iniciado = true;
  $('#form-dicionario').addEventListener('submit', (e) => { e.preventDefault(); buscar($('#busca-palavra').value); });
  $('#resultado-dicionario').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-w]');
    if (b) buscar(b.dataset.w);
  });
  $('#btn-analisar').addEventListener('click', analisarLetra);
  $('#texto-analisar').value = $('#texto-analisar').placeholder;
  analisarLetra();
  await carregarDicionario();
  $('#status-dicionario').textContent = `Dicionário: ${fonteDicionario()}. Clique numa palavra para ver as rimas dela.`;
  if (!$('#busca-palavra').value) buscar('batalha');
}

