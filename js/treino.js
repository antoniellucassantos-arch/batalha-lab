// Página "Treinar": rodada de freestyle com beat, voz, estímulos e nota final.
// Uma rodada tem uma ou mais "voltas". Na batalha vs bot são 4: o bot ataca, você responde.
import { Beat, ESTILOS } from './beat.js';
import { VozNavegador, Gravador, Whisper, MODELOS_WHISPER, temWebSpeech, temMicrofone, blobParaAudio16k, segmentosParaBarras, falar } from './voz.js';
import { analisarTexto, renderizarAnalise, escapar } from './rima.js';
import { avaliarRodada, combinarVoltas, DIMENSOES } from './avaliacao.js';
import { carregarDicionario } from './dicionario.js';
import { TEMAS, PALAVRAS_SURPRESA, ATAQUES } from './dados.js';
import * as juiz from './juiz.js';
import { $, $$, sortear, formatarTempo, ler, salvar, salvarRodada, NOMES_MODO } from './util.js';

const beat = new Beat();
const whisper = new Whisper();
let rodada = null;

const MODOS_COM_BOT = new Set(['ataque', 'batalha']);
const VOLTAS_BATALHA = 4;

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
  iniciar(origem) {
    const falas = ['eu cheguei na roda pra mostrar meu talento', 'minha rima é pesada igual ao cimento', 'tu fala de relógio mas não tem o tempo',
      'eu sou a tempestade e tu é só o vento', 'isso aqui é batalha de rima', 'e eu sou a navalha que mira', 'teu flow é fraco, cadê o chinelo', 'eu rimo no beat e tu rima no espelho'];
    let i = 0;
    this.t = setInterval(() => {
      if (!rodada || rodada.fase !== 'rodando') return;
      const agora = performance.now() - origem;
      this.segs = [...this.segs, { texto: falas[i % falas.length], ini: agora - 2200, fim: agora }];
      i++;
      this.aoAtualizar(this.segs, '');
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
    microfone: $('#cfg-microfone').value,
    estilo: $('#cfg-estilo').value,
    bpm: Number($('#cfg-bpm').value),
    duracao: Number($('#cfg-duracao').value),
    compassos: Number($('#cfg-compassos').value),
    volume: Number($('#cfg-volume').value) / 100,
    motor: $('#cfg-motor').value,
    whisper: $('#cfg-whisper').value,
  };
}

function aplicarConfig(c) {
  if (!c) return;
  const radio = $(`input[name=modo][value="${c.modo}"]`);
  if (radio) radio.checked = true;
  if (c.microfone) $('#cfg-microfone').value = c.microfone;
  if (c.estilo && ESTILOS[c.estilo]) $('#cfg-estilo').value = c.estilo;
  if (c.bpm) $('#cfg-bpm').value = c.bpm;
  if (c.duracao) $('#cfg-duracao').value = c.duracao;
  if (c.compassos) $('#cfg-compassos').value = c.compassos;
  if (c.volume !== undefined) $('#cfg-volume').value = Math.round(c.volume * 100);
  if (c.motor) $('#cfg-motor').value = c.motor;
  if (c.whisper) $('#cfg-whisper').value = c.whisper;
}

function atualizarCampos() {
  const semMic = $('#cfg-microfone').value === 'nao';
  const motor = $('#cfg-motor').value;
  const modo = $('input[name=modo]:checked').value;
  $('#campo-motor').hidden = semMic;
  $('#campo-whisper').hidden = semMic || motor !== 'whisper';
  $('#campo-duracao').hidden = modo === 'batalha';
  $('#campo-compassos').hidden = modo !== 'batalha';
  if (semMic) {
    aviso('<b>Sem microfone:</b> o beat, o tempo e os ataques do bot rolam normal e você rima em voz alta. No final, se quiser nota, digite o que lembrar. Dica: se o fone não tem microfone, o microfone do celular ou do notebook funciona mesmo com o som indo pro fone.');
  } else if (motor === 'navegador' && !temWebSpeech) {
    aviso('Seu navegador não tem reconhecimento de voz em tempo real. Use <b>Chrome</b> ou <b>Edge</b>, escolha <b>Whisper</b> ou jogue <b>sem microfone</b>.');
  } else if (motor === 'whisper') {
    aviso('O Whisper roda no seu aparelho. Na primeira vez ele baixa o modelo (fica salvo no navegador) e a transcrição sai quando a rodada termina.');
  } else {
    aviso('');
  }
}

export function iniciarTreino() {
  const selEstilo = $('#cfg-estilo');
  selEstilo.innerHTML = Object.entries(ESTILOS).map(([k, e]) => `<option value="${k}">${e.nome} · ${e.bpm} BPM</option>`).join('');
  $('#cfg-whisper').innerHTML = MODELOS_WHISPER.map((m) => `<option value="${m.id}">${m.nome}</option>`).join('');
  $('#cfg-whisper').value = MODELOS_WHISPER[1].id;

  aplicarConfig(ler('config', null));
  if (!temWebSpeech) $('#cfg-motor').value = 'whisper';
  $('#cfg-bpm-valor').textContent = $('#cfg-bpm').value;

  selEstilo.addEventListener('change', () => {
    $('#cfg-bpm').value = ESTILOS[selEstilo.value].bpm;
    $('#cfg-bpm-valor').textContent = $('#cfg-bpm').value;
  });
  $('#cfg-bpm').addEventListener('input', (e) => { $('#cfg-bpm-valor').textContent = e.target.value; });
  $('#cfg-volume').addEventListener('input', (e) => beat.setVolume(Number(e.target.value) / 100));
  ['#cfg-motor', '#cfg-microfone'].forEach((s) => $(s).addEventListener('change', atualizarCampos));
  $$('input[name=modo]').forEach((r) => r.addEventListener('change', atualizarCampos));
  atualizarCampos();

  $('#btn-comecar').addEventListener('click', () => comecar());
  $('#btn-parar').addEventListener('click', () => encerrar(false));
  $('#btn-cancelar').addEventListener('click', () => encerrar(true));
}

// ---------------- rodada ----------------

async function comecar(cfgForcada) {
  const cfg = cfgForcada || lerConfig();
  salvar('config', cfg);
  const comMic = cfg.microfone !== 'nao';
  if (comMic && !SIMULAR) {
    if (!temMicrofone) { aviso('Este navegador não dá acesso ao microfone. Abra pelo link https do site ou pelo <b>iniciar.bat</b>, ou escolha <b>Sem microfone</b>.'); return; }
    if (cfg.motor === 'navegador' && !temWebSpeech) { atualizarCampos(); return; }
  }

  const batalha = cfg.modo === 'batalha';
  const nVoltas = batalha ? VOLTAS_BATALHA : 1;
  const ataques = MODOS_COM_BOT.has(cfg.modo) ? [...ATAQUES].sort(() => Math.random() - 0.5).slice(0, nVoltas) : [];
  rodada = {
    id: Date.now(),
    cfg,
    modo: cfg.modo,
    comMic,
    fase: 'preparando',
    origemMs: null, // início da primeira resposta: referência dos tempos da voz
    compassoInicio: null,
    segmentos: [],
    palavrasMostradas: [],
    encerrando: false,
    voltas: Array.from({ length: nVoltas }, (_, i) => ({ ataque: ataques[i] || null, ini: null, fim: null })),
    volta: 0,
    duracaoResposta: batalha ? cfg.compassos * (240 / cfg.bpm) : cfg.duracao,
  };

  if (comMic) {
    const gravador = SIMULAR ? new GravadorSimulado() : new Gravador();
    try {
      await gravador.abrir();
    } catch (err) {
      aviso('Não consegui acessar o microfone. Permita o microfone no cadeado da barra de endereço, ou escolha <b>Sem microfone</b>.');
      rodada = null;
      return;
    }
    rodada.gravador = gravador;
  }

  mostrarEtapa('treino-palco');
  $('#relogio').textContent = formatarTempo(rodada.duracaoResposta);
  $('#relogio').classList.remove('acabando');
  $('.medidor').hidden = !comMic;
  placeholderAoVivo();
  $('#info-compasso').textContent = 'preparando';
  $('#contagem').hidden = true;
  prepararEstimulo();

  beat.estilo = cfg.estilo;
  beat.bpm = cfg.bpm;
  beat.setVolume(cfg.volume);
  beat.aoTempo = aoTempo;
  await beat.iniciar();
  proximaVolta();
  animar();
}

function placeholderAoVivo() {
  const r = rodada;
  $('#ao-vivo').innerHTML = !r.comMic
    ? '<p class="placeholder">Sem microfone: rima em voz alta! Quando acabar, dá pra digitar o que lembrar e ganhar nota.</p>'
    : r.cfg.motor === 'whisper' && !SIMULAR
      ? '<p class="placeholder">Gravando… com o Whisper a transcrição aparece quando a rodada terminar.</p>'
      : '<p class="placeholder">A transcrição aparece aqui enquanto você rima…</p>';
}

function rotuloVolta() {
  return rodada.voltas.length > 1 ? `Volta ${rodada.volta + 1}/${rodada.voltas.length} · ` : '';
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
  } else if (m === 'livre') {
    el.innerHTML = '<div class="rotulo">Modo livre</div>';
  } else {
    el.innerHTML = '';
  }
}

