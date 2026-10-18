// Gerador de beats com Web Audio: tudo sintetizado na hora, sem arquivos de áudio.
// Estilos: boom bap, trap, lo-fi e metrônomo (acapella com clique).

const midi = (m) => 440 * 2 ** ((m - 69) / 12);

export const ESTILOS = {
  boombap: {
    nome: 'Boom bap', bpm: 90, swing: 0.16,
    acordes: [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 56, 59, 62]],
    baixo: [45, 41, 38, 40],
  },
  trap: {
    nome: 'Trap', bpm: 140, swing: 0,
    acordes: [[60, 63, 67], [56, 60, 63], [53, 56, 60], [55, 59, 62]],
    baixo: [36, 32, 29, 31],
  },
  lofi: {
    nome: 'Lo-fi', bpm: 80, swing: 0.22,
    acordes: [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 60, 64, 67]],
    baixo: [38, 43, 36, 45],
  },
  metronomo: { nome: 'Acapella (só clique)', bpm: 90, swing: 0, acordes: [], baixo: [] },
};

export class Beat {
  constructor() {
    this.ctx = null;
    this.estilo = 'boombap';
    this.bpm = 90;
    this.volume = 0.8;
    this.tocando = false;
    this.aoTempo = null; // callback({ tempo: 0..3, compasso })
  }

