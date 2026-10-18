// Página "Treinar": rodada de freestyle com beat, voz, estímulos e nota final.
import { Beat, ESTILOS } from './beat.js';
import { VozNavegador, Gravador, Whisper, MODELOS_WHISPER, temWebSpeech, temMicrofone, blobParaAudio16k, segmentosParaBarras, falar } from './voz.js';
import { analisarTexto, renderizarAnalise, escapar } from './rima.js';
import { avaliarRodada, DIMENSOES } from './avaliacao.js';
import { carregarDicionario } from './dicionario.js';
import { TEMAS, PALAVRAS_SURPRESA, ATAQUES } from './dados.js';
import * as juiz from './juiz.js';
import { $, $$, sortear, formatarTempo, ler, salvar, salvarRodada, NOMES_MODO } from './util.js';

const beat = new Beat();
const whisper = new Whisper();
let rodada = null;

// ?simular na URL: roda sem microfone, com barras faladas de mentira (para testar o site)
const SIMULAR = new URLSearchParams(location.search).has('simular');
class GravadorSimulado {
  async abrir() {}
  gravar() {}
  nivel() { return Math.random() * 0.6; }
  async parar() { return null; }
}
class VozSimulada {
  constructor({ aoAtualizar }) { this.aoAtualizar = aoAtualizar; this.segs = []; }
  iniciar() {
    const falas = ['eu cheguei na roda pra mostrar meu talento', 'minha rima é pesada igual ao cimento', 'tu fala de relógio mas não tem o tempo',
      'eu sou a tempestade e tu é só o vento', 'isso aqui é batalha de rima', 'e eu sou a navalha que mira', 'teu flow é fraco, cadê o chinelo', 'eu rimo no beat e tu rima no espelho'];
    let i = 0;
    this.t = setInterval(() => {
      if (i >= falas.length) return;
      this.segs = [...this.segs, { texto: falas[i], ini: i * 2600, fim: i * 2600 + 2200 }];
      i++;
      this.aoAtualizar(this.segs, i < falas.length ? '…' : '');
    }, 2600);
  }
  parar() { clearInterval(this.t); return Promise.resolve(this.segs); }
  cancelar() { clearInterval(this.t); }
}

