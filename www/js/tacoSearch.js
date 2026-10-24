import { normalizarTexto, validarAlimento } from './nutricao.js';

export function possuiNutrientesTaco(alimento){
  try{validarAlimento({...alimento,porcao_estimada_g:100});return true;}catch{return false;}
}

let dadosTaco = null;
let carregamentoTaco = null;

// Sinônimos apenas quando preservam preparo, tipo e corte. Arroz branco permanece ambíguo (tipos 1 e 2).
const aliasesInequivocos = {
  'peito de frango sem pele grelhado': 'frango peito sem pele grelhado',
  'peito de frango grelhado sem pele': 'frango peito sem pele grelhado',
};

export function consultarCorrespondenciaTaco(nome, dados = dadosTaco || []) {
  const consulta = normalizarTexto(nome);
  const alvo = aliasesInequivocos[consulta] || consulta;
  const exatos = dados.filter(item => normalizarTexto(item.nome) === alvo);
  if (exatos.length === 1) return { alimento: { ...exatos[0], nutrientesDisponiveis:possuiNutrientesTaco(exatos[0]), confianca: 'exata', correspondenciaValidada: true }, confianca: 'exata', sugestoes: [] };
  const palavras = consulta.split(' ').filter(Boolean);
  const sugestoes = dados.filter(item => {
    const tokens = normalizarTexto(item.nome).split(' ');
    return palavras.length > 0 && palavras.every(palavra => tokens.includes(palavra));
  }).slice(0, 8);
  return { alimento: null, confianca: sugestoes.length ? 'requer_confirmacao' : 'sem_correspondencia', sugestoes };
}

export async function carregarTaco() {
  if (dadosTaco) return dadosTaco;
  if (!carregamentoTaco) carregamentoTaco = (async function carregarBase() {
    const resposta = await fetch(new URL('../data/taco.json', import.meta.url));
    if (!resposta.ok) throw new Error('Base TACO indisponível.');
    const dados = await resposta.json();
    if (!Array.isArray(dados)) throw new Error('Base TACO inválida.');
    dadosTaco = dados;
    return dados;
  })().catch(erro => { carregamentoTaco = null; throw erro; });
  return carregamentoTaco;
}

export async function buscarCorrespondenciaTaco(nome) {
  return consultarCorrespondenciaTaco(nome, await carregarTaco());
}

export async function buscarValidacaoTaco(nome) {
  const alimento=(await buscarCorrespondenciaTaco(nome)).alimento;
  return alimento?.nutrientesDisponiveis?alimento:null;
}