function proximaVolta() {
  const v = rodada.voltas[rodada.volta];
  $('#relogio').textContent = formatarTempo(rodada.duracaoResposta);
  $('#relogio').classList.remove('acabando');
  if (v.ataque) {
    rodada.fase = 'cpu';
    $('#estimulo').innerHTML = `<div class="rotulo" id="rotulo-ataque">${rotuloVolta()}O bot ataca</div>
      <div class="ataque-cpu">${v.ataque.map((b) => `<p>${escapar(b)}</p>`).join('')}</div>`;
    $('#info-compasso').textContent = rotuloVolta() + 'vez do bot';
    if (rodada.volta > 0) placeholderAoVivo();
    lancarAtaque(v.ataque);
  } else {
    rodada.fase = 'contagem';
    rodada.compassoInicio = beat.compasso + 1;
  }
}

async function lancarAtaque(ataque) {
  const r = rodada;
  const linhas = $$('.ataque-cpu p');
  const comVoz = 'speechSynthesis' in window;
  beat.setVolume(r.cfg.volume * 0.45);
  for (let i = 0; i < ataque.length; i++) {
    if (rodada !== r || r.encerrando) return;
    linhas[i]?.classList.add('lida');
    if (comVoz) await falar(ataque[i]);
    else await new Promise((res) => setTimeout(res, beat.segPorCompasso * 1000));
  }
  if (rodada !== r || r.encerrando) return;
  beat.setVolume(r.cfg.volume);
  const rot = $('#rotulo-ataque');
  if (rot) rot.textContent = rotuloVolta() + 'Sua vez! Responde o bot';
  // contagem no próximo compasso e resposta no seguinte
  r.compassoInicio = beat.compasso + 2;
  r.fase = 'contagem';
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
    $('#info-compasso').textContent = rotuloVolta() + 'prepare-se';
  }
  if (rodada.fase === 'contagem' && compasso >= rodada.compassoInicio && tempo === 0) iniciarResposta();
  if (rodada.fase === 'rodando') {
    const n = compasso - rodada.compassoInicio;
    const total = rodada.modo === 'batalha' ? `/${rodada.cfg.compassos}` : '';
    $('#info-compasso').textContent = `${rotuloVolta()}sua vez · compasso ${n + 1}${total}`;
    if (rodada.modo === 'surpresa' && tempo === 0 && n % 2 === 0) novaSurpresa();
  }
}