function mostrarEtapa(id) {
  ['treino-config', 'treino-palco', 'treino-processando', 'treino-resultado'].forEach((e) => { $('#' + e).hidden = e !== id; });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function aviso(msg) {
  const el = $('#aviso-voz');
  el.hidden = !msg;
  el.innerHTML = msg || '';
}

function lerConfig() {
  return {
    modo: $('input[name=modo]:checked').value,
    estilo: $('#cfg-estilo').value,
    bpm: Number($('#cfg-bpm').value),
    duracao: Number($('#cfg-duracao').value),
    volume: Number($('#cfg-volume').value) / 100,
    motor: $('#cfg-motor').value,
    whisper: $('#cfg-whisper').value,
  };
}

function aplicarConfig(c) {
  if (!c) return;
  const radio = $(`input[name=modo][value="${c.modo}"]`);
  if (radio) radio.checked = true;
  if (c.estilo && ESTILOS[c.estilo]) $('#cfg-estilo').value = c.estilo;
  if (c.bpm) $('#cfg-bpm').value = c.bpm;
  if (c.duracao) $('#cfg-duracao').value = c.duracao;
  if (c.volume !== undefined) $('#cfg-volume').value = Math.round(c.volume * 100);
  if (c.motor) $('#cfg-motor').value = c.motor;
  if (c.whisper) $('#cfg-whisper').value = c.whisper;
}

function atualizarCamposMotor() {
  const motor = $('#cfg-motor').value;
  $('#campo-whisper').hidden = motor !== 'whisper';
  if (motor === 'navegador' && !temWebSpeech) {
    aviso('Seu navegador não tem reconhecimento de voz em tempo real. Use <b>Chrome</b> ou <b>Edge</b>, ou escolha <b>Whisper offline</b>.');
  } else if (motor === 'whisper') {
    aviso('O Whisper roda no seu computador. Na primeira vez ele baixa o modelo (fica salvo no navegador) e a transcrição sai quando a rodada termina.');
  } else {
    aviso('');
  }
}

export function iniciarTreino() {
  const selEstilo = $('#cfg-estilo');
  selEstilo.innerHTML = Object.entries(ESTILOS).map(([k, e]) => `<option value="${k}">${e.nome} · ${e.bpm} BPM</option>`).join('');
  $('#cfg-whisper').innerHTML = MODELOS_WHISPER.map((m) => `<option value="${m.id}">${m.nome}</option>`).join('');
  $('#cfg-whisper').value = MODELOS_WHISPER[1].id;
  if (!temWebSpeech) $('#cfg-motor').value = 'whisper';

  aplicarConfig(ler('config', null));
  if (!temWebSpeech) $('#cfg-motor').value = 'whisper';
  $('#cfg-bpm-valor').textContent = $('#cfg-bpm').value;

  selEstilo.addEventListener('change', () => {
    $('#cfg-bpm').value = ESTILOS[selEstilo.value].bpm;
    $('#cfg-bpm-valor').textContent = $('#cfg-bpm').value;
  });
  $('#cfg-bpm').addEventListener('input', (e) => { $('#cfg-bpm-valor').textContent = e.target.value; });
  $('#cfg-volume').addEventListener('input', (e) => beat.setVolume(Number(e.target.value) / 100));
  $('#cfg-motor').addEventListener('change', atualizarCamposMotor);
  atualizarCamposMotor();

  $('#btn-comecar').addEventListener('click', () => comecar());
  $('#btn-parar').addEventListener('click', () => encerrar(false));
  $('#btn-cancelar').addEventListener('click', () => encerrar(true));
}

// ---------------- rodada ----------------

async function comecar(cfgForcada) {
  const cfg = cfgForcada || lerConfig();
  salvar('config', cfg);
  if (!temMicrofone && !SIMULAR) { aviso('Este navegador não dá acesso ao microfone. Abra o site pelo <b>iniciar.bat</b> (http://localhost) no Chrome ou Edge.'); return; }
  if (cfg.motor === 'navegador' && !temWebSpeech && !SIMULAR) { atualizarCamposMotor(); return; }

  rodada = {
    id: Date.now(),
    cfg,
    modo: cfg.modo,
    fase: 'preparando',
    inicioMs: null,
    compassoInicio: null,
    segmentos: [],
    palavrasMostradas: [],
    encerrando: false,
  };

  const gravador = SIMULAR ? new GravadorSimulado() : new Gravador();
  try {
    await gravador.abrir();
  } catch (err) {
    aviso('Não consegui acessar o microfone. Clique no cadeado da barra de endereço e permita o microfone para este site.');
    return;
  }
  rodada.gravador = gravador;

  mostrarEtapa('treino-palco');
  $('#relogio').textContent = formatarTempo(cfg.duracao);
  $('#relogio').classList.remove('acabando');
  $('#ao-vivo').innerHTML = cfg.motor === 'whisper'
    ? '<p class="placeholder">Gravando… com o Whisper a transcrição aparece quando a rodada terminar.</p>'
    : '<p class="placeholder">A transcrição aparece aqui enquanto você rima…</p>';
  $('#info-compasso').textContent = 'preparando';
  $('#contagem').hidden = true;
  prepararEstimulo();

  beat.estilo = cfg.estilo;
  beat.bpm = cfg.bpm;
  beat.setVolume(cfg.volume);
  beat.aoTempo = aoTempo;
  await beat.iniciar();

  if (cfg.modo === 'ataque') {
    rodada.fase = 'cpu';
    lancarAtaque();
  } else {
    rodada.fase = 'contagem';
    rodada.compassoInicio = 1;
  }
  animar();
}

function prepararEstimulo() {
  const el = $('#estimulo');
  const m = rodada.modo;
  if (m === 'tema') {
    rodada.tema = sortear(TEMAS);
    el.innerHTML = `<div class="rotulo">Tema</div><div class="grande">${escapar(rodada.tema.tema)}</div>
      <div class="chips">${rodada.tema.palavras.slice(0, 6).map((p) => `<span class="chip">${escapar(p)}</span>`).join('')}</div>`;
  } else if (m === 'surpresa') {
    rodada.fila = [...PALAVRAS_SURPRESA].sort(() => Math.random() - 0.5);
    el.innerHTML = '<div class="rotulo">Palavra-surpresa</div><div class="grande" id="palavra-surpresa">prepare-se</div><div class="chips" id="surpresas-anteriores"></div>';
  } else if (m === 'ataque') {
    rodada.ataque = sortear(ATAQUES);
    el.innerHTML = `<div class="rotulo">O computador ataca</div><div class="ataque-cpu">${rodada.ataque.map((b) => `<p>${escapar(b)}</p>`).join('')}</div>`;
  } else {
    el.innerHTML = '<div class="rotulo">Modo livre</div>';
  }
}

async function lancarAtaque() {
  const linhas = $$('.ataque-cpu p');
  const comVoz = 'speechSynthesis' in window;
  beat.setVolume(rodada.cfg.volume * 0.45);
  for (let i = 0; i < rodada.ataque.length; i++) {
    if (!rodada || rodada.encerrando) return;
    linhas[i]?.classList.add('lida');
    if (comVoz) await falar(rodada.ataque[i]);
    else await new Promise((r) => setTimeout(r, beat.segPorCompasso * 1000));
  }
  if (!rodada || rodada.encerrando) return;
  beat.setVolume(rodada.cfg.volume);
  // contagem no próximo compasso e resposta no seguinte
  rodada.compassoInicio = beat.compasso + 2;
  rodada.fase = 'contagem';
}

function aoTempo({ tempo, compasso }) {
  if (!rodada) return;
  $$('#pulso i').forEach((el, i) => {
    el.classList.toggle('on', i === tempo);
    el.classList.toggle('forte', i === tempo && tempo === 0);
  });
  if (rodada.fase === 'contagem' && compasso === rodada.compassoInicio - 1) {
    const c = $('#contagem');
    c.hidden = false;
    c.textContent = String(4 - tempo);
    $('#info-compasso').textContent = 'prepare-se';
  }
  if (rodada.fase === 'contagem' && compasso >= rodada.compassoInicio && tempo === 0) iniciarResposta();
  if (rodada.fase === 'rodando') {
    const n = compasso - rodada.compassoInicio;
    $('#info-compasso').textContent = `compasso ${n + 1}`;
    if (rodada.modo === 'surpresa' && tempo === 0 && n % 2 === 0) novaSurpresa();
  }
}

function iniciarResposta() {
  rodada.fase = 'rodando';
  rodada.inicioMs = performance.now();
  $('#contagem').hidden = true;
  rodada.gravador.gravar();
  if (rodada.cfg.motor === 'navegador' || SIMULAR) {
    rodada.voz = new (SIMULAR ? VozSimulada : VozNavegador)({
      aoAtualizar: (segs, interino) => { rodada.segmentos = segs; renderAoVivo(segs, interino); },
      aoErro: (erro) => {
        const msgs = {
          network: 'O reconhecimento do navegador precisa de internet. Sem conexão? Use o modo Whisper offline.',
          'not-allowed': 'Permissão de microfone negada para o reconhecimento de voz.',
          'audio-capture': 'Nenhum microfone encontrado.',
          'language-not-supported': 'Este navegador não reconhece português. Use o Chrome ou o modo Whisper.',
        };
        $('#ao-vivo').insertAdjacentHTML('afterbegin', `<p class="aviso">${msgs[erro] || 'Erro no reconhecimento: ' + escapar(erro)}</p>`);
      },
    });
    rodada.voz.iniciar(rodada.inicioMs);
  }
  rodada.timer = setInterval(() => {
    const restante = rodada.cfg.duracao - (performance.now() - rodada.inicioMs) / 1000;
    $('#relogio').textContent = formatarTempo(restante);
    $('#relogio').classList.toggle('acabando', restante <= 5);
    if (restante <= 0) encerrar(false);
  }, 100);
}

function novaSurpresa() {
  const w = rodada.fila.pop();
  if (!w) return;
  const el = $('#palavra-surpresa');
  const ant = rodada.palavrasMostradas[rodada.palavrasMostradas.length - 1];
  if (ant) $('#surpresas-anteriores').insertAdjacentHTML('beforeend', `<span class="chip">${escapar(ant.palavra)}</span>`);
  rodada.palavrasMostradas.push({ palavra: w, t: performance.now() - rodada.inicioMs });
  el.textContent = w;
  el.classList.remove('nova');
  void el.offsetWidth;
  el.classList.add('nova');
}

function barrasDe(segmentos) {
  return segmentosParaBarras(segmentos, { msPorCompasso: beat.segPorCompasso * 1000 });
}

function renderAoVivo(segs, interino) {
  const el = $('#ao-vivo');
  const analise = analisarTexto(barrasDe(segs));
  el.innerHTML = (analise.linhas.length ? renderizarAnalise(analise) : '') + (interino ? `<p class="interino">${escapar(interino)}</p>` : '');
  if (!analise.linhas.length && !interino) el.innerHTML = '<p class="placeholder">Ouvindo…</p>';
  el.scrollTop = el.scrollHeight;
}

function animar() {
  if (!rodada || rodada.encerrando) return;
  const n = rodada.gravador?.nivel() || 0;
  $('#medidor-mic').style.width = Math.round(n * 100) + '%';
  rodada.raf = requestAnimationFrame(animar);
}

function contarTravadas(segs, duracaoMs) {
  if (!segs.length) return duracaoMs > 8000 ? 2 : 0;
  let t = 0;
  if (segs[0].ini > 4000) t++;
  for (let i = 1; i < segs.length; i++) if (segs[i].ini - segs[i - 1].fim > 3500) t++;
  if (duracaoMs - segs[segs.length - 1].fim > 4500) t++;
  return t;
}

async function encerrar(cancelado) {
  if (!rodada || rodada.encerrando) return;
  const r = rodada;
  r.encerrando = true;
  clearInterval(r.timer);
  cancelAnimationFrame(r.raf);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const duracaoMs = r.inicioMs ? performance.now() - r.inicioMs : 0;
  beat.parar();

  if (cancelado || !r.inicioMs) {
    r.voz?.cancelar();
    await r.gravador.parar();
    rodada = null;
    mostrarEtapa('treino-config');
    return;
  }

  mostrarEtapa('treino-processando');
  $('#processando-texto').textContent = 'Fechando a rodada…';
  $('#processando-barra').style.width = '10%';

  let segmentos = r.voz ? await r.voz.parar() : [];
  const blob = await r.gravador.parar();

  if (r.cfg.motor === 'whisper' && !SIMULAR) {
    try {
      $('#processando-texto').textContent = 'Preparando o Whisper…';
      const audio = await blobParaAudio16k(blob);
      const res = await whisper.transcrever(audio, r.cfg.whisper, (p) => {
        if (p.status === 'progress' && p.total) {
          $('#processando-texto').textContent = `Baixando modelo (só na primeira vez): ${p.file || ''}`;
          $('#processando-barra').style.width = Math.round(p.progress || 0) + '%';
        } else if (p.status === 'transcrevendo') {
          $('#processando-texto').textContent = 'Transcrevendo sua voz com o Whisper…';
          $('#processando-barra').style.width = '90%';
        }
      });
      segmentos = (res.chunks.length ? res.chunks : [{ text: res.texto, timestamp: [0, duracaoMs / 1000] }])
        // o Whisper às vezes escreve [música], (risos) etc. no silêncio
        .map((c) => ({ texto: c.text.replace(/\[[^\]]*\]|\([^)]*\)|♪/g, '').trim(), ini: (c.timestamp?.[0] ?? 0) * 1000, fim: (c.timestamp?.[1] ?? duracaoMs / 1000) * 1000 }))
        .filter((s) => s.texto);
    } catch (err) {
      console.error(err);
      $('#processando-texto').textContent = 'O Whisper falhou: ' + err.message;
      segmentos = [];
    }
  }

  $('#processando-texto').textContent = 'Analisando suas rimas…';
  $('#processando-barra').style.width = '100%';
  await Promise.race([carregarDicionario(), new Promise((res) => setTimeout(res, 3000))]);

  r.barras = barrasDe(segmentos);
  r.duracaoSeg = duracaoMs / 1000;
  r.travadas = contarTravadas(segmentos, duracaoMs);
  r.audioUrl = blob ? URL.createObjectURL(blob) : null;
  rodada = null;
  avaliarEExibir(r);
}

