// Captura e reconhecimento de voz.
// 1) Web Speech API do navegador (Chrome/Edge): tempo real, grátis, pt-BR.
// 2) Whisper rodando no próprio navegador (Transformers.js): offline depois de baixar o modelo.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const temWebSpeech = !!SR;
export const temMicrofone = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

export class VozNavegador {
  constructor({ aoAtualizar, aoErro } = {}) {
    this.aoAtualizar = aoAtualizar || (() => {});
    this.aoErro = aoErro || (() => {});
    this.segmentos = [];
    this.interino = '';
    this.ativo = false;
  }

  iniciar(origemMs = performance.now()) {
    this.origem = origemMs;
    this.segmentos = [];
    this.interino = '';
    this.iniInterino = null;
    this.ativo = true;
    this._criar();
  }

  _agora() { return performance.now() - this.origem; }

  _criar() {
    const r = new SR();
    this.rec = r;
    r.lang = 'pt-BR';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const agora = this._agora();
      let interino = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0].transcript.trim();
        if (res.isFinal) {
          if (txt) this.segmentos.push({ texto: txt, ini: this.iniInterino ?? Math.max(0, agora - 1500), fim: agora });
          this.iniInterino = null;
        } else if (txt) {
          interino += ' ' + txt;
          if (this.iniInterino === null) this.iniInterino = Math.max(0, agora - 500);
        }
      }
      this.interino = interino.trim();
      this.aoAtualizar(this.segmentos, this.interino);
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.ativo = false;
      this.aoErro(e.error);
    };
    r.onend = () => {
      if (this.interino) {
        this.segmentos.push({ texto: this.interino, ini: this.iniInterino ?? this._agora() - 1500, fim: this._agora() });
        this.interino = '';
        this.iniInterino = null;
        this.aoAtualizar(this.segmentos, '');
      }
      if (this.ativo) {
        // O Chrome encerra sozinho depois de silêncio; reinicia enquanto a rodada durar
        try { this._criar(); } catch (err) { this.aoErro(String(err)); }
      } else if (this._resolverFim) {
        this._resolverFim(this.segmentos);
        this._resolverFim = null;
      }
    };
    try { r.start(); } catch (err) { /* já iniciado */ }
  }

  parar() {
    this.ativo = false;
    return new Promise((resolve) => {
      this._resolverFim = resolve;
      try { this.rec.stop(); } catch { resolve(this.segmentos); }
      setTimeout(() => { if (this._resolverFim) { this._resolverFim(this.segmentos); this._resolverFim = null; } }, 2000);
    });
  }

  cancelar() {
    this.ativo = false;
    try { this.rec.abort(); } catch { /* ignora */ }
  }
}

// Grava o microfone (para ouvir de novo e para o Whisper) e mede o volume
export class Gravador {
  // Abre o microfone (pede permissão) sem gravar ainda
  async abrir() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.pedacos = [];
    this.mr = new MediaRecorder(this.stream);
    this.mr.ondataavailable = (e) => e.data.size && this.pedacos.push(e.data);
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analisador = this.ctx.createAnalyser();
    this.analisador.fftSize = 512;
    src.connect(this.analisador);
    this.buf = new Uint8Array(this.analisador.fftSize);
  }

  gravar() {
    if (this.mr && this.mr.state === 'inactive') this.mr.start(250);
  }

  nivel() {
    if (!this.analisador) return 0;
    this.analisador.getByteTimeDomainData(this.buf);
    let s = 0;
    for (const v of this.buf) { const x = (v - 128) / 128; s += x * x; }
    return Math.min(1, Math.sqrt(s / this.buf.length) * 4);
  }

  parar() {
    const fechar = () => {
      this.stream?.getTracks().forEach((t) => t.stop());
      this.ctx?.close();
      this.analisador = null;
    };
    return new Promise((resolve) => {
      if (!this.mr || this.mr.state === 'inactive') { fechar(); return resolve(null); }
      this.mr.onstop = () => {
        const blob = new Blob(this.pedacos, { type: this.mr.mimeType || 'audio/webm' });
        fechar();
        resolve(blob);
      };
      this.mr.stop();
    });
  }
}