  _preparar() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.comp).connect(ctx.destination);
    const len = ctx.sampleRate;
    this.ruido = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.distorcao = ctx.createWaveShaper();
    const curva = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curva[i] = Math.tanh(x * 2.2); }
    this.distorcao.curve = curva;
    this.distorcao.connect(this.master);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  get segPorTempo() { return 60 / this.bpm; }
  get segPorCompasso() { return 240 / this.bpm; }

  async iniciar() {
    this._preparar();
    await this.ctx.resume();
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.passo = 0;
    this.compasso = 0;
    this.proxTempo = this.ctx.currentTime + 0.12;
    // Instante (performance.now) em que o compasso 0 começa, para alinhar a voz
    this.inicioMs = performance.now() + (this.proxTempo - this.ctx.currentTime) * 1000;
    this.tocando = true;
    clearInterval(this.timer);
    this.timer = setInterval(() => this._agendar(), 25);
    this._agendar();
  }

  parar(fade = 0.4) {
    if (!this.tocando) return;
    this.tocando = false;
    clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, t, fade / 3);
  }

  _agendar() {
    const passoSeg = this.segPorTempo / 4;
    while (this.proxTempo < this.ctx.currentTime + 0.15) {
      const e = ESTILOS[this.estilo];
      let t = this.proxTempo;
      if (e.swing && this.passo % 2 === 1) t += passoSeg * e.swing;
      this._tocarPasso(this.passo, t);
      if (this.passo % 4 === 0) {
        const info = { tempo: (this.passo % 16) / 4, compasso: this.compasso };
        const atraso = Math.max(0, (this.proxTempo - this.ctx.currentTime) * 1000);
        setTimeout(() => this.tocando && this.aoTempo && this.aoTempo(info), atraso);
      }
      this.proxTempo += passoSeg;
      this.passo++;
      if (this.passo % 16 === 0) this.compasso++;
    }
  }

  _tocarPasso(p, t) {
    const s = p % 16;
    const c = Math.floor(p / 16) % 4;
    const e = ESTILOS[this.estilo];
    if (this.estilo === 'metronomo') {
      if (s % 4 === 0) this._clique(t, s === 0);
      return;
    }
    if (this.estilo === 'boombap' || this.estilo === 'lofi') {
      const lofi = this.estilo === 'lofi';
      const kicks = c % 2 === 0 ? [0, 7, 10] : [0, 3, 10, 13];
      if (kicks.includes(s)) this._kick(t, lofi ? 0.75 : 1);
      if (s === 4 || s === 12) this._caixa(t, lofi ? 0.5 : 0.85);
      if (s % 2 === 0) this._chimbal(t, s === 14 && c === 3, lofi ? 0.12 : 0.2);
      if (s === 0) this._teclado(t, e.acordes[c], this.segPorCompasso * 0.9, lofi ? 0.07 : 0.06);
      if (s === 8 && !lofi) this._teclado(t, e.acordes[c].slice(1), this.segPorTempo * 1.5, 0.035);
      if (s === 0 || s === 10) this._baixo(t, midi(e.baixo[c]), this.segPorTempo * 1.6);
      if (lofi && s === 0) this._chiado(t, this.segPorCompasso);
    } else if (this.estilo === 'trap') {
      const kicks = [[0, 7, 10], [0, 6, 11], [0, 7, 10], [0, 3, 6, 11]][c];
      if (kicks.includes(s)) this._oitocentoeoito(t, midi(e.baixo[c]), this.segPorTempo * 1.8);
      if (s === 8) { this._caixa(t, 0.6); this._palma(t); }
      // chimbal em semicolcheias, com "rolls" no fim do 4º compasso
      if (c === 3 && s >= 12) {
        const sub = this.segPorTempo / 12;
        for (let k = 0; k < 3; k++) this._chimbal(t + k * sub, false, 0.12);
      } else {
        this._chimbal(t, false, s % 4 === 0 ? 0.18 : 0.11);
      }
      if (s % 2 === 0) {
        const acorde = e.acordes[c];
        const nota = acorde[(s / 2) % acorde.length] + 12;
        this._sino(t, midi(nota), 0.05);
      }
      if (s === 0) this._pad(t, e.acordes[c], this.segPorCompasso, 0.03);
    }
  }

  _env(g, t, pico, dur, ataque = 0.002) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  _kick(t, vol = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    this._env(g, t, vol, 0.38);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.4);
  }

  _ruido(t, dur, filtro, freq, vol, q = 0.8) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.ruido;
    const f = ctx.createBiquadFilter();
    f.type = filtro; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    this._env(g, t, vol, dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  _caixa(t, vol = 0.8) {
    this._ruido(t, 0.2, 'highpass', 1400, vol);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    this._env(g, t, vol * 0.5, 0.11);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.12);
  }

  _palma(t) {
    for (let k = 0; k < 3; k++) this._ruido(t + k * 0.011, 0.05 + (k === 2 ? 0.12 : 0), 'bandpass', 1600, 0.5, 1.2);
  }

  _chimbal(t, aberto = false, vol = 0.18) {
    this._ruido(t, aberto ? 0.28 : 0.045, 'highpass', 8000, vol);
  }

  _clique(t, forte) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = forte ? 1500 : 1000;
    this._env(g, t, forte ? 0.35 : 0.2, 0.05);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.06);
  }

  _baixo(t, freq, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = 500;
    this._env(g, t, 0.55, dur, 0.01);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _oitocentoeoito(t, freq, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(freq * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    this._env(g, t, 0.75, dur, 0.004);
    o.connect(g).connect(this.distorcao);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _teclado(t, notas, dur, vol) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1800;
    f.connect(this.master);
    notas.forEach((n, i) => {
      [0, 7].forEach((detune, k) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = k ? 'triangle' : 'sine';
        o.frequency.value = midi(n);
        o.detune.value = detune;
        this._env(g, t + i * 0.012, vol, dur, 0.01);
        o.connect(g).connect(f);
        o.start(t); o.stop(t + dur + 0.1);
      });
    });
  }

  _pad(t, notas, dur, vol) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    f.connect(this.master);
    notas.forEach((n) => {
      [-8, 8].forEach((detune) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        o.detune.value = detune;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(f);
        o.start(t); o.stop(t + dur + 0.05);
      });
    });
  }

  _sino(t, freq, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = freq;
    this._env(g, t, vol, 0.5);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.55);
  }

  _chiado(t, dur) {
    for (let k = 0; k < 6; k++) this._ruido(t + Math.random() * dur, 0.01, 'highpass', 3000, 0.04);
  }
}
