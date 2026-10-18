// Conteúdo dos treinos: temas, palavras-surpresa, ataques do computador,
// barras para completar e alvos de multissilábica. Todos os versos são originais.

export const TEMAS = [
  { tema: 'Futebol', palavras: ['gol', 'bola', 'campo', 'torcida', 'juiz', 'craque', 'chuteira', 'estádio', 'pênalti', 'camisa'] },
  { tema: 'Redes sociais', palavras: ['like', 'post', 'story', 'seguidor', 'celular', 'filtro', 'perfil', 'curtida', 'internet', 'fama'] },
  { tema: 'Segunda-feira', palavras: ['despertador', 'trabalho', 'café', 'ônibus', 'sono', 'chefe', 'semana', 'cansaço', 'rotina', 'trânsito'] },
  { tema: 'Dinheiro', palavras: ['grana', 'conta', 'banco', 'salário', 'boleto', 'nota', 'pix', 'carteira', 'rico', 'dívida'] },
  { tema: 'Escola', palavras: ['professor', 'prova', 'caderno', 'recreio', 'lousa', 'nota', 'sala', 'lição', 'diretor', 'merenda'] },
  { tema: 'Quebrada', palavras: ['favela', 'laje', 'beco', 'viela', 'comunidade', 'morro', 'vizinho', 'rua', 'baile', 'resistência'] },
  { tema: 'Amor', palavras: ['coração', 'beijo', 'saudade', 'paixão', 'olhar', 'abraço', 'ciúme', 'carinho', 'promessa', 'flor'] },
  { tema: 'Tecnologia', palavras: ['robô', 'computador', 'inteligência', 'código', 'tela', 'aplicativo', 'futuro', 'máquina', 'senha', 'rede'] },
  { tema: 'Comida de vó', palavras: ['feijão', 'panela', 'tempero', 'bolo', 'cozinha', 'almoço', 'arroz', 'farofa', 'receita', 'domingo'] },
  { tema: 'Sonhos', palavras: ['futuro', 'meta', 'estrela', 'céu', 'caminho', 'vitória', 'esperança', 'luta', 'conquista', 'destino'] },
  { tema: 'Família', palavras: ['mãe', 'pai', 'irmão', 'casa', 'avó', 'filho', 'sangue', 'mesa', 'união', 'raiz'] },
  { tema: 'Ônibus lotado', palavras: ['catraca', 'motorista', 'ponto', 'aperto', 'janela', 'cobrador', 'passagem', 'fila', 'calor', 'atraso'] },
  { tema: 'Videogame', palavras: ['controle', 'fase', 'chefão', 'vida', 'joystick', 'level', 'console', 'partida', 'pixel', 'missão'] },
  { tema: 'Música', palavras: ['beat', 'batida', 'palco', 'microfone', 'som', 'melodia', 'disco', 'show', 'refrão', 'caixa'] },
  { tema: 'Natureza', palavras: ['árvore', 'rio', 'mata', 'chuva', 'sol', 'terra', 'semente', 'floresta', 'vento', 'mar'] },
  { tema: 'Cidade grande', palavras: ['prédio', 'concreto', 'metrô', 'trânsito', 'buzina', 'avenida', 'poluição', 'multidão', 'asfalto', 'pressa'] },
  { tema: 'Superação', palavras: ['queda', 'força', 'luta', 'cicatriz', 'vitória', 'dor', 'recomeço', 'coragem', 'suor', 'fé'] },
  { tema: 'Tempo', palavras: ['relógio', 'hora', 'passado', 'futuro', 'minuto', 'idade', 'memória', 'agora', 'calendário', 'pressa'] },
  { tema: 'Praia', palavras: ['areia', 'onda', 'sol', 'mar', 'chinelo', 'sorvete', 'verão', 'conchinha', 'sereia', 'calor'] },
  { tema: 'Festa', palavras: ['baile', 'dança', 'música', 'noite', 'galera', 'som', 'pista', 'brinde', 'luz', 'madrugada'] },
  { tema: 'Liberdade', palavras: ['voz', 'asa', 'grito', 'corrente', 'direito', 'caminho', 'escolha', 'céu', 'voar', 'sonho'] },
  { tema: 'Medo', palavras: ['escuro', 'sombra', 'grito', 'monstro', 'pesadelo', 'frio', 'coragem', 'noite', 'susto', 'silêncio'] },
  { tema: 'Trabalho', palavras: ['patrão', 'suor', 'salário', 'carteira', 'turno', 'serviço', 'ferramenta', 'esforço', 'hora extra', 'vaga'] },
  { tema: 'Celular', palavras: ['bateria', 'tela', 'carregador', 'mensagem', 'áudio', 'chamada', 'notificação', 'câmera', 'aplicativo', 'sinal'] },
  { tema: 'Viagem', palavras: ['mala', 'estrada', 'avião', 'mapa', 'destino', 'passaporte', 'hotel', 'paisagem', 'saudade', 'caminho'] },
  { tema: 'Hip-hop', palavras: ['rap', 'grafite', 'break', 'DJ', 'MC', 'cultura', 'rua', 'batalha', 'rima', 'resistência'] },
  { tema: 'Inverno', palavras: ['frio', 'casaco', 'cobertor', 'chocolate', 'neblina', 'gelo', 'lareira', 'garoa', 'sopa', 'vento'] },
  { tema: 'Espaço sideral', palavras: ['foguete', 'planeta', 'estrela', 'lua', 'astronauta', 'galáxia', 'gravidade', 'cometa', 'universo', 'nave'] },
];

