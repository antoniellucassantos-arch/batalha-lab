// Worker que roda o Whisper (OpenAI) no navegador via Transformers.js (Hugging Face).
// O modelo é baixado uma vez e fica no cache do navegador.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

env.allowLocalModels = false;

let asr = null;
let modeloAtual = null;

async function temWebGPU() {
  try { return !!(navigator.gpu && (await navigator.gpu.requestAdapter())); } catch { return false; }
}

async function carregar(modelo) {
  if (asr && modeloAtual === modelo) return;
  const gpu = await temWebGPU();
  const progress_callback = (p) => self.postMessage({ tipo: 'progresso', ...p, dispositivo: gpu ? 'webgpu' : 'wasm' });
  try {
    asr = await pipeline('automatic-speech-recognition', modelo, gpu
      ? { device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, progress_callback }
      : { device: 'wasm', dtype: 'q8', progress_callback });
  } catch (err) {
    if (!gpu) throw err;
    asr = await pipeline('automatic-speech-recognition', modelo, { device: 'wasm', dtype: 'q8', progress_callback });
  }
  modeloAtual = modelo;
}

self.onmessage = async (e) => {
  const { tipo, audio, modelo } = e.data;
  if (tipo !== 'transcrever') return;
  try {
    await carregar(modelo);
    self.postMessage({ tipo: 'progresso', status: 'transcrevendo' });
    const saida = await asr(audio, {
      language: 'portuguese',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
    });
    self.postMessage({ tipo: 'resultado', texto: saida.text, chunks: saida.chunks || [] });
  } catch (err) {
    self.postMessage({ tipo: 'erro', mensagem: err?.message || String(err) });
  }
};