export async function blobParaAudio16k(blob) {
  const buf = await blob.arrayBuffer();
  const ctx = new AudioContext({ sampleRate: 16000 });
  const audio = await ctx.decodeAudioData(buf);
  let dados = audio.getChannelData(0);
  if (audio.numberOfChannels > 1) {
    const b = audio.getChannelData(1);
    const mix = new Float32Array(dados.length);
    for (let i = 0; i < dados.length; i++) mix[i] = (dados[i] + b[i]) / 2;
    dados = mix;
  }
  ctx.close();
  return dados;
}

export const MODELOS_WHISPER = [
  { id: 'onnx-community/whisper-tiny', nome: 'Whisper Tiny (~40 MB, rápido, menos preciso)' },
  { id: 'onnx-community/whisper-base', nome: 'Whisper Base (~80 MB, equilibrado)' },
  { id: 'onnx-community/whisper-small', nome: 'Whisper Small (~250 MB, mais preciso, mais lento)' },
];

export class Whisper {
  constructor() { this.worker = null; this.pendente = null; }

  _garantirWorker() {
    if (this.worker) return;
    this.worker = new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => {
      const m = e.data;
      if (!this.pendente) return;
      if (m.tipo === 'progresso') this.pendente.aoProgresso?.(m);
      else if (m.tipo === 'resultado') { this.pendente.resolve(m); this.pendente = null; }
      else if (m.tipo === 'erro') { this.pendente.reject(new Error(m.mensagem)); this.pendente = null; }
    };
    this.worker.onerror = (e) => { this.pendente?.reject(new Error(e.message || 'Erro no Whisper')); this.pendente = null; };
  }

  transcrever(audio, modelo, aoProgresso) {
    this._garantirWorker();
    return new Promise((resolve, reject) => {
      this.pendente = { resolve, reject, aoProgresso };
      this.worker.postMessage({ tipo: 'transcrever', audio, modelo }, [audio.buffer]);
    });
  }
}

// Transforma segmentos de fala ({texto, ini, fim} em ms) em barras.
// Segmentos longos são quebrados pelos compassos do beat (ou a cada ~9 palavras).
export function segmentosParaBarras(segmentos, { msPorCompasso = 0, compassosPorBarra = 1 } = {}) {
  const barras = [];
  for (const s of segmentos) {
    const palavras = s.texto.split(/\s+/).filter(Boolean);
    if (!palavras.length) continue;
    const dur = Math.max(1, s.fim - s.ini);
    const msBarra = msPorCompasso * compassosPorBarra;
    if (msBarra && dur > msBarra * 1.3 && palavras.length > 6) {
      const grupos = new Map();
      palavras.forEach((p, i) => {
        const t = s.ini + (dur * (i + 0.5)) / palavras.length;
        const k = Math.floor(t / msBarra);
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(p);
      });
      // junta pedaços muito curtos na barra anterior
      for (const g of grupos.values()) {
        if (g.length < 3 && barras.length && barras[barras.length - 1]._seg === s) barras[barras.length - 1].texto += ' ' + g.join(' ');
        else barras.push({ texto: g.join(' '), _seg: s });
      }
    } else if (!msBarra && palavras.length > 13) {
      const partes = Math.ceil(palavras.length / 9);
      const tam = Math.ceil(palavras.length / partes);
      for (let i = 0; i < palavras.length; i += tam) barras.push({ texto: palavras.slice(i, i + tam).join(' '), _seg: s });
    } else {
      barras.push({ texto: palavras.join(' '), _seg: s });
    }
  }
  return barras.map((b) => b.texto);
}

// Fala do computador (ataque) com a voz do sistema
export function falar(texto, { taxa = 1.05 } = {}) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    u.rate = taxa;
    const voz = speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('pt-br'))
      || speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('pt'));
    if (voz) u.voice = voz;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
    // segurança caso o evento não dispare
    setTimeout(resolve, 4000 + texto.length * 90);
  });
}

// Escuta curta para os exercícios: devolve palavras/frases conforme o usuário fala
export class Escuta {
  constructor({ aoParcial, aoFinal, aoErro } = {}) {
    this.v = new VozNavegador({
      aoAtualizar: (segs, interino) => {
        const finais = segs.map((s) => s.texto).join(' ');
        aoParcial?.(finais, interino);
        if (segs.length > this._vistos) {
          segs.slice(this._vistos).forEach((s) => aoFinal?.(s.texto));
          this._vistos = segs.length;
        }
      },
      aoErro,
    });
    this._vistos = 0;
  }
  iniciar() { this._vistos = 0; this.v.iniciar(); }
  parar() { return this.v.parar(); }
  get ativo() { return this.v.ativo; }
}