export const PALAVRAS_SURPRESA = `relógio chinelo guitarra espelho foguete pipoca bicicleta geladeira dinossauro tênis
microfone janela travesseiro abacaxi guarda-chuva cadeado vulcão tartaruga sorvete escada
caneta martelo pirata semáforo vassoura satélite carteira cachorro telescópio bigode
farol trem pneu violão castelo palhaço tesoura bússola sereia diamante
pastel jacaré moto capacete lanterna dragão cometa xadrez coroa pião
ventilador cueca panela furacão lagosta helicóptero piano relâmpago boné sanduíche
borracha mochila pássaro baleia cobra estrela bolacha chuveiro ímã dominó
camaleão lâmpada chaveiro escova carrossel tambor cofre torneira barco sinuca
cinema hospital biblioteca mercado academia padaria aeroporto delegacia estádio igreja
fantasma vampiro zumbi robô mágico cientista detetive astronauta cozinheiro bombeiro
café açaí coxinha feijoada brigadeiro pamonha tapioca churrasco pizza miojo`.split(/\s+/).filter(Boolean);

// Ataques do computador no modo "Ataque e resposta" (4 barras cada)
export const ATAQUES = [
  ['Chegou na roda achando que é o tal', 'mas tua rima é fraca e teu flow é normal', 'eu vim lá do zero e cheguei no final', 'tu é figurante, eu sou o principal'],
  ['Tu fala muito mas não diz nada', 'tua rima é velha, tá toda empoeirada', 'eu sou tempestade, tu é chuva parada', 'pode voltar pra casa que a roda tá fechada'],
  ['Pegou o microfone e começou a tremer', 'esqueceu a letra antes de aprender', 'aqui é batalha, não dá pra se esconder', 'se veio pra perder, então pode descer'],
  ['Teu flow é lento igual fila de banco', 'eu tô lá no topo, tu tá no barranco', 'pra rimar contigo eu nem dou o arranco', 'no fim desse round tu vai ficar em branco'],
  ['Diz que é brabo mas é só fachada', 'pose de leão, coragem de nada', 'minha rima corta igual lâmina afiada', 'a tua é tão mole que parece almofada'],
  ['Ô parceiro, tu tá perdido no tempo', 'teu flow é parado, não tem movimento', 'eu trago a rima, tu traz o lamento', 'tu é brisa fraca e eu sou o vento'],
  ['Tu treinou em casa mas travou na hora', 'o público pede e tu pede pra ir embora', 'minha rima é rápida, a tua demora', 'tu é o passado e eu sou o agora'],
  ['Tu se acha o rei mas não tem coroa', 'tua ideia é fraca, tua rima é à toa', 'eu sou um navio e tu é só a canoa', 'volta pro treino que essa roda é boa'],
  ['Me chama pra guerra mas vem desarmado', 'teu verso é reciclado, teu papo é passado', 'eu rimo de frente e tu rima de lado', 'no fim dessa roda tu sai derrotado'],
  ['Teu verso é tão fraco que nem tem tempero', 'tu rima no improviso igual quem rima no espelho', 'eu chego na batida, sou o primeiro', 'tu é coadjuvante, nem é o terceiro'],
  ['Já vi muito MC, mas igual tu nunca', 'tua rima é torta, tua métrica é curta', 'tu pede respeito mas ninguém te escuta', 'eu vim pra disputa e tu foge da luta'],
  ['Olha a tua cara de quem tá com medo', 'teu flow é tão fraco que acaba cedo', 'eu conto a verdade, tu conta um enredo', 'teu único truque eu já sei o segredo'],
  ['Tu trouxe a torcida mas não trouxe a rima', 'teu verso desce e o meu sobe pra cima', 'eu sou o calor, tu é só o clima', 'quando eu termino, a plateia se anima'],
  ['Cuidado comigo que eu não tô de brincadeira', 'tua rima é fraca igual cadeira sem madeira', 'eu jogo pesado na roda inteira', 'tu é fogo de palha, eu sou a fogueira'],
];

