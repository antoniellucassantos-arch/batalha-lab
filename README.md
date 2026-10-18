# Batalha Lab: treino de batalha de rima

Site para treinar freestyle e batalha de rima. Você rima em cima de um beat, o site escuta, transcreve e mostra quais palavras rimaram, onde saiu multissilábica, como foi o flow, e dá uma nota com dicas.

## Como abrir

Dê dois cliques em **`iniciar.bat`**. Ele sobe um servidor local e abre `http://localhost:8080` no navegador.

- Use **Chrome ou Edge** para o reconhecimento de voz em tempo real.
- Use **fone de ouvido**: com o beat na caixa de som, o microfone capta a batida e o reconhecimento piora.
- Precisa do Python instalado (ou do Node.js, que o `.bat` usa se não achar o Python).

Abrir o `index.html` direto (file://) não funciona: o navegador bloqueia módulos JavaScript e microfone fora de um servidor.

## O que tem

| Página | O que faz |
|---|---|
| **Aprender** | Como a batalha funciona, modalidades, o que o público avalia, técnicas, plano de 4 semanas e glossário. |
| **Treinar** | Rodadas com beat (boom bap, trap, lo-fi, acapella). Modos: livre, tema sorteado, palavras-surpresa e ataque e resposta contra o computador. Nota de 0 a 100 em Rima, Complexidade, Vocabulário, Flow e Desafio. A gravação fica disponível para ouvir de novo. |
| **Exercícios** | Corrente de rimas, completa a barra, caça multissilábica e associação livre. Por voz ou digitando. |
| **Laboratório** | Dicionário de rimas pelo som (perfeitas, variações, toantes e multis) e analisador que colore as rimas de qualquer letra. |
| **Progresso** | Histórico, gráfico de evolução, médias por critério e recordes (salvos no navegador). |

## As IAs usadas (todas grátis e no navegador)

Não existe no GitHub uma IA pronta que avalie rima em português, então o site junta estas peças:

- **Web Speech API** (Chrome/Edge): reconhecimento de voz em pt-BR em tempo real. Usa a internet (serviço do navegador).
- **Whisper via [Transformers.js](https://github.com/huggingface/transformers.js)**: reconhecimento offline, roda no seu PC (WebGPU ou CPU). Na primeira vez baixa o modelo (40 a 250 MB) e depois fica em cache. Funciona também no Firefox.
- **Motor fonético próprio** (`js/rima.js`): converte a escrita em som do português brasileiro, acha a sílaba tônica e detecta rima perfeita, toante, interna e multissilábica.
- **Dicionário**: 50 mil palavras mais frequentes do português do Brasil, do projeto [FrequencyWords](https://github.com/hermitdave/FrequencyWords). É baixado ao abrir o site. Sem internet, cai numa lista reserva menor.
- **Jurado IA (opcional)**: modelo Qwen 2.5 rodando no navegador com [WebLLM](https://github.com/mlc-ai/web-llm). Escreve um parecer da rodada. Precisa de WebGPU e baixa de 1 a 2,5 GB na primeira vez.
- Também avaliado: [vosk-browser](https://github.com/ccoreilly/vosk-browser). Ficou de fora porque o modelo pequeno em português erra muito e o grande passa de 1 GB.

## Como a nota é calculada

| Critério | Peso | O que mede |
|---|---|---|
| Rima | 35% | Quantas barras fecham rimando com uma vizinha, pesado pela qualidade (perfeita > toante; palavra repetida vale pouco). |
| Complexidade | 20% | Tamanho médio das multis e quantas palavras estão em rimas internas. |
| Vocabulário | 15% | Palavras diferentes, rimas sem repetir e terminações menos batidas. |
| Flow | 15% | Palavras por minuto, regularidade do tamanho das barras e travadas (silêncios longos). |
| Desafio | 15% | Usou o tema, encaixou as palavras-surpresa ou rebateu o ataque rimando com ele. |

O reconhecimento de voz erra às vezes. No resultado dá para corrigir a transcrição e reavaliar.

## Testar sem microfone

Abra `http://localhost:8080/?simular#treinar`. A rodada usa barras faladas de mentira, o que serve para ver o fluxo e a tela de resultado.

## Arquivos

```
index.html          páginas e conteúdo do guia
css/estilo.css      visual
js/app.js           navegação entre páginas
js/rima.js          motor fonético de rimas (pt-BR)
js/avaliacao.js     nota da rodada
js/beat.js          beats sintetizados com Web Audio
js/voz.js           microfone, Web Speech, gravação e cliente do Whisper
js/whisper-worker.js  Whisper rodando num Web Worker
js/juiz.js          jurado IA com WebLLM
js/dicionario.js    dicionário de rimas
js/dados.js         temas, palavras, ataques, barras e dicas
js/treino.js, exercicios.js, lab.js, progresso.js   páginas
```