function iniciarResposta() {
  const r = rodada;
  r.fase = 'rodando';
  const agora = performance.now();
  if (r.origemMs === null) {
    r.origemMs = agora;
    if (r.comMic) {
      r.gravador.gravar();
      if (r.cfg.motor === 'navegador' || SIMULAR) {
        r.voz = new (SIMULAR ? VozSimulada : VozNavegador)({
          aoAtualizar: (segs, interino) => {
            r.segmentos = segs;
            if (r.fase !== 'rodando') return;
            const v = r.voltas[r.volta];
            renderAoVivo(segs.filter((s) => s.ini >= v.ini - 600), interino);
          },
          aoErro: (erro) => {
            const msgs = {
              network: 'O reconhecimento do navegador precisa de internet. Sem conexão? Use o modo Whisper ou jogue sem microfone.',
              'not-allowed': 'Permissão de microfone negada para o reconhecimento de voz.',
              'audio-capture': 'Nenhum microfone encontrado. Escolha "Sem microfone" na configuração.',
              'language-not-supported': 'Este navegador não reconhece português. Use o Chrome ou o modo Whisper.',
            };
            $('#ao-vivo').insertAdjacentHTML('afterbegin', `<p class="aviso">${msgs[erro] || 'Erro no reconhecimento: ' + escapar(erro)}</p>`);
          },
        });
        r.voz.iniciar(r.origemMs);
      }
    }
  }
  const v = r.voltas[r.volta];
  v.ini = agora - r.origemMs;
  v.inicioPerf = agora;
  $('#contagem').hidden = true;
  clearInterval(r.timer);
  r.timer = setInterval(() => {
    const restante = r.duracaoResposta - (performance.now() - v.inicioPerf) / 1000;
    $('#relogio').textContent = formatarTempo(restante);
    $('#relogio').classList.toggle('acabando', restante <= 5);
    if (restante <= 0) fimResposta();
  }, 100);
}