// Primeira barra pronta para o exercício "Completa a barra"
export const BARRAS_INICIO = [
  'Cheguei na roda com a mente afiada',
  'Minha caneta escreve o que a rua ensina',
  'Desde moleque eu sonho com o palco',
  'Eu sou o fogo que não apaga com a chuva',
  'Tu fala de grana mas nunca trabalhou',
  'O beat batendo e eu sinto no peito',
  'A vida é corrida igual metrô lotado',
  'Eu carrego a quebrada no meu coração',
  'Meu verso é pesado igual segunda-feira',
  'Se o mundo é um palco eu sou o protagonista',
  'Eu aprendi cedo que ninguém dá nada',
  'A rima é minha arma e o microfone é meu escudo',
  'Cada barra que eu solto é um tijolo na estrada',
  'Eu não paro, não canso, não peço licença',
  'Tu quer me ver caindo mas eu sigo de pé',
  'No meio do caos eu encontro a calma',
  'O tempo não espera quem fica parado',
  'Eu rimo pela mãe que acorda cedo',
  'Meu sonho é maior que o tamanho do bairro',
  'Quem duvidou hoje paga ingresso pra ver',
  'Tô na batalha desde as cinco da tarde',
  'Minha mente é um labirinto sem saída',
  'Eu vim da poeira e virei tempestade',
  'Meu flow é água, se adapta a qualquer forma',
  'A plateia grita quando eu pego o microfone',
  'Eu escrevo meu nome na história da cidade',
  'Tu é bom de conversa mas na rima é fraco',
  'Eu sou a resposta que tu não esperava',
  'Já perdi muito, mas aprendi a ganhar',
  'O relógio corre e eu corro mais que ele',
];

// Alvos do exercício de multissilábica
export const ALVOS_MULTI = [
  'batalha de rima', 'coração partido', 'dinheiro no bolso', 'microfone na mão', 'vida de artista',
  'caneta pesada', 'palavra afiada', 'sonho de criança', 'noite sem estrela', 'fome de vitória',
  'rei da quebrada', 'fogo na mente', 'pé na estrada', 'papo reto', 'mente brilhante',
  'chuva de verão', 'flow de campeão', 'sangue no olho', 'cabeça erguida', 'lágrima no rosto',
  'peso da coroa', 'voz da favela', 'calor da plateia', 'tempo perdido', 'luz do holofote',
];

// Palavras-alvo da "Corrente de rimas"
export const SEMENTES_CORRENTE = `rima mão amor vida rua tempo guerra sonho mente dinheiro verdade caminho
batalha coração papel luz fé mundo noite grana palco palavra quebrada futuro dor céu estrada
fogo raiz saudade cidade vitória história olhar liberdade respeito destino cabeça momento
favela plateia sorriso escuro final poder`.split(/\s+/).filter(Boolean);

