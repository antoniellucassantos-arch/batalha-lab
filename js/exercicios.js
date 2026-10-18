// Página "Exercícios": drills curtos com voz ou teclado.
import { analisar, compararRima, tamanhoMulti, palavrasDe, limpar, contarSilabas, marcarTonica, vogaisDoTrecho, escapar, NIVEIS, STOPWORDS } from './rima.js';
import { Escuta, temWebSpeech } from './voz.js';
import { carregarDicionario, buscarRimas } from './dicionario.js';
import { SEMENTES_CORRENTE, BARRAS_INICIO, ALVOS_MULTI, SEMENTES_ASSOCIACAO } from './dados.js';
import { $, $$, sortear, formatarTempo, recorde } from './util.js';

let atual = null; // { parar() }

function pararAtual() {
  atual?.parar?.();
  atual = null;
}

// Campo de texto + botão de microfone. aoEnviar recebe cada frase.
function criarEntrada(container, { aoEnviar, placeholder = 'Digite e aperte Enter' }) {
  container.insertAdjacentHTML('beforeend', `
    <div class="entrada">
      <input type="text" placeholder="${placeholder}" autocomplete="off">
      ${temWebSpeech ? '<button class="btn btn-mic" title="Falar no microfone" aria-label="Falar no microfone">🎤</button>' : ''}
      <button class="btn btn-sec btn-enviar">Enviar</button>
    </div>
    <div class="parcial"></div>`);
  const input = $('.entrada input', container);
  const btnMic = $('.btn-mic', container);
  const parcial = $('.parcial', container);
  let escuta = null;

  const enviar = () => {
    const t = input.value.trim();
    if (t) aoEnviar(t);
    input.value = '';
    input.focus();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
  $('.btn-enviar', container).addEventListener('click', enviar);

  const pararMic = () => {
    if (!escuta) return;
    escuta.parar();
    escuta = null;
    btnMic?.classList.remove('gravando');
    parcial.textContent = '';
  };
  const ligarMic = () => {
    if (escuta || !temWebSpeech) return;
    escuta = new Escuta({
      aoParcial: (_f, interino) => { parcial.textContent = interino ? '… ' + interino : ''; },
      aoFinal: (t) => aoEnviar(t),
      aoErro: (e) => {
        const msg = {
          network: 'O reconhecimento do navegador precisa de internet. Digite as respostas.',
          'not-allowed': 'Microfone bloqueado. Permita no cadeado da barra de endereço ou digite as respostas.',
          'audio-capture': 'Nenhum microfone encontrado. Digite as respostas.',
        }[e] || 'Erro no microfone: ' + e;
        pararMic();
        parcial.textContent = msg;
      },
    });
    escuta.iniciar();
    btnMic?.classList.add('gravando');
  };
  btnMic?.addEventListener('click', () => (escuta ? pararMic() : ligarMic()));
  return { ligarMic, pararMic, focar: () => input.focus(), desativar: (v) => { input.disabled = v; if (btnMic) btnMic.disabled = v; } };
}

function cabecalho(titulo, extra = '') {
  return `<div class="exercicio-topo"><h2>${titulo}</h2><div class="acoes" style="margin:0">${extra}<button class="btn btn-sec btn-peq" data-fechar>✕ Fechar</button></div></div>`;
}

function abrir(html) {
  const area = $('#area-exercicio');
  area.innerHTML = `<div class="exercicio">${html}</div>`;
  $('[data-fechar]', area).addEventListener('click', () => { pararAtual(); area.innerHTML = ''; $$('#lista-exercicios .cartao').forEach((c) => c.classList.remove('sel')); });
  area.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return $('.exercicio', area);
}

function chipNivel(palavra, nivel) {
  return `<span class="chip ${nivel}" title="${NIVEIS[nivel].nome}">${escapar(palavra)}</span>`;
}

// ---------- Corrente de rimas ----------
function corrente() {
  const alvo = sortear(SEMENTES_CORRENTE);
  const aAlvo = analisar(alvo);
  const box = abrir(`
    ${cabecalho('⛓️ Corrente de rimas', '<button class="btn btn-sec btn-peq" data-nova>Nova palavra</button>')}
    <div class="alvo"><div class="rotulo">Rime com</div><div class="grande">${marcarTonica(alvo)}</div>
      <div class="sub">a rima começa em <b>-${escapar(limpar(alvo).slice(aAlvo.srcTonica))}</b> · ${aAlvo.tipo}</div></div>
    <div class="placar"><div><b data-tempo>0:30</b><span>tempo</span></div><div><b data-pontos>0</b><span>pontos</span></div><div><b data-perf>0</b><span>perfeitas</span></div><div><b data-toan>0</b><span>toantes</span></div></div>
    <div class="acoes-centro"><button class="btn btn-grande" data-comecar>▶ Começar (30s)</button></div>
    <div data-entrada hidden></div>
    <div class="chips" data-chips style="margin-top:14px"></div>
    <div data-fim></div>`);
  $('[data-nova]', box).addEventListener('click', () => { pararAtual(); corrente(); });

  const vistas = new Set();
  let pontos = 0; let perf = 0; let toan = 0; let rodando = false; let timer;
  const entrada = criarEntrada($('[data-entrada]', box), {
    placeholder: 'Fale ou digite rimas (pode mandar várias de uma vez)',
    aoEnviar: (texto) => {
      if (!rodando) return;
      for (const p of palavrasDe(texto)) {
        const w = limpar(p);
        if (w.length < 2 || vistas.has(w) || (STOPWORDS.has(w) && w !== alvo)) continue;
        vistas.add(w);
        const r = compararRima(aAlvo, analisar(w));
        if (r.nivel === 'perfeita' || r.nivel === 'quase') { pontos += 3; perf++; }
        else if (r.nivel === 'toante' || r.nivel === 'toanteFraca') { pontos += 1; toan++; }
        $('[data-chips]', box).insertAdjacentHTML('beforeend', chipNivel(w, r.nivel));
      }
      $('[data-pontos]', box).textContent = pontos;
      $('[data-perf]', box).textContent = perf;
      $('[data-toan]', box).textContent = toan;
    },
  });

  const terminar = async () => {
    rodando = false;
    clearInterval(timer);
    entrada.pararMic();
    entrada.desativar(true);
    const rec = recorde('corrente', pontos);
    await carregarDicionario();
    const sugestoes = (buscarRimas(alvo)?.perfeitas || []).filter((x) => !vistas.has(x.w)).slice(0, 24);
    $('[data-fim]', box).innerHTML = `
      <div class="painel" style="margin-top:16px">
        <h3>${pontos} pontos ${rec.novo ? '· 🏆 novo recorde!' : `· recorde: ${rec.valor}`}</h3>
        <p class="nota-rodape">Rimas que você podia ter usado:</p>
        <div class="chips">${sugestoes.map((x) => `<span class="chip">${escapar(x.w)}</span>`).join('') || '—'}</div>
        <div class="acoes"><button class="btn" data-repetir>Outra palavra</button></div>
      </div>`;
    $('[data-repetir]', box).addEventListener('click', corrente);
  };

  $('[data-comecar]', box).addEventListener('click', (e) => {
    e.target.closest('.acoes-centro').hidden = true;
    $('[data-entrada]', box).hidden = false;
    rodando = true;
    const fim = performance.now() + 30000;
    entrada.ligarMic();
    entrada.focar();
    timer = setInterval(() => {
      const rest = (fim - performance.now()) / 1000;
      $('[data-tempo]', box).textContent = formatarTempo(rest);
      if (rest <= 0) terminar();
    }, 200);
  });
  atual = { parar: () => { clearInterval(timer); entrada.pararMic(); } };
}

// ---------- Completa a barra ----------
function completar() {
  const barra1 = sortear(BARRAS_INICIO);
  const p1 = palavrasDe(barra1);
  const fim1 = p1[p1.length - 1];
  const sil1 = contarSilabas(barra1);
  const box = abrir(`
    ${cabecalho('✍️ Completa a barra', '<button class="btn btn-sec btn-peq" data-nova>Próxima barra</button>')}
    <div class="alvo"><div class="rotulo">Primeira barra</div>
      <div class="frase">${escapar(p1.slice(0, -1).join(' '))} <span class="rg g0">${marcarTonica(fim1)}</span></div>
      <div class="sub">${sil1} sílabas · sua barra precisa rimar com <b>${escapar(fim1)}</b></div></div>
    <div data-entrada></div>
    <div class="acoes"><button class="btn btn-sec btn-peq" data-dica>💡 Ver rimas para "${escapar(fim1)}"</button></div>
    <div data-dicas></div>
    <div class="tentativas" data-tentativas></div>`);
  $('[data-nova]', box).addEventListener('click', () => { pararAtual(); completar(); });
  $('[data-dica]', box).addEventListener('click', async () => {
    await carregarDicionario();
    const r = buscarRimas(fim1);
    const lista = [...(r?.multis || []).slice(0, 8), ...(r?.perfeitas || []).slice(0, 20)];
    const unicas = [...new Set(lista.map((x) => x.w))];
    $('[data-dicas]', box).innerHTML = `<div class="chips" style="margin-top:10px">${unicas.map((w) => `<span class="chip">${escapar(w)}</span>`).join('') || 'Nenhuma encontrada.'}</div>`;
  });

  const entrada = criarEntrada($('[data-entrada]', box), {
    placeholder: 'Sua segunda barra…',
    aoEnviar: (texto) => {
      const p2 = palavrasDe(texto);
      if (!p2.length) return;
      const fim2 = p2[p2.length - 1];
      const r = compararRima(fim1, fim2);
      const multi = r.score >= 0.45 && r.nivel !== 'repetida' ? tamanhoMulti(p1, p2) : 0;
      const sil2 = contarSilabas(texto);
      const dif = Math.abs(sil2 - sil1);
      const nota = Math.round(r.score * 60 + (Math.min(multi, 5) / 5) * 25 + (1 - Math.min(1, dif / 6)) * 15);
      const comentario = r.nivel === 'nenhuma' ? 'Não rimou. Termine com uma palavra que soe como "' + fim1 + '".'
        : r.nivel === 'repetida' ? 'Rimou a palavra com ela mesma. Vale pouco.'
        : multi >= 3 ? `Multissilábica de ${multi} vogais. Pesado!`
        : r.score >= 0.9 ? 'Rima perfeita.' : 'Rima toante: as vogais batem, tente uma perfeita.';
      const metrica = dif <= 2 ? 'métrica parecida' : sil2 > sil1 ? `${dif} sílabas a mais` : `${dif} sílabas a menos`;
      $('[data-tentativas]', box).insertAdjacentHTML('afterbegin', `
        <div class="tentativa"><div><div class="txt">${escapar(texto)}</div><div class="nota-rodape">${comentario} · ${sil2} sílabas (${metrica})</div></div>
        <div class="chips">${chipNivel(fim2, r.nivel)}<span class="chip"><b>${nota}</b>/100</span></div></div>`);
      recorde('completar', nota);
    },
  });
  entrada.focar();
  atual = { parar: () => entrada.pararMic() };
}

// ---------- Caça multissilábica ----------
function multi() {
  const alvo = sortear(ALVOS_MULTI);
  const pa = palavrasDe(alvo);
  const vog = vogaisDoTrecho(pa);
  const maxM = Math.min(vog.length, 6);
  const mostradas = vog.slice(-maxM);
  const box = abrir(`
    ${cabecalho('🧩 Caça multissilábica', '<button class="btn btn-sec btn-peq" data-nova>Outra frase</button>')}
    <div class="alvo"><div class="rotulo">Frase-alvo</div><div class="grande">${escapar(alvo)}</div>
      <div class="sub">Padrão de vogais do som (a amarela é a tônica do fim):</div>
      <div class="padrao">${mostradas.map((v) => `<span class="${v.tonica && v.wi === pa.length - 1 ? 't' : ''}">${v.v}</span>`).join('')}</div>
      <div class="sub" style="margin-top:8px">Crie frases que terminem com o mesmo som. Quanto mais vogais baterem, mais pontos.</div></div>
    <div class="placar"><div><b data-melhor>0</b><span>melhor multi</span></div><div><b data-tent>0</b><span>tentativas</span></div></div>
    <div data-entrada></div>
    <div class="tentativas" data-tentativas></div>`);
  $('[data-nova]', box).addEventListener('click', () => { pararAtual(); multi(); });
  let melhor = 0; let tent = 0;
  const entrada = criarEntrada($('[data-entrada]', box), {
    placeholder: 'Ex: navalha que mira…',
    aoEnviar: (texto) => {
      const pb = palavrasDe(texto);
      if (!pb.length) return;
      const r = compararRima(pa[pa.length - 1], pb[pb.length - 1]);
      const m = r.nivel === 'repetida' ? 0 : tamanhoMulti(pa, pb);
      tent++;
      if (m > melhor) melhor = m;
      $('[data-melhor]', box).textContent = melhor;
      $('[data-tent]', box).textContent = tent;
      const vb = vogaisDoTrecho(pb).slice(-Math.max(m, 1) - 1);
      const marcadas = vb.map((v, i) => `<span style="opacity:${i >= vb.length - m ? 1 : 0.35}">${v.v}</span>`).join(' ');
      const msg = r.nivel === 'repetida' ? 'Mesma palavra no fim não vale.' : m >= 4 ? 'Multi monstra!' : m === 3 ? 'Multi de 3, boa.' : m === 2 ? 'Só a rima do fim. Tente bater mais vogais antes.' : 'O som do fim não bateu.';
      $('[data-tentativas]', box).insertAdjacentHTML('afterbegin', `
        <div class="tentativa"><div><div class="txt">${escapar(texto)}</div><div class="nota-rodape">${msg} · vogais: ${marcadas}</div></div>
        <div class="chips">${chipNivel(pb[pb.length - 1], r.nivel)}<span class="chip"><b>${m}</b> vogais</span></div></div>`);
      recorde('multi', m);
    },
  });
  entrada.focar();
  atual = { parar: () => entrada.pararMic() };
}

// ---------- Associação livre ----------
function associacao() {
  const alvo = sortear(SEMENTES_ASSOCIACAO);
  const box = abrir(`
    ${cabecalho('💭 Associação livre', '<button class="btn btn-sec btn-peq" data-nova>Outra palavra</button>')}
    <div class="alvo"><div class="rotulo">Fale tudo que lembrar de</div><div class="grande">${escapar(alvo)}</div>
      <div class="sub">45 segundos sem parar. Não precisa rimar: é para soltar a mente.</div></div>
    <div class="placar"><div><b data-tempo>0:45</b><span>tempo</span></div><div><b data-n>0</b><span>palavras</span></div></div>
    <div class="acoes-centro"><button class="btn btn-grande" data-comecar>▶ Começar (45s)</button></div>
    <div data-entrada hidden></div>
    <div class="chips" data-chips style="margin-top:14px"></div>
    <div data-fim></div>`);
  $('[data-nova]', box).addEventListener('click', () => { pararAtual(); associacao(); });
  const vistas = new Set();
  let rodando = false; let timer;
  const entrada = criarEntrada($('[data-entrada]', box), {
    placeholder: 'Fale ou digite palavras',
    aoEnviar: (texto) => {
      if (!rodando) return;
      for (const p of palavrasDe(texto)) {
        const w = limpar(p);
        if (w.length < 2 || STOPWORDS.has(w) || vistas.has(w) || w === limpar(alvo)) continue;
        vistas.add(w);
        $('[data-chips]', box).insertAdjacentHTML('beforeend', `<span class="chip">${escapar(w)}</span>`);
      }
      $('[data-n]', box).textContent = vistas.size;
    },
  });
  const terminar = () => {
    rodando = false;
    clearInterval(timer);
    entrada.pararMic();
    entrada.desativar(true);
    const rec = recorde('associacao', vistas.size);
    const ppm = Math.round(vistas.size / 0.75);
    $('[data-fim]', box).innerHTML = `<div class="painel" style="margin-top:16px"><h3>${vistas.size} palavras diferentes (${ppm} por minuto) ${rec.novo ? '· 🏆 novo recorde!' : `· recorde: ${rec.valor}`}</h3>
      <p class="nota-rodape">${vistas.size >= 25 ? 'Mente solta, pronta pra rimar.' : vistas.size >= 12 ? 'Bom aquecimento. Tente não julgar as palavras, só falar.' : 'Tá travando. Repita esse aquecimento todo dia antes de rimar.'}</p>
      <div class="acoes"><button class="btn" data-repetir>Outra palavra</button></div></div>`;
    $('[data-repetir]', box).addEventListener('click', associacao);
  };
  $('[data-comecar]', box).addEventListener('click', (e) => {
    e.target.closest('.acoes-centro').hidden = true;
    $('[data-entrada]', box).hidden = false;
    rodando = true;
    const fim = performance.now() + 45000;
    entrada.ligarMic();
    entrada.focar();
    timer = setInterval(() => {
      const rest = (fim - performance.now()) / 1000;
      $('[data-tempo]', box).textContent = formatarTempo(rest);
      if (rest <= 0) terminar();
    }, 200);
  });
  atual = { parar: () => { clearInterval(timer); entrada.pararMic(); } };
}

const EXERCICIOS = { corrente, completar, multi, associacao };

export function iniciarExercicios() {
  $$('#lista-exercicios .cartao').forEach((c) => c.addEventListener('click', () => {
    pararAtual();
    $$('#lista-exercicios .cartao').forEach((x) => x.classList.toggle('sel', x === c));
    EXERCICIOS[c.dataset.ex]();
  }));
}

export function sairExercicios() { pararAtual(); }