function fimResposta() {
  const r = rodada;
  clearInterval(r.timer);
  r.voltas[r.volta].fim = performance.now() - r.origemMs;
  r.volta++;
  if (r.volta >= r.voltas.length) { encerrar(false); return; }
  proximaVolta();
}

function novaSurpresa() {
  const w = rodada.fila.pop();
  if (!w) return;
  const el = $('#palavra-surpresa');
  const ant = rodada.palavrasMostradas[rodada.palavrasMostradas.length - 1];
  if (ant) $('#surpresas-anteriores').insertAdjacentHTML('beforeend', `<span class="chip">${escapar(ant.palavra)}</span>`);
  rodada.palavrasMostradas.push({ palavra: w, t: performance.now() - rodada.origemMs });
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

async function transcreverWhisper(blob, r) {
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
    const fimTotal = r.voltas[r.voltas.length - 1].fim / 1000;
    return (res.chunks.length ? res.chunks : [{ text: res.texto, timestamp: [0, fimTotal] }])
      // o Whisper às vezes escreve [música], (risos) etc. no silêncio
      .map((c) => ({ texto: c.text.replace(/\[[^\]]*\]|\([^)]*\)|♪/g, '').trim(), ini: (c.timestamp?.[0] ?? 0) * 1000, fim: (c.timestamp?.[1] ?? fimTotal) * 1000 }))
      .filter((s) => s.texto);
  } catch (err) {
    console.error(err);
    $('#processando-texto').textContent = 'O Whisper falhou: ' + err.message;
    return [];
  }
}

