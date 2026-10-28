import { normalizarRestricoes, normalizarTexto, ajustarPorcao, validarAlimento } from './nutricao.js';
import { buscarValidacaoTaco } from './tacoSearch.js';

// Catálogo deliberadamente pequeno: ingredientes identificados e nomes exatos da TACO.
// Não assegura ausência de contaminação cruzada, marcas ou ingredientes acrescentados no preparo.
const ALTERNATIVAS = {
  proteina: [
    { nome: 'Frango, peito, sem pele, grelhado', animal: true, carne: true },
    { nome: 'Lentilha, cozida' },
    { nome: 'Feijão, carioca, cozido' },
    { nome: 'Ovo, de galinha, inteiro, cozido/10minutos', animal: true },
  ],
  carboidrato: [{ nome: 'Arroz, integral, cozido' }, { nome: 'Arroz, tipo 1, cozido' }, { nome: 'Batata, doce, cozida' }],
  vegetal: [{ nome: 'Alface, crespa, crua' }],
  fruta: [{ nome: 'Banana, prata, crua' }],
  laticinio: [{ nome: 'Queijo, minas, frescal', animal: true, lactose: true }],
  gordura: [], bebida: [], condimento: [], outro: [],
};

function perfilPermiteAlternativa(alternativa, perfil) {
  let restricoes;
  try { restricoes = normalizarRestricoes(perfil.restricoes); } catch { return false; }
  // Texto livre não identifica ingredientes, derivados ou contaminação cruzada com segurança.
  if (String(perfil.restricoesTexto || perfil.alergias || '').trim()) return false;
  if (restricoes.includes('vegano') && alternativa.animal) return false;
  if (restricoes.includes('vegetariano') && alternativa.carne) return false;
  // Sem certificação de preparo/contaminação, não recomendar automaticamente para estas restrições.
  if (restricoes.includes('sem_gluten') || restricoes.includes('sem_lactose')) return false;
  const rejeitados = normalizarTexto(perfil.alimentosNaoGosta).split(' ').filter(palavra => palavra.length > 2);
  const nomesConhecidos = normalizarTexto(Object.values(ALTERNATIVAS).flat().map(item => item.nome).join(' ')).split(' ');
  if (rejeitados.some(palavra => !nomesConhecidos.includes(palavra))) return false;
  if (rejeitados.some(palavra => normalizarTexto(alternativa.nome).includes(palavra))) return false;
  return true;
}

export function getAlternatives(categoria, perfil = {}) {
  categoria = normalizarTexto(categoria);
  if (['cereal','cereais'].includes(categoria)) categoria = 'carboidrato';
  return (ALTERNATIVAS[categoria] || []).filter(alternativa => perfilPermiteAlternativa(alternativa, perfil)).map(alternativa => alternativa.nome);
}

export function getAllCategories() { return Object.keys(ALTERNATIVAS); }

export async function criarSubstituicao(item, nome, perfil = {}) {
  const categoria = item.categoria || 'outro';
  if (!getAlternatives(categoria, perfil).includes(nome)) throw new Error('Substituição não validada para este perfil. Consulte um profissional.');
  const origem = validarAlimento({ ...item, nome: item.alimento || item.nome });
  const taco = await buscarValidacaoTaco(nome);
  if (!taco || taco.calorias <= 0 || origem.calorias <= 0) throw new Error('Não há dados suficientes para calcular esta substituição.');
  const gramas = Math.round(origem.calorias / taco.calorias * 10000) / 100;
  const substituto = ajustarPorcao({ ...taco, porcao_estimada_g: 100 }, gramas);
  return { ...substituto, alimento: taco.nome, quantidade: `${gramas}g`, categoria, fonte: 'TACO', equivalencia: 'energia_apenas', revisaoNecessaria: true };
}

export default ALTERNATIVAS;