// Palavras para o aquecimento de associação livre
export const SEMENTES_ASSOCIACAO = `mar escola cidade fogo noite música família inverno festa futebol cozinha
celular estrada floresta hospital dinheiro tempo amizade sonho guerra chuva céu rua palco viagem`.split(/\s+/).filter(Boolean);

// Lista reserva para o dicionário quando a lista grande (internet) não carrega
export const PALAVRAS_BASE = `
casa vida rima mão pão chão irmão coração razão canção visão missão paixão ilusão
amor dor flor calor valor suor favor rancor senhor terror cantor sabor motor
mundo fundo segundo profundo vagabundo imundo moribundo
verdade saudade cidade vontade metade idade amizade maldade liberdade felicidade
caminho sozinho carinho vizinho destino menino ninho espinho moinho
batalha navalha muralha canalha falha medalha toalha migalha
noite açoite biscoito oito
cabeça peça começa promessa pressa conversa depressa
tempo vento momento talento lamento pensamento movimento sofrimento sentimento
guerra terra serra erra
fogo jogo logo
grana cana semana bacana cabana banana
palco
rua lua sua tua nua crua
céu véu papel mel anel chapéu troféu fiel cruel quartel pastel
fé até café você pé maré boné chulé
luz cruz capuz
sonho medonho risonho tristonho
mente gente frente quente semente corrente presente doente valente serpente
olhar lugar falar andar sonhar voar mar ar lar par bar cantar chegar
vitória história glória memória trajetória escória
estrada parada jornada calçada madrugada piada nada estrada quebrada pegada
palavra lavra
raiz feliz giz nariz atriz cicatriz aprendiz matriz
destino hino fino divino
respeito peito jeito direito perfeito defeito sujeito conceito
favela janela panela novela vela
plateia ideia veia teia
final igual normal real total mal sinal jornal canal animal
poder viver saber crescer correr morrer vencer perder
dinheiro primeiro inteiro parceiro guerreiro brasileiro verdadeiro
escuro futuro duro puro muro seguro
sorriso preciso juízo aviso paraíso improviso
flow show
beat
microfone telefone nome fome homem
batida ferida saída querida comida bebida corrida subida descida
rap trap
lição
`.split(/\s+/).filter(Boolean);

export const DICAS = {
  rima: [
    'Pense na palavra que fecha a barra antes de começar a frase. Escolha o fim e construa o caminho até ele.',
    'Trabalhe em pares (AABB): toda barra nova precisa de uma parceira que rime com ela.',
    'Tenha famílias de rima na manga: -ão, -ado, -ente, -ia, -or, -eiro. Elas salvam quando a mente trava.',
  ],
  complexidade: [
    'Tente rimar mais de uma sílaba: "batalha de rima" com "navalha que mira". Isso é multissilábica.',
    'Coloque rimas no meio da barra, não só no final. Rima interna deixa o verso mais denso.',
    'Use o laboratório de rimas para achar palavras com o mesmo padrão de vogais.',
  ],
  vocabulario: [
    'Evite rimar a mesma palavra com ela mesma. Para o público isso soa como falta de repertório.',
    'Leia e ouça coisas fora do rap: notícias, livros, gírias novas. Vocabulário é munição.',
    'Terminações muito comuns (-ão, -ar) são fáceis, mas uma rima rara surpreende a plateia.',
  ],
  flow: [
    'Mantenha as barras com tamanhos parecidos. Conte as sílabas e encaixe a rima no tempo forte.',
    'Se travar, não pare: segure o tempo com uma frase de ponte e volte para a rima.',
    'Treine respiração: puxe ar no fim de cada par de barras, não no meio da frase.',
  ],
  desafio: [
    'Use o que te deram: tema, palavra ou a rima do oponente. O público valoriza quem responde na hora.',
    'Quando aparecer uma palavra-surpresa, encaixe ela no final da barra para virar rima.',
    'No ataque e resposta, pegue a última palavra do oponente e rime em cima dela. Isso mostra improviso de verdade.',
  ],
};