async function encerrar(cancelado) {
  if (!rodada || rodada.encerrando) return;
  const r = rodada;
  r.encerrando = true;
  clearInterval(r.timer);
  cancelAnimationFrame(r.raf);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  beat.parar();

  // fecha a volta que estava rolando quando apertou "Parar"
  const atual = r.voltas[r.volta];
  if (atual && atual.ini !== null && atual.fim === null) atual.fim = performance.now() - r.origemMs;
  r.voltas = r.voltas.filter((v) => v.ini !== null && v.fim !== null);

  if (cancelado || !r.voltas.length) {
    r.voz?.cancelar();
    await r.gravador?.parar();
    rodada = null;
    mostrarEtapa('treino-config');
    return;
  }

  mostrarEtapa('treino-processando');
  $('#processando-texto').textContent = 'Fechando a rodada…';
  $('#processando-barra').style.width = '10%';

  let segmentos = r.voz ? await r.voz.parar() : [];
  const blob = r.gravador ? await r.gravador.parar() : null;
  if (r.comMic && r.cfg.motor === 'whisper' && !SIMULAR && blob) segmentos = await transcreverWhisper(blob, r);

  $('#processando-texto').textContent = 'Analisando suas rimas…';
  $('#processando-barra').style.width = '100%';
  await Promise.race([carregarDicionario(), new Promise((res) => setTimeout(res, 3000))]);

  // cada fala vai para a volta em que começou; o que caiu na vez do bot é descartado
  for (const v of r.voltas) {
    const segs = segmentos
      .filter((s) => s.ini >= v.ini - 600 && s.ini < v.fim + 300)
      .map((s) => ({ ...s, ini: Math.max(0, s.ini - v.ini), fim: s.fim - v.ini }));
    v.barras = barrasDe(segs);
    v.duracaoSeg = (v.fim - v.ini) / 1000;
    v.travadas = r.comMic ? contarTravadas(segs, v.fim - v.ini) : 0;
  }
  r.audioUrl = blob ? URL.createObjectURL(blob) : null;
  rodada = null;
  avaliarEExibir(r);
}

function extrasDe(r, v) {
  return {
    tema: r.tema?.tema,
    palavrasTema: r.tema?.palavras,
    // a última palavra só conta se apareceu pelo menos 1 compasso antes do fim
    palavrasMostradas: (r.palavrasMostradas || []).filter((p) => p.t < v.duracaoSeg * 1000 - beat.segPorCompasso * 1000).map((p) => p.palavra),
    ataque: v.ataque,
  };
}