function extrasDe(r) {
  return {
    tema: r.tema?.tema,
    palavrasTema: r.tema?.palavras,
    // a última palavra só conta se apareceu pelo menos 1 compasso antes do fim
    palavrasMostradas: (r.palavrasMostradas || []).filter((p) => p.t < r.duracaoSeg * 1000 - beat.segPorCompasso * 1000).map((p) => p.palavra),
    ataque: r.ataque,
  };
}

function avaliarEExibir(r) {
  const extras = extrasDe(r);
  const res = avaliarRodada({ barras: r.barras, duracaoSeg: r.duracaoSeg, travadas: r.travadas, modo: r.modo, extras });
  r.resultado = res;
  salvarRodada({
    id: r.id,
    data: r.id,
    modo: r.modo,
    nota: res.nota,
    dims: res.dims,
    barras: r.barras,
    duracao: Math.round(r.duracaoSeg),
    estilo: r.cfg.estilo,
    bpm: r.cfg.bpm,
    contexto: r.tema?.tema || '',
  });
  renderResultado(r, res, extras);
}

function anel(nota) {
  const raio = 88;
  const circ = 2 * Math.PI * raio;
  const cor = nota >= 75 ? 'var(--verde)' : nota >= 50 ? 'var(--amarelo)' : 'var(--rosa)';
  return `<svg width="200" height="200" viewBox="0 0 200 200">
    <circle cx="100" cy="100" r="${raio}" fill="none" stroke="var(--painel-2)" stroke-width="14"/>
    <circle cx="100" cy="100" r="${raio}" fill="none" stroke="${cor}" stroke-width="14" stroke-linecap="round"
      stroke-dasharray="${circ}" stroke-dashoffset="${circ}" class="anel-progresso" data-alvo="${circ * (1 - nota / 100)}" style="transition: stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)"/>
  </svg>`;
}

