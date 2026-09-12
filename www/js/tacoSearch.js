// tacoSearch.js — busca 100% local nos dados da TACO (4ª edição, NEPA/UNICAMP)
// Dados em www/data/taco.json (derivados do repositório github.com/brolesi/taco, licença MIT).
//
// Fluxo:
//   1. Carrega taco.json uma vez (lazy, no primeiro uso).
//   2. Normaliza o nome gerado pela IA (minúsculas, sem acentos, remove palavras de preparo redundantes).
//   3. Divide em tokens e busca correspondência no array da TACO.
//   4. Se houver múltiplos matches, aplica regra de desempate (documentada abaixo).
//   5. Retorna os dados nutricionais REAIS por 100g ou null se não encontrar.

// Cache do JSON carregado (null = não carregado ainda)
let _tacoData = null;

// Palavras de preparo que são redundantes quando o alimento-base já as indica
// (ex: "arroz cozido" → "arroz", pois a TACO já tem variações cru/cozido separadas).
// Remover essas palavras ajuda a bater com variações do nome gerado pela IA.
const PREPARO_PALAVRAS = new Set([
  'cozido', 'cru', 'crua', 'frito', 'frita', 'grelhado', 'grelhada',
  'assado', 'assada', 'refogado', 'refogada', 'torrado', 'torrada',
  'em pó', 'pó', 'integral', 'tipo 1', 'tipo 2', 'branco',
]);

/**
 * Normaliza um texto para busca:
 * - minúsculas
 * - sem acentos
 * - sem pontuação
 * - palavras de preparo redundantes removidas
 */
function normalizarTexto(texto) {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^\w\s]/g, ' ') // pontuação → espaço
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converte nome normalizado em array de tokens (palavras individuais).
 * Remove palavras de preparo que são redundantes para a busca.
 */
function nomeParaTokens(nomeNormalizado) {
  return nomeNormalizado
    .split(' ')
    .filter(p => p.length > 0 && !PREPARO_PALAVRAS.has(p));
}

/**
 * Busca um alimento no JSON da TACO pelo nome gerado pela IA.
 *
 * @param {string} nomeIA - Nome do alimento retornado pela IA (ex: "arroz branco cozido")
 * @returns {object|null} - Objeto com {id, nome, categoria, calorias, proteina_g, carboidrato_g, gordura_g}
 *                          ou null se não encontrado.
 */
function buscarTaco(nomeIA) {
  if (!_tacoData) return null;

  const normalizado = normalizarTexto(nomeIA);
  if (!normalizado) return null;

  const tokensBusca = nomeParaTokens(normalizado);
  if (tokensBusca.length === 0) return null;

  // Encontra todos os matches: cada token de busca deve aparecer no nome do alimento da TACO
  const matches = _tacoData.filter(item => {
    const nomeItem = normalizarTexto(item.nome);
    return tokensBusca.every(tok => nomeItem.includes(tok));
  });

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  // === Regra de desempate (documentada) ===
  // Quando mais de um alimento da TACO bate com os tokens de busca, usamos esta ordem:
  //
  // 1. proximidade de palavras: preferimos o cujo nome tenha a MENOR quantidade
  //    de palavras distintas em relação ao termo buscado. Isso penaliza matches
  //    que acrescentam muitos qualificadores desnecessários (ex: "arroz, tipo 1,
  //    cozido" tem mais palavras que "arroz, tipo 1").
  // 2. em caso de empate real, preferimos "tipo 1" sobre "tipo 2" (mais comum)
  //    ou, se nenhum for "tipo 1", o primeiro por ordem de id (cadastro original).
  //
  // O resultado escolhido é retornado com o campo _nome_base preenchido para
  // auditoria posterior.

  // Ordena por proximidade de palavras (crescente = mais próximo)
  matches.sort((a, b) => {
    const palavrasA = normalizarTexto(a.nome).split(' ').filter(p => p.length > 0).length;
    const palavrasB = normalizarTexto(b.nome).split(' ').filter(p => p.length > 0).length;

    if (palavrasA !== palavrasB) return palavrasA - palavrasB;

    // Empate: prefira "tipo 1" sobre "tipo 2"
    const aEhTipo1 = /tipo\s*1/i.test(a.nome);
    const bEhTipo1 = /tipo\s*1/i.test(b.nome);
    if (aEhTipo1 && !bEhTipo1) return -1;
    if (!aEhTipo1 && bEhTipo1) return 1;

    // Último critério: ordem de id (cadastro original, mais genérico)
    return a.id - b.id;
  });

  return matches[0];
}

/**
 * Carrega o JSON da TACO se ainda não foi carregado.
 * Chamado lazymente na primeira busca para não impactar o carregamento inicial do app.
 */
async function carregarTaco() {
  if (_tacoData) return _tacoData;
  try {
    const resp = await fetch('data/taco.json');
    _tacoData = await resp.json();
    return _tacoData;
  } catch (e) {
    console.error('tacoSearch: falha ao carregar taco.json', e);
    return null;
  }
}

/**
 * Valida um alimento identificado pela IA contra a base TACO.
 * Se encontrar, retorna os dados REAIS da TACO para serem usados no cálculo.
 *
 * @param {string} nomeIA - Nome do alimento retornado pela IA
 * @returns {object|null} - Dados da TACO ou null se não encontrado
 */
async function buscarValidacaoTaco(nomeIA) {
  await carregarTaco();
  if (!_tacoData) return null;
  return buscarTaco(nomeIA);
}

export { buscarValidacaoTaco, carregarTaco };