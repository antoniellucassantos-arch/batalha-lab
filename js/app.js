import { iniciarTreino } from './treino.js';
import { iniciarExercicios, sairExercicios } from './exercicios.js';
import { iniciarLab } from './lab.js';
import { renderProgresso } from './progresso.js';
import { carregarDicionario } from './dicionario.js';
import { avaliarRodada } from './avaliacao.js';
import { renderizarAnalise } from './rima.js';
import { $, $$ } from './util.js';

const PAGINAS = ['inicio', 'aprender', 'treinar', 'exercicios', 'laboratorio', 'progresso'];
let paginaAtual = null;

function rotear() {
  const hash = decodeURIComponent(location.hash.slice(1)) || 'inicio';
  const alvo = document.getElementById(hash);
  const pagina = alvo?.closest('.pagina')?.id || (PAGINAS.includes(hash) ? hash : 'inicio');

  if (pagina !== paginaAtual) {
    if (paginaAtual === 'exercicios') sairExercicios();
    $$('.pagina').forEach((p) => p.classList.toggle('ativa', p.id === pagina));
    $$('.nav a').forEach((a) => a.classList.toggle('ativo', a.dataset.pagina === pagina));
    paginaAtual = pagina;
    if (pagina === 'laboratorio') iniciarLab();
    if (pagina === 'progresso') renderProgresso();
  }
  $('#nav').classList.remove('aberto');
  if (alvo && alvo.id !== pagina) setTimeout(() => alvo.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  else window.scrollTo({ top: 0 });
}

$('#menu-btn').addEventListener('click', () => $('#nav').classList.toggle('aberto'));
window.addEventListener('hashchange', rotear);

// Exemplo da página inicial, analisado pelo próprio motor de rimas
const DEMO = [
  'Cheguei na roda com a mente afiada',
  'tua rima é lenta, sem corte e sem nada',
  'eu trago o fogo, tu traz o lamento',
  'no meu jogo tu é só um momento',
  'isso aqui é batalha de rima',
  'e eu sou a navalha que mira',
];
const demo = avaliarRodada({ barras: DEMO, duracaoSeg: 16, modo: 'livre' });
$('#demo-barras').innerHTML = renderizarAnalise(demo.analise);
$('.demo-nota').innerHTML = `<b>${demo.nota}</b><span>${demo.rotulo}</span>`;

iniciarTreino();
iniciarExercicios();
rotear();
// Baixa o dicionário em segundo plano para as notas de raridade e sugestões
setTimeout(() => carregarDicionario(), 800);