function renderResultado(r, res, extras) {
  const s = res.analise.stats;
  const el = $('#treino-resultado');
  const vazio = !r.barras.length;
  const contexto = r.modo === 'tema' ? `Tema: <b>${escapar(r.tema.tema)}</b>`
    : r.modo === 'surpresa' ? `Palavras: ${extras.palavrasMostradas.map((p) => `<span class="chip ${extras.palavrasUsadas?.includes(p) ? 'usada' : ''}">${escapar(p)}</span>`).join(' ')}`
    : r.modo === 'ataque' ? 'Ataque do computador:' : '';

  el.innerHTML = `
    <div class="painel">
      <div class="resultado-topo">
        <div class="nota-circulo">${anel(res.nota)}<div class="valor"><b>${res.nota}</b><span>${escapar(res.rotulo)}</span></div></div>
        <div>
          <h2>${NOMES_MODO[r.modo]} · ${formatarTempo(r.duracaoSeg)} · ${escapar(r.cfg.bpm)} BPM</h2>
          <div class="dims">${Object.entries(res.dims).map(([k, v]) => `
            <div class="dim"><span class="dim-nome">${DIMENSOES[k]}</span><div class="dim-barra"><span data-w="${v}"></span></div><span class="dim-valor">${v}</span></div>`).join('')}
          </div>
          <div class="chips" style="margin-top:16px">
            <span class="chip"><b>${s.barras}</b> barras</span>
            <span class="chip"><b>${s.palavras}</b> palavras</span>
            ${res.ppm ? `<span class="chip"><b>${Math.round(res.ppm)}</b> palavras/min</span>` : ''}
            <span class="chip"><b>${s.barrasComRima}</b> barras rimando</span>
            <span class="chip"><b>${s.perfeitas}</b> perfeitas · <b>${s.toantes}</b> toantes</span>
            <span class="chip"><b>${s.maiorMulti}</b> maior multi</span>
            <span class="chip"><b>${s.rimasInternas}</b> grupos de rima</span>
            ${r.travadas ? `<span class="chip"><b>${r.travadas}</b> travadas</span>` : ''}
          </div>
        </div>
      </div>
    </div>

    ${vazio ? `<div class="painel aviso">Não ouvi nada. Confira se o microfone certo está selecionado, fale mais perto dele ou tente o modo Whisper.</div>` : ''}

    <div class="painel">
      <h2>Suas barras</h2>
      ${contexto ? `<p>${contexto}</p>` : ''}
      ${r.modo === 'ataque' ? `<div class="ataque-cpu" style="margin-bottom:14px">${r.ataque.map((b) => `<p class="lida">${escapar(b)}</p>`).join('')}</div>` : ''}
      <div class="letra-analisada">${vazio ? '<p class="placeholder">Sem transcrição.</p>' : renderizarAnalise(res.analise)}</div>
      <div class="legenda"><span>Mesma cor = rima perfeita entre as palavras</span><span>Letra à esquerda = esquema de rima</span><span>Sublinhado = palavra que fecha a barra</span></div>
      <details style="margin-top:14px">
        <summary>Corrigir a transcrição e reavaliar</summary>
        <p class="nota-rodape">O reconhecimento de voz erra às vezes. Corrija as palavras e quebre as barras (uma por linha).</p>
        <textarea id="texto-corrigir" rows="8">${escapar(r.barras.join('\n'))}</textarea>
        <div class="acoes"><button class="btn btn-peq" id="btn-reavaliar">Reavaliar</button></div>
      </details>
    </div>

    <div class="painel">
      <h2>O que treinar agora</h2>
      <ul class="dicas">${res.dicas.map((d) => `<li><b>${d.dim}:</b> ${escapar(d.texto)}</li>`).join('')}</ul>
      ${res.detalhes.length ? `<div class="chips">${res.detalhes.map((d) => `<span class="chip">${escapar(d)}</span>`).join('')}</div>` : ''}
    </div>

    ${r.audioUrl ? `<div class="painel"><h2>Ouça sua rodada</h2><audio controls src="${r.audioUrl}" style="width:100%"></audio></div>` : ''}

    <div class="painel" id="painel-juiz">
      <h2>Jurado IA <small class="nota-rodape">(opcional)</small></h2>
      ${juiz.temWebGPU()
        ? `<p>Um modelo de linguagem roda no seu navegador e dá um parecer por escrito, como um jurado. Na primeira vez baixa de 1 a 2 GB.</p>
           <div class="acoes"><button class="btn btn-sec" id="btn-juiz">Chamar o jurado IA</button></div>
           <div id="juiz-area"></div>`
        : '<p class="nota-rodape">Seu navegador não tem WebGPU, então o jurado IA não está disponível. Ele funciona no Chrome ou Edge atualizados, com placa de vídeo.</p>'}
    </div>

    <div class="acoes-centro">
      <button class="btn btn-grande" id="btn-de-novo">↻ Treinar de novo</button>
      <button class="btn btn-sec" id="btn-config">Mudar configuração</button>
    </div>`;

  mostrarEtapa('treino-resultado');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.dim-barra span', el).forEach((b) => { b.style.width = b.dataset.w + '%'; });
    const a = $('.anel-progresso', el);
    if (a) a.style.strokeDashoffset = a.dataset.alvo;
  }));

  $('#btn-reavaliar').addEventListener('click', () => {
    r.barras = $('#texto-corrigir').value.split('\n').map((l) => l.trim()).filter(Boolean);
    avaliarEExibir(r);
  });
  $('#btn-de-novo').addEventListener('click', () => comecar(r.cfg));
  $('#btn-config').addEventListener('click', () => mostrarEtapa('treino-config'));
  $('#btn-juiz')?.addEventListener('click', () => abrirJuiz(r, res));
}