function avaliarEExibir(r) {
  for (const v of r.voltas) {
    v.extras = extrasDe(r, v);
    v.resultado = v.barras.length
      ? avaliarRodada({
        barras: v.barras,
        // sem microfone o texto foi digitado depois, então não dá pra medir velocidade
        duracaoSeg: r.comMic ? v.duracaoSeg : 0,
        travadas: v.travadas,
        modo: v.ataque ? 'ataque' : r.modo,
        extras: v.extras,
      })
      : null;
  }
  const avaliadas = r.voltas.filter((v) => v.resultado);
  const geral = !avaliadas.length ? null
    : r.voltas.length === 1 ? avaliadas[0].resultado
    : combinarVoltas(avaliadas.map((v) => v.resultado), r.modo);
  r.geral = geral;
  if (geral) {
    salvarRodada({
      id: r.id,
      data: r.id,
      modo: r.modo,
      nota: geral.nota,
      dims: geral.dims,
      barras: r.voltas.flatMap((v) => v.barras),
      duracao: Math.round(r.voltas.reduce((s, v) => s + v.duracaoSeg, 0)),
      estilo: r.cfg.estilo,
      bpm: r.cfg.bpm,
      contexto: r.tema?.tema || (r.modo === 'batalha' ? `${r.voltas.length} voltas` : ''),
      semMic: !r.comMic,
    });
  }
  renderResultado(r, geral);
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

function tituloRodada(r) {
  const tempo = r.voltas.reduce((s, v) => s + v.duracaoSeg, 0);
  const base = r.modo === 'batalha'
    ? `${NOMES_MODO[r.modo]} · ${r.voltas.length} ${r.voltas.length === 1 ? 'volta' : 'voltas'} de ${r.cfg.compassos} compassos`
    : `${NOMES_MODO[r.modo]} · ${formatarTempo(tempo)}`;
  return `${base} · ${escapar(r.cfg.bpm)} BPM${r.comMic ? '' : ' · sem microfone'}`;
}

function painelTopo(r, geral) {
  if (!geral) {
    return r.comMic
      ? `<div class="painel"><h2>${tituloRodada(r)}</h2><p class="aviso">Não ouvi nada. Confira se o microfone certo está selecionado, fale mais perto dele, tente o modo Whisper, ou digite abaixo o que você rimou.</p></div>`
      : `<div class="painel"><h2>🎤 ${r.modo === 'batalha' ? 'Batalha concluída!' : 'Rodada concluída!'}</h2>
          <p>${tituloRodada(r)}. Sem microfone, ninguém ouviu, então quem julga é você.</p>
          <p class="nota-rodape">Quer nota? Digite o que lembrar de cada ${r.voltas.length > 1 ? 'volta' : 'rodada'} (uma barra por linha) e aperte <b>Avaliar</b>. O site mostra as rimas e se você respondeu na rima do bot.</p></div>`;
  }
  const s = geral.analise.stats;
  return `
    <div class="painel">
      <div class="resultado-topo">
        <div class="nota-circulo">${anel(geral.nota)}<div class="valor"><b>${geral.nota}</b><span>${escapar(geral.rotulo)}</span></div></div>
        <div>
          <h2>${tituloRodada(r)}</h2>
          <div class="dims">${Object.entries(geral.dims).map(([k, v]) => `
            <div class="dim"><span class="dim-nome">${DIMENSOES[k]}</span><div class="dim-barra"><span data-w="${v}"></span></div><span class="dim-valor">${v}</span></div>`).join('')}
          </div>
          <div class="chips" style="margin-top:16px">
            <span class="chip"><b>${s.barras}</b> barras</span>
            <span class="chip"><b>${s.palavras}</b> palavras</span>
            ${geral.ppm ? `<span class="chip"><b>${Math.round(geral.ppm)}</b> palavras/min</span>` : ''}
            <span class="chip"><b>${s.barrasComRima}</b> barras rimando</span>
            <span class="chip"><b>${s.perfeitas}</b> perfeitas · <b>${s.toantes}</b> toantes</span>
            <span class="chip"><b>${s.maiorMulti}</b> maior multi</span>
            <span class="chip"><b>${s.rimasInternas}</b> grupos de rima</span>
          </div>
        </div>
      </div>
    </div>`;
}

function painelVolta(r, v, i) {
  const res = v.resultado;
  const varias = r.voltas.length > 1;
  const contexto = r.modo === 'tema' ? `<p>Tema: <b>${escapar(r.tema.tema)}</b></p>`
    : r.modo === 'surpresa' ? `<p>Palavras: ${v.extras.palavrasMostradas.map((p) => `<span class="chip ${v.extras.palavrasUsadas?.includes(p) ? 'usada' : ''}">${escapar(p)}</span>`).join(' ')}</p>`
    : '';
  const corpo = v.barras.length ? renderizarAnalise(res.analise) : '<p class="placeholder">Sem transcrição.</p>';
  return `
    <div class="painel">
      <div class="volta-titulo"><h2>${varias ? `Volta ${i + 1}` : 'Suas barras'}</h2>${res ? `<span class="volta-nota">${res.nota}</span>` : ''}</div>
      ${contexto}
      ${v.ataque ? `<div class="rotulo-bot">Bot</div><div class="ataque-cpu">${v.ataque.map((b) => `<p class="lida">${escapar(b)}</p>`).join('')}</div><div class="rotulo-voce">Você</div>` : ''}
      <div class="letra-analisada">${corpo}</div>
      ${res && varias && res.detalhes.length ? `<div class="chips" style="margin-top:10px">${res.detalhes.map((d) => `<span class="chip">${escapar(d)}</span>`).join('')}</div>` : ''}
      <details style="margin-top:12px" ${!v.barras.length ? 'open' : ''}>
        <summary>${r.comMic ? 'Corrigir a transcrição' : 'Digitar o que você rimou'}</summary>
        <textarea class="texto-volta" data-volta="${i}" rows="5" placeholder="Uma barra por linha">${escapar(v.barras.join('\n'))}</textarea>
      </details>
    </div>`;
}

function renderResultado(r, geral) {
  const el = $('#treino-resultado');
  const unica = r.voltas.length === 1 ? r.voltas[0].resultado : null;
  el.innerHTML = `
    ${painelTopo(r, geral)}
    ${r.voltas.map((v, i) => painelVolta(r, v, i)).join('')}
    <div class="acoes-centro" style="margin-top:0"><button class="btn" id="btn-reavaliar">${geral ? 'Reavaliar com as correções' : 'Avaliar'}</button></div>
    <div class="legenda" style="justify-content:center"><span>Mesma cor = rima perfeita entre as palavras</span><span>Letra à esquerda = esquema de rima</span><span>Sublinhado = palavra que fecha a barra</span></div>

    ${geral ? `<div class="painel" style="margin-top:20px">
      <h2>O que treinar agora</h2>
      <ul class="dicas">${geral.dicas.map((d) => `<li><b>${d.dim}:</b> ${escapar(d.texto)}</li>`).join('')}</ul>
      ${unica?.detalhes.length ? `<div class="chips">${unica.detalhes.map((d) => `<span class="chip">${escapar(d)}</span>`).join('')}</div>` : ''}
    </div>` : ''}

    ${r.audioUrl ? `<div class="painel"><h2>Ouça sua rodada</h2><audio controls src="${r.audioUrl}" style="width:100%"></audio></div>` : ''}

    ${geral ? `<div class="painel" id="painel-juiz">
      <h2>Jurado IA <small class="nota-rodape">(opcional)</small></h2>
      ${juiz.temWebGPU()
        ? `<p>Um modelo de linguagem roda no seu navegador e dá um parecer por escrito, como um jurado. Na primeira vez baixa de 1 a 2,5 GB. Funciona no computador; no celular normalmente não roda.</p>
           <div class="acoes"><button class="btn btn-sec" id="btn-juiz">Chamar o jurado IA</button></div>
           <div id="juiz-area"></div>`
        : '<p class="nota-rodape">Seu navegador não tem WebGPU, então o jurado IA não está disponível. Ele funciona no Chrome ou Edge do computador, com placa de vídeo.</p>'}
    </div>` : ''}

    <div class="acoes-centro">
      <button class="btn btn-grande" id="btn-de-novo">↻ ${r.modo === 'batalha' ? 'Nova batalha' : 'Treinar de novo'}</button>
      <button class="btn btn-sec" id="btn-config">Mudar configuração</button>
    </div>`;

  mostrarEtapa('treino-resultado');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.dim-barra span', el).forEach((b) => { b.style.width = b.dataset.w + '%'; });
    const a = $('.anel-progresso', el);
    if (a) a.style.strokeDashoffset = a.dataset.alvo;
  }));

  $('#btn-reavaliar').addEventListener('click', () => {
    $$('.texto-volta', el).forEach((t) => {
      r.voltas[Number(t.dataset.volta)].barras = t.value.split('\n').map((l) => l.trim()).filter(Boolean);
    });
    avaliarEExibir(r);
  });
  $('#btn-de-novo').addEventListener('click', () => comecar(r.cfg));
  $('#btn-config').addEventListener('click', () => mostrarEtapa('treino-config'));
  $('#btn-juiz')?.addEventListener('click', () => abrirJuiz(r, geral));
}

function textoParaJuiz(r) {
  if (r.voltas.length === 1 && !r.voltas[0].ataque) return r.voltas[0].barras.join('\n');
  return r.voltas.map((v, i) => `[Volta ${i + 1}]\nBot: ${v.ataque.join(' / ')}\nMC:\n${v.barras.join('\n') || '(sem transcrição)'}`).join('\n\n');
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
      await juiz.julgar({ texto: textoParaJuiz(r), resultado: res, modo: NOMES_MODO[r.modo], contexto: r.tema?.tema }, (t) => { saida.textContent = t; });
      status.textContent = 'Parecer gerado no seu aparelho. A IA pode errar: use como opinião, não como verdade.';
    } catch (err) {
      status.textContent = 'Erro no jurado IA: ' + err.message;
    }
    $('#btn-julgar').disabled = false;
  });
}
