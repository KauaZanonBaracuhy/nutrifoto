// foodAlternatives.js — alternativas por categoria com filtro por restricao e priorizacao por perfil
//
// Cada item: { name, restrictions: [...], profiles: [...] }
// restrictions: tags de incompatibilidade ('vegan', 'lactose', 'gluten')
// profiles: perfis onde o item e priorizado ('sabor', 'performance', 'praticidade')

const FOOD_ALTERNATIVES = {
  proteina: [
    { name: 'Peito de frango grelhado', restrictions: ['vegan'], profiles: ['performance', 'praticidade'] },
    { name: 'Peito de frango cozido', restrictions: ['vegan'], profiles: ['praticidade'] },
    { name: 'Peito de frango desfiado', restrictions: ['vegan'], profiles: ['praticidade'] },
    { name: 'Patinho moido', restrictions: ['vegan'], profiles: ['sabor', 'praticidade'] },
    { name: 'Carne bovina grelhada', restrictions: ['vegan'], profiles: ['sabor'] },
    { name: 'Carne moida com molho', restrictions: ['vegan'], profiles: ['sabor'] },
    { name: 'File de peixe branco grelhado', restrictions: ['vegan'], profiles: ['performance'] },
    { name: 'Tilapia grelhada', restrictions: ['vegan'], profiles: ['performance', 'praticidade'] },
    { name: 'Salmao grelhado', restrictions: ['vegan'], profiles: ['performance', 'sabor'] },
    { name: 'Sardinha assada', restrictions: ['vegan'], profiles: ['performance'] },
    { name: 'Atum enlatado em agua', restrictions: ['vegan'], profiles: ['performance', 'praticidade'] },
    { name: 'Ovos mexidos', restrictions: ['vegan'], profiles: ['praticidade'] },
    { name: 'Ovos cozidos', restrictions: ['vegan'], profiles: ['performance', 'praticidade'] },
    { name: 'Omelete de 2 ovos', restrictions: ['vegan'], profiles: ['praticidade'] },
    { name: 'Omelete de claras', restrictions: ['vegan'], profiles: ['performance'] },
    { name: 'Tofu grelhado', restrictions: [], profiles: ['sabor'] },
    { name: 'Lentilha cozida', restrictions: [], profiles: ['praticidade'] },
    { name: 'Feijao carioca', restrictions: [], profiles: ['praticidade'] },
    { name: 'Grao-de-bico cozido', restrictions: [], profiles: ['sabor'] },
    { name: 'Queijo cottage', restrictions: ['vegan', 'lactose'], profiles: ['sabor'] },
    { name: 'Queijo minas', restrictions: ['vegan', 'lactose'], profiles: ['sabor'] },
    { name: 'Cottage com ervas', restrictions: ['vegan', 'lactose'], profiles: ['sabor'] },
    { name: 'Iogurte grego natural', restrictions: ['vegan', 'lactose'], profiles: ['performance'] },
    { name: 'Whey protein', restrictions: ['vegan', 'lactose'], profiles: ['performance'] },
  ],
  carboidrato: [
    { name: 'Arroz integral', restrictions: [], profiles: ['performance'] },
    { name: 'Arroz branco', restrictions: [], profiles: ['praticidade'] },
    { name: 'Arroz parboilizado', restrictions: [], profiles: ['praticidade'] },
    { name: 'Batata doce assada', restrictions: [], profiles: ['performance', 'sabor'] },
    { name: 'Batata doce cozida', restrictions: [], profiles: ['performance', 'praticidade'] },
    { name: 'Batata inglesa cozida', restrictions: [], profiles: ['praticidade'] },
    { name: 'Quinoa cozida', restrictions: [], profiles: ['performance'] },
    { name: 'Mandioca cozida', restrictions: [], profiles: ['sabor'] },
    { name: 'Macarrao integral', restrictions: ['gluten'], profiles: ['performance'] },
    { name: 'Macarrao comum', restrictions: ['gluten'], profiles: ['praticidade'] },
    { name: 'Cuscuz de milho', restrictions: [], profiles: ['sabor', 'praticidade'] },
    { name: 'Aveia em flocos', restrictions: ['gluten'], profiles: ['performance', 'praticidade'] },
    { name: 'Aveia em farelo', restrictions: ['gluten'], profiles: ['performance'] },
    { name: 'Pao integral', restrictions: ['vegan', 'gluten'], profiles: ['praticidade'] },
    { name: 'Pao frances', restrictions: ['vegan', 'gluten'], profiles: ['praticidade'] },
    { name: 'Pao sirio', restrictions: ['vegan', 'gluten'], profiles: ['sabor'] },
    { name: 'Tortilha de milho', restrictions: [], profiles: ['sabor', 'praticidade'] },
    { name: 'Tortilha de trigo integral', restrictions: ['gluten'], profiles: [] },
    { name: 'Tapioca', restrictions: [], profiles: ['sabor', 'praticidade'] },
    { name: 'Pamonha', restrictions: ['vegan'], profiles: ['sabor'] },
    { name: 'Polenta', restrictions: [], profiles: ['sabor', 'praticidade'] },
    { name: 'Inhame cozido', restrictions: [], profiles: ['performance'] },
    { name: 'Farinha de mandioca', restrictions: [], profiles: ['praticidade'] },
    { name: 'Cereal matinal integral', restrictions: ['gluten'], profiles: ['praticidade'] },
    { name: 'Banana prata', restrictions: [], profiles: ['performance', 'praticidade'] },
    { name: 'Mamao formosa', restrictions: [], profiles: ['praticidade'] },
  ],
  vegetal: [
    { name: 'Salada de folhas verdes', restrictions: [], profiles: ['performance'] },
    { name: 'Alface crespa', restrictions: [], profiles: [] },
    { name: 'Rucula', restrictions: [], profiles: ['sabor'] },
    { name: 'Espinafre refogado', restrictions: [], profiles: ['performance'] },
    { name: 'Brocolis no vapor', restrictions: [], profiles: ['performance'] },
    { name: 'Couve-flor no vapor', restrictions: [], profiles: [] },
    { name: 'Cenoura crua fatiada', restrictions: [], profiles: ['praticidade'] },
    { name: 'Cenoura cozida', restrictions: [], profiles: ['praticidade'] },
    { name: 'Tomate fatiado', restrictions: [], profiles: ['praticidade'] },
    { name: 'Pepino fatiado', restrictions: [], profiles: ['praticidade'] },
    { name: 'Beterraba cozida', restrictions: [], profiles: ['performance'] },
    { name: 'Abobrinha refogada', restrictions: [], profiles: ['sabor'] },
    { name: 'Chuchu cozido', restrictions: [], profiles: [] },
    { name: 'Vagem refogada', restrictions: [], profiles: [] },
    { name: 'Ervilha congelada', restrictions: [], profiles: ['praticidade'] },
    { name: 'Milho verde', restrictions: [], profiles: ['sabor'] },
    { name: 'Cogumelos refogados', restrictions: [], profiles: ['sabor'] },
    { name: 'Aspargo no vapor', restrictions: [], profiles: ['performance'] },
    { name: 'Repolho cozido', restrictions: [], profiles: [] },
    { name: 'Agriao', restrictions: [], profiles: [] },
    { name: 'Mix de vegetais grelhados', restrictions: [], profiles: ['sabor'] },
    { name: 'Legumes assados no forno', restrictions: [], profiles: ['sabor'] },
    { name: 'Berinjela grelhada', restrictions: [], profiles: ['sabor'] },
    { name: 'Quiabo refogado', restrictions: [], profiles: ['sabor'] },
  ],
  fruta: [
    { name: 'Banana prata', restrictions: [], profiles: ['performance', 'praticidade'] },
    { name: 'Banana maca', restrictions: [], profiles: [] },
    { name: 'Maca vermelha', restrictions: [], profiles: ['praticidade'] },
    { name: 'Maca verde', restrictions: [], profiles: [] },
    { name: 'Laranja', restrictions: [], profiles: ['praticidade'] },
    { name: 'Tangerina', restrictions: [], profiles: ['praticidade'] },
    { name: 'Morango', restrictions: [], profiles: ['sabor'] },
    { name: 'Mamao formosa', restrictions: [], profiles: ['praticidade'] },
    { name: 'Abacaxi', restrictions: [], profiles: ['sabor'] },
    { name: 'Melancia', restrictions: [], profiles: [] },
    { name: 'Melao', restrictions: [], profiles: [] },
    { name: 'Uva', restrictions: [], profiles: [] },
    { name: 'Pera', restrictions: [], profiles: [] },
    { name: 'Kiwi', restrictions: [], profiles: ['sabor'] },
    { name: 'Acai', restrictions: [], profiles: ['sabor', 'performance'] },
    { name: 'Goiaba', restrictions: [], profiles: [] },
    { name: 'Maracuja', restrictions: [], profiles: ['sabor'] },
    { name: 'Figo', restrictions: [], profiles: ['sabor'] },
    { name: 'Amora', restrictions: [], profiles: ['sabor'] },
    { name: 'Framboesa', restrictions: [], profiles: ['sabor'] },
    { name: 'Manga', restrictions: [], profiles: ['sabor'] },
    { name: 'Abacate', restrictions: [], profiles: ['sabor', 'performance'] },
  ],
  laticinio: [
    { name: 'Iogurte grego natural', restrictions: ['vegan', 'lactose'], profiles: ['performance'] },
    { name: 'Iogurte natural', restrictions: ['vegan', 'lactose'], profiles: [] },
    { name: 'Queijo cottage', restrictions: ['vegan', 'lactose'], profiles: ['sabor'] },
    { name: 'Queijo minas', restrictions: ['vegan', 'lactose'], profiles: ['sabor'] },
    { name: 'Queijo mucarela', restrictions: ['vegan', 'lactose'], profiles: ['sabor'] },
    { name: 'Queijo provolone', restrictions: ['vegan', 'lactose'], profiles: ['sabor'] },
    { name: 'Ricota', restrictions: ['vegan', 'lactose'], profiles: [] },
    { name: 'Requeijao', restrictions: ['vegan', 'lactose'], profiles: ['sabor'] },
    { name: 'Leite desnatado', restrictions: ['vegan', 'lactose'], profiles: [] },
    { name: 'Leite semi-desnatado', restrictions: ['vegan', 'lactose'], profiles: [] },
    { name: 'Leite de soja', restrictions: [], profiles: [] },
    { name: 'Leite de amenduas', restrictions: [], profiles: [] },
    { name: 'Creme de leite light', restrictions: ['vegan', 'lactose'], profiles: [] },
    { name: 'Manteiga', restrictions: ['vegan', 'lactose'], profiles: [] },
    { name: 'Margarina light', restrictions: ['vegan'], profiles: [] },
  ],
  gordura: [
    { name: 'Azeite de oliva extra virgem', restrictions: [], profiles: ['sabor', 'performance'] },
    { name: 'Azeite de oliva', restrictions: [], profiles: ['praticidade'] },
    { name: 'Abacate', restrictions: [], profiles: ['sabor', 'performance'] },
    { name: 'Castanha-do-para', restrictions: [], profiles: ['performance'] },
    { name: 'Castanha de caju', restrictions: [], profiles: ['sabor'] },
    { name: 'Amendoim', restrictions: [], profiles: ['praticidade'] },
    { name: 'Amendoa', restrictions: [], profiles: ['performance', 'praticidade'] },
    { name: 'Nozes', restrictions: [], profiles: ['performance'] },
    { name: 'Pasta de amendoim', restrictions: [], profiles: ['performance', 'praticidade'] },
    { name: 'Pasta de castanha', restrictions: [], profiles: ['sabor'] },
    { name: 'Semente de chia', restrictions: [], profiles: ['performance'] },
    { name: 'Semente de linhaça', restrictions: [], profiles: ['performance'] },
    { name: 'Semente de girassol', restrictions: [], profiles: [] },
    { name: 'Pistache', restrictions: [], profiles: ['sabor'] },
    { name: 'Coco ralado', restrictions: [], profiles: ['sabor'] },
  ],
  bebida: [
    { name: 'Agua', restrictions: [], profiles: ['performance'] },
    { name: 'Agua com limao', restrictions: [], profiles: ['praticidade'] },
    { name: 'Cafe sem acucar', restrictions: [], profiles: ['performance'] },
    { name: 'Cafe com leite', restrictions: ['vegan', 'lactose'], profiles: [] },
    { name: 'Cha verde', restrictions: [], profiles: ['performance'] },
    { name: 'Cha de camomila', restrictions: [], profiles: [] },
    { name: 'Cha de hortela', restrictions: [], profiles: [] },
    { name: 'Cha de erva-doce', restrictions: [], profiles: [] },
    { name: 'Suco de laranja natural', restrictions: [], profiles: ['sabor'] },
    { name: 'Suco de limao', restrictions: [], profiles: ['praticidade'] },
    { name: 'Suco de abacaxi', restrictions: [], profiles: ['sabor'] },
    { name: 'Agua de coco', restrictions: [], profiles: ['performance'] },
    { name: 'Kombucha', restrictions: [], profiles: ['sabor'] },
    { name: 'Smoothie de frutas', restrictions: [], profiles: ['sabor'] },
  ],
  condimento: [
    { name: 'Sal', restrictions: [], profiles: [] },
    { name: 'Pimenta-do-reino', restrictions: [], profiles: [] },
    { name: 'Alho', restrictions: [], profiles: ['sabor'] },
    { name: 'Cebola', restrictions: [], profiles: ['sabor'] },
    { name: 'Oregano', restrictions: [], profiles: ['sabor'] },
    { name: 'Manjericao', restrictions: [], profiles: ['sabor'] },
    { name: 'Alecrim', restrictions: [], profiles: ['sabor'] },
    { name: 'Cominho', restrictions: [], profiles: ['sabor'] },
    { name: 'Paprica', restrictions: [], profiles: ['sabor'] },
    { name: 'Curcuma', restrictions: [], profiles: ['performance'] },
    { name: 'Ervas finas', restrictions: [], profiles: ['sabor'] },
    { name: 'Limao', restrictions: [], profiles: ['praticidade'] },
    { name: 'Vinagre balsamico', restrictions: [], profiles: ['sabor'] },
    { name: 'Molho de soja light', restrictions: [], profiles: ['sabor', 'praticidade'] },
    { name: 'Mostarda', restrictions: [], profiles: ['sabor'] },
    { name: 'Ketchup light', restrictions: [], profiles: [] },
    { name: 'Molho ingles', restrictions: [], profiles: ['sabor'] },
    { name: 'Coentro', restrictions: [], profiles: ['sabor'] },
    { name: 'Salsa', restrictions: [], profiles: ['sabor'] },
    { name: 'Cebolinha', restrictions: [], profiles: ['sabor'] },
  ],
  outro: [
    { name: 'Granola', restrictions: ['vegan'], profiles: ['praticidade'] },
    { name: 'Mel', restrictions: ['vegan'], profiles: ['sabor'] },
    { name: 'Acucar demerara', restrictions: [], profiles: [] },
    { name: 'Stevia', restrictions: [], profiles: [] },
    { name: 'Gelatina diet', restrictions: ['vegan'], profiles: ['praticidade'] },
    { name: 'Chocolate amargo 70%', restrictions: ['vegan'], profiles: ['sabor'] },
    { name: 'Suco em po light', restrictions: [], profiles: ['praticidade'] },
    { name: 'Caldo de carne', restrictions: ['vegan'], profiles: ['praticidade'] },
    { name: 'Extrato de tomate', restrictions: [], profiles: ['praticidade'] },
    { name: 'Leite de coco', restrictions: [], profiles: ['sabor'] },
  ],
};

/**
 * Retorna alternativas para uma categoria, filtradas por restricao e
 * ordenadas por prioridade do perfil de dieta do usuario.
 *
 * @param {string} categoria
 * @param {object} userProfile - { restricoes: string[], tipoDieta: string }
 * @returns {string[]} - nomes dos alimentos (priorizados primeiro)
 */
export function getAlternatives(categoria, userProfile = {}) {
  const items = FOOD_ALTERNATIVES[categoria] || FOOD_ALTERNATIVES.outro;
  const restrictions = new Set(userProfile.restricoes || []);
  const perfil = userProfile.tipoDieta || 'equilibrado';

  const filtered = items.filter(item =>
    !item.restrictions.some(r => restrictions.has(r))
  );

  if (perfil === 'equilibrado') {
    return filtered.map(i => i.name);
  }

  const prioritized = filtered.filter(i => i.profiles.includes(perfil));
  const normal = filtered.filter(i => !i.profiles.includes(perfil));

  return [...prioritized, ...normal].map(i => i.name);
}

export function getAllCategories() {
  return Object.keys(FOOD_ALTERNATIVES);
}

export default FOOD_ALTERNATIVES;
