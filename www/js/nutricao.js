// Valores nutricionais representam SEMPRE a porção atual, nunca valores por 100 g implícitos.
export const CAMPOS_NUTRIENTES = ['calorias', 'proteina_g', 'carboidrato_g', 'gordura_g'];

function numeroValido(valor, nome, minimo = 0, maximo = 100000) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new Error(`${nome}: informe um número válido entre ${minimo} e ${maximo}.`);
  }
  return valor;
}

export function normalizarTexto(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normalizarRestricoes(restricoes = []) {
  if (!Array.isArray(restricoes)) throw new Error('Restrições inválidas.');
  const aliases = { vegan: 'vegano', vegano: 'vegano', vegetariano: 'vegetariano', vegetarian: 'vegetariano', gluten: 'sem_gluten', 'sem gluten': 'sem_gluten', lactose: 'sem_lactose', 'sem lactose': 'sem_lactose', nenhuma: '' };
  return [...new Set(restricoes.map(valor => {
    const chave = normalizarTexto(valor);
    if (!Object.hasOwn(aliases, chave)) throw new Error('Restrição desconhecida: confirme com um profissional.');
    return aliases[chave];
  }).filter(Boolean))];
}

export function validarAlimento(alimento) {
  if (!alimento || typeof alimento.nome !== 'string' || !alimento.nome.trim() || alimento.nome.length > 300) throw new Error('Nome do alimento inválido.');
  numeroValido(alimento.porcao_estimada_g, 'Porção em gramas', 0.1, 10000);
  for (const campo of CAMPOS_NUTRIENTES) numeroValido(alimento[campo], campo);
  if (alimento.proteina_g + alimento.carboidrato_g + alimento.gordura_g > alimento.porcao_estimada_g * 1.05 + 1) throw new Error('Macronutrientes incompatíveis com o peso do alimento.');
  if (alimento.calorias > alimento.porcao_estimada_g * 10) throw new Error('Calorias incompatíveis com o peso do alimento.');
  return alimento;
}

export function ajustarPorcao(alimento, gramas) {
  validarAlimento(alimento);
  numeroValido(gramas, 'Porção em gramas', 0.1, 10000);
  const origem = alimento.nutrientes_origem || Object.fromEntries(CAMPOS_NUTRIENTES.map(campo => [campo, alimento[campo]]));
  const pesoOrigem = alimento.nutrientes_origem ? alimento.porcao_original_g : alimento.porcao_estimada_g;
  numeroValido(pesoOrigem, 'Porção original', 0.1, 10000);
  const ajustado = { ...alimento, porcao_estimada_g: gramas, porcao_original_g: pesoOrigem, nutrientes_origem: { ...origem } };
  for (const campo of CAMPOS_NUTRIENTES) ajustado[campo] = Math.round(numeroValido(origem[campo], campo) * gramas / pesoOrigem * 100) / 100;
  return validarAlimento(ajustado);
}

export function somarNutrientes(alimentos) {
  if (!Array.isArray(alimentos) || alimentos.length > 100) throw new Error('Lista de alimentos inválida.');
  const total = Object.fromEntries(CAMPOS_NUTRIENTES.map(campo => [campo, 0]));
  for (const alimento of alimentos) {
    validarAlimento(alimento);
    for (const campo of CAMPOS_NUTRIENTES) total[campo] += alimento[campo];
  }
  for (const campo of CAMPOS_NUTRIENTES) total[campo] = Math.round(total[campo] * 100) / 100;
  return total;
}

function conferirTotais(declarado, calculado, campos = CAMPOS_NUTRIENTES) {
  if (!declarado || typeof declarado !== 'object') throw new Error('Totais nutricionais ausentes.');
  for (const campo of campos) {
    numeroValido(declarado[campo], campo);
    if (Math.abs(declarado[campo] - calculado[campo]) > Math.max(2, calculado[campo] * 0.02)) throw new Error('Totais nutricionais inconsistentes.');
  }
}

export function validarAnalise(resposta) {
  if (!resposta || !Array.isArray(resposta.alimentos)) throw new Error('Análise nutricional inválida.');
  const alimentos = resposta.alimentos.map(alimento => {
    // Metadados internos da origem nunca são aceitos da IA.
    const campos = ['nome', 'porcao_estimada_g', ...CAMPOS_NUTRIENTES, 'marca_identificada'];
    const recebido = Object.fromEntries(campos.filter(campo=>alimento?.[campo]!==undefined).map(campo => [campo, alimento[campo]]));
    return ajustarPorcao(recebido, recebido.porcao_estimada_g);
  });
  const total = somarNutrientes(alimentos);
  conferirTotais(resposta.total, total);
  const avisos = [];
  const energiaMacros = total.proteina_g * 4 + total.carboidrato_g * 4 + total.gordura_g * 9;
  // Álcool, fibras e arredondamentos impedem afirmar igualdade universal por 4/4/9.
  // Uma diferença grande é destacada para revisão humana, sem inventar diagnóstico.
  if (Math.abs(energiaMacros - total.calorias) > Math.max(30, total.calorias * 0.2)) avisos.push('Energia e macronutrientes precisam de conferência manual; podem existir componentes não informados.');
  return { alimentos, total, revisaoNecessaria: true, ...(resposta.simulado === true ? { simulado: true } : {}), ...(resposta.estimativa === true ? { estimativa: true } : {}), ...(avisos.length ? { avisos } : {}) };
}

export function validarPerfil(perfil, { paraPlano = true } = {}) {
  if (!perfil || typeof perfil !== 'object') throw new Error('Perfil inválido.');
  numeroValido(perfil.idade, 'Idade', 18, 120);
  if (!Number.isInteger(perfil.idade)) throw new Error('Informe a idade em anos completos.');
  numeroValido(perfil.pesoAtual, 'Peso', 1, 600);
  numeroValido(perfil.altura, 'Altura', 30, 300);
  if (perfil.pesoDesejado !== '' && perfil.pesoDesejado != null) numeroValido(Number(perfil.pesoDesejado), 'Peso desejado', 1, 600);
  numeroValido(perfil.refeicoesPorDia ?? 4, 'Refeições por dia', 1, 12);
  if (!Number.isInteger(perfil.refeicoesPorDia ?? 4)) throw new Error('Refeições por dia deve ser um número inteiro.');
  if (!['masculino', 'feminino'].includes(perfil.sexo)) throw new Error('Sexo informado inválido.');
  if (!['sedentario', 'leve', 'moderado', 'intenso', 'atleta'].includes(perfil.nivelAtividade)) throw new Error('Nível de atividade inválido.');
  if (!['perder_peso', 'manter_peso', 'ganhar_massa', 'melhorar_saude'].includes(perfil.objetivo)) throw new Error('Objetivo inválido.');
  const restricoes = normalizarRestricoes(perfil.restricoes);
  if (paraPlano && (perfil.gestante || perfil.gestacao || perfil.amamentando || perfil.condicaoClinica || String(perfil.condicoesSaude || '').trim())) throw new Error('Este perfil exige acompanhamento profissional. A geração automática de plano está indisponível.');
  for (const campo of ['restricoesTexto', 'alimentosNaoGosta', 'alimentosFavoritos', 'condicoesSaude', 'rotinaTexto']) {
    if (perfil[campo] != null && (typeof perfil[campo] !== 'string' || perfil[campo].length > 1000)) throw new Error('Texto do perfil inválido ou muito longo.');
  }
  return { ...perfil, restricoes };
}

export function validarPlano(plano) {
  if (!plano || !Array.isArray(plano.refeicoes) || plano.refeicoes.length < 1 || plano.refeicoes.length > 12) throw new Error('Plano sem refeições válidas.');
  numeroValido(plano.tdee, 'Estimativa de energia', 1);
  numeroValido(plano.metaCalorica, 'Meta calórica', 1);
  for (const campo of ['proteina', 'carboidrato', 'gordura']) numeroValido(plano.macros?.[campo], campo);
  const alimentos = [];
  for (const refeicao of plano.refeicoes) {
    if (typeof refeicao.nome !== 'string' || !refeicao.nome.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(refeicao.horario) || !Array.isArray(refeicao.itens) || !refeicao.itens.length) throw new Error('Refeição do plano incompleta.');
    const itens = refeicao.itens.map(item => validarAlimento({ ...item, nome: item.alimento }));
    const total = somarNutrientes(itens);
    conferirTotais({ calorias: refeicao.kcalEstimada }, total, ['calorias']);
    alimentos.push(...itens);
  }
  const total = somarNutrientes(alimentos);
  conferirTotais({ calorias: plano.metaCalorica, proteina_g: plano.macros.proteina, carboidrato_g: plano.macros.carboidrato, gordura_g: plano.macros.gordura }, total);
  const energiaMacros = total.proteina_g * 4 + total.carboidrato_g * 4 + total.gordura_g * 9;
  if (Math.abs(energiaMacros - total.calorias) > Math.max(30, total.calorias * 0.2)) throw new Error('Energia e macronutrientes do plano são incompatíveis.');
  return { ...plano, revisaoNecessaria: true, estado: 'rascunho_para_revisao_profissional' };
}
