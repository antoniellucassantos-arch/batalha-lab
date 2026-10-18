// Jurado IA opcional: um modelo de linguagem pequeno (Qwen) rodando 100% no
// navegador com WebLLM (mlc-ai/web-llm). Precisa de WebGPU e baixa o modelo uma vez.
const URL_WEBLLM = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/+esm';

let webllm = null;
let motor = null;
let modeloCarregado = null;

export const temWebGPU = () => !!navigator.gpu;

async function lib() {
  if (!webllm) webllm = await import(URL_WEBLLM);
  return webllm;
}

export async function listarModelos() {
  const w = await lib();
  const preferidos = w.prebuiltAppConfig.model_list
    .filter((m) => /qwen2\.5-.*instruct/i.test(m.model_id) && !/coder|math|vl|embed/i.test(m.model_id))
    .filter((m) => /q4f16_1/.test(m.model_id))
    .filter((m) => !m.vram_required_MB || m.vram_required_MB < 5000);
  preferidos.sort((a, b) => (a.vram_required_MB || 0) - (b.vram_required_MB || 0));
  return preferidos.map((m) => ({ id: m.model_id, vram: m.vram_required_MB }));
}

export async function carregarJuiz(modelo, aoProgresso) {
  const w = await lib();
  if (motor && modeloCarregado === modelo) return motor;
  if (motor) { await motor.unload(); motor = null; }
  motor = await w.CreateMLCEngine(modelo, { initProgressCallback: (p) => aoProgresso?.(p) });
  modeloCarregado = modelo;
  return motor;
}

export async function julgar({ texto, resultado, modo, contexto }, aoToken) {
  if (!motor) throw new Error('Carregue o modelo primeiro.');
  const d = resultado.dims;
  const sistema = 'Você é um jurado experiente de batalha de rima brasileira (freestyle). Responda sempre em português do Brasil, com linguagem de quem é da cena do rap, de forma direta, motivadora e honesta. Seja curto.';
  const pedido = `Modo do treino: ${modo}${contexto ? ' (' + contexto + ')' : ''}.
Transcrição do freestyle (cada linha é uma barra; pode ter erros de reconhecimento de voz):
"""
${texto}
"""
Métricas calculadas pelo analisador (0 a 100): rima ${d.rima}, complexidade ${d.complexidade}, vocabulário ${d.vocabulario}, flow ${d.flow}, desafio ${d.desafio}. Nota geral: ${resultado.nota}.

Dê o seu parecer de jurado neste formato:
1. Melhor barra (cite a barra e diga por quê).
2. Dois pontos fortes.
3. Dois pontos para melhorar, com um exemplo de barra melhorada.
4. Veredito em uma frase.`;
  const stream = await motor.chat.completions.create({
    messages: [{ role: 'system', content: sistema }, { role: 'user', content: pedido }],
    temperature: 0.7,
    max_tokens: 420,
    stream: true,
  });
  let saida = '';
  for await (const parte of stream) {
    const t = parte.choices?.[0]?.delta?.content || '';
    saida += t;
    aoToken?.(saida);
  }
  return saida;
}