async function abrirJuiz(r, res) {
  const area = $('#juiz-area');
  $('#btn-juiz').disabled = true;
  area.innerHTML = '<p class="nota-rodape">Carregando a lista de modelos…</p>';
  let modelos;
  try {
    modelos = await juiz.listarModelos();
  } catch (err) {
    area.innerHTML = `<p class="aviso">Não consegui carregar o WebLLM: ${escapar(err.message)}</p>`;
    $('#btn-juiz').disabled = false;
    return;
  }
  if (!modelos.length) { area.innerHTML = '<p class="aviso">Nenhum modelo compatível encontrado.</p>'; return; }
  const salvo = ler('modeloJuiz', modelos[modelos.length - 1].id);
  area.innerHTML = `
    <div class="campo" style="margin-top:12px">
      <label for="sel-modelo-juiz">Modelo</label>
      <select id="sel-modelo-juiz">${modelos.map((m) => `<option value="${m.id}" ${m.id === salvo ? 'selected' : ''}>${m.id}${m.vram ? ` (~${(m.vram / 1024).toFixed(1)} GB de memória de vídeo)` : ''}</option>`).join('')}</select>
    </div>
    <div class="acoes"><button class="btn" id="btn-julgar">Carregar e avaliar</button></div>
    <p class="nota-rodape" id="juiz-status"></p>
    <div class="juiz-saida" id="juiz-saida" hidden></div>`;
  $('#btn-julgar').addEventListener('click', async () => {
    const modelo = $('#sel-modelo-juiz').value;
    salvar('modeloJuiz', modelo);
    $('#btn-julgar').disabled = true;
    const status = $('#juiz-status');
    try {
      await juiz.carregarJuiz(modelo, (p) => { status.textContent = p.text || ''; });
      status.textContent = 'O jurado está escrevendo…';
      const saida = $('#juiz-saida');
      saida.hidden = false;
      await juiz.julgar({ texto: r.barras.join('\n'), resultado: res, modo: NOMES_MODO[r.modo], contexto: r.tema?.tema }, (t) => { saida.textContent = t; });
      status.textContent = 'Parecer gerado no seu computador. A IA pode errar: use como opinião, não como verdade.';
    } catch (err) {
      status.textContent = 'Erro no jurado IA: ' + err.message;
    }
    $('#btn-julgar').disabled = false;
  });
}
