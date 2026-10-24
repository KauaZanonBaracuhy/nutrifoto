import { falhar, resumir } from './seguranca.js';

export function obterOrcamentoIA(configuracao) {
  const campos = ['IA_ORCAMENTO_MENSAL_USD', 'IA_ORCAMENTO_USUARIO_MENSAL_USD', 'IA_RESERVA_OPERACAO_USD'];
  const valores = campos.map(nome => Number(configuracao.ambiente[nome] ?? 0));
  if (valores.some(valor => !Number.isFinite(valor) || valor <= 0 || valor > 1000000)) falhar(503, 'Orçamento operacional de IA não configurado.', 'ORCAMENTO_IA_DESABILITADO');
  if (valores[2] > Math.min(valores[0], valores[1])) falhar(503, 'Reserva de IA excede o orçamento configurado.');
  const entrada = Number(configuracao.ambiente.IA_PRECO_MAX_ENTRADA_USD_MILHAO);
  const saida = Number(configuracao.ambiente.IA_PRECO_MAX_SAIDA_USD_MILHAO);
  // O teto considera todo o contexto do modelo, inclusive tokens de imagem.
  if (![entrada, saida].every(valor => Number.isFinite(valor) && valor > 0) || valores[2] < (128000 * entrada + 3500 * saida) / 1000000) falhar(503, 'Reserva de IA insuficiente ou preços máximos não configurados.');
  return { p_limite_global: valores[0], p_limite_usuario: valores[1], p_reserva: valores[2] };
}

export async function reservarAnalise(pedido, usuario, chave, repositorio, configuracao) {
  const parametros = { p_usuario: usuario.id, p_chave: chave, p_hash: resumir(JSON.stringify(pedido)), p_limite_gratis: configuracao.limiteGratis, p_limite_pago: configuracao.limitePago };
  return repositorio.executar(configuracao.simulado ? 'nf_reservar_ia' : 'nf_reservar_ia_comercial', { ...parametros, ...(configuracao.simulado ? {} : obterOrcamentoIA(configuracao)) });
}

export async function finalizarAnalise(resultado, usuario, chave, repositorio, configuracao) {
  const custo = resultado.uso?.custoUsd;
  await repositorio.executar(configuracao.simulado ? 'nf_finalizar_ia' : 'nf_finalizar_ia_comercial', { p_usuario: usuario.id, p_chave: chave, p_resultado: resultado, p_tokens: resultado.uso?.tokens || 0, p_custo: typeof custo === 'number' && Number.isFinite(custo) && custo >= 0 ? custo : null });
}
