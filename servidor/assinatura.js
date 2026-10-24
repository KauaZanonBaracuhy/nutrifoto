import { buscarJson, falhar, verificarAssinaturaWebhook } from './seguranca.js';
import { obterPoliticaComercial } from './comercial.js';

export async function chamarStripe(configuracao, caminho, corpo, idempotencia) {
  const segredo = configuracao.ambiente.STRIPE_SECRET_KEY;
  // Cobranças reais permanecem desabilitadas nesta implementação para homologação.
  if (!segredo?.startsWith('sk_test_')) falhar(503, 'Pagamento sandbox ainda não configurado.');
  const resposta = await buscarJson(`https://api.stripe.com/v1/${caminho}`, {
    method: corpo ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${segredo}`, 'Stripe-Version': '2025-02-24.acacia', ...(corpo ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(idempotencia ? { 'Idempotency-Key': idempotencia } : {}) },
    ...(corpo ? { body: new URLSearchParams(corpo).toString() } : {}),
  });
  if (!resposta.ok) falhar(502, 'Provedor de pagamentos temporariamente indisponível.');
  return resposta.dados;
}

export async function abrirPagamento(pedido, usuario, repositorio, configuracao, chave) {
  if (configuracao.simulado) falhar(503, 'Checkout não é simulado: configure uma conta Stripe de testes para homologar.');
  if (!['checkout', 'portal'].includes(pedido.acao)) falhar(400, 'Ação de assinatura inválida.');
  let cliente = await repositorio.executar('nf_cliente', { p_usuario: usuario.id, p_cliente: null });
  if (!cliente && pedido.acao === 'portal') falhar(409, 'Esta conta ainda não possui assinatura.');
  if (!cliente) {
    const criado = await chamarStripe(configuracao, 'customers', { 'metadata[nutrifoto_usuario]': usuario.id }, `cliente-${usuario.id}`);
    cliente = await repositorio.executar('nf_cliente', { p_usuario: usuario.id, p_cliente: criado.id });
  }
  if (pedido.acao === 'portal') {
    const sessao = await chamarStripe(configuracao, 'billing_portal/sessions', { customer: cliente, return_url: `${configuracao.origem}/?tela=conta` }, `${usuario.id}-${chave}`);
    return { url: sessao.url, sandbox: true };
  }
  const periodo = pedido.periodo ?? 'mensal';
  if (!['mensal', 'anual'].includes(periodo)) falhar(400, 'Período de assinatura inválido.');
  const preco = obterPoliticaComercial(configuracao).precos[periodo];
  if (!/^price_[a-zA-Z0-9]+$/.test(preco || '')) falhar(503, 'Plano comercial ainda não configurado.');
  const existentes = await chamarStripe(configuracao, `subscriptions?customer=${encodeURIComponent(cliente)}&status=all&limit=100`);
  if (existentes.has_more || existentes.data?.some(item => !['canceled', 'incomplete_expired'].includes(item.status))) falhar(409, 'Você já possui uma assinatura. Use o portal para gerenciá-la.');
  // Uma intenção persistente por conta torna cliques e dispositivos concorrentes a mesma compra.
  const intencao = await repositorio.executar('nf_reservar_checkout', { p_usuario: usuario.id, p_chave: chave, p_preco: preco });
  const sessao = await chamarStripe(configuracao, 'checkout/sessions', {
    customer: cliente, mode: 'subscription', 'line_items[0][price]': preco, 'line_items[0][quantity]': '1',
    'subscription_data[metadata][nutrifoto_usuario]': usuario.id,
    expires_at: String(intencao.expira),
    success_url: `${configuracao.origem}/?tela=conta&pagamento=recebido`, cancel_url: `${configuracao.origem}/?tela=conta&pagamento=cancelado`,
  }, `${usuario.id}-${intencao.chave}`);
  return { url: sessao.url, sandbox: true };
}

export async function receberWebhook(corpo, assinatura, repositorio, configuracao) {
  if (configuracao.simulado || !configuracao.ambiente.STRIPE_WEBHOOK_SECRET) falhar(503, 'Webhook sandbox não configurado.');
  verificarAssinaturaWebhook(corpo, assinatura, configuracao.ambiente.STRIPE_WEBHOOK_SECRET);
  let evento;
  try { evento = JSON.parse(corpo); } catch { falhar(400, 'Evento inválido.'); }
  if (evento.livemode !== false || typeof evento.id !== 'string') falhar(400, 'Apenas eventos sandbox são permitidos.');
  if (!Number.isSafeInteger(evento.created) || evento.created <= 0) falhar(400, 'Data de evento inválida.');
  return reconciliarEvento(evento, repositorio, configuracao);
}

export async function reconciliarEvento(evento, repositorio, configuracao, consultarStripe = chamarStripe) {
  const objeto = evento.data?.object;
  const financeiros = ['charge.refunded', 'refund.created', 'refund.updated', 'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed'];
  if (financeiros.includes(evento.type)) {
    if (!objeto || typeof objeto.id !== 'string' || !/^(?:ch|re|dp)_[a-zA-Z0-9]+$/.test(objeto.id)) falhar(400, 'Objeto financeiro inválido.');
    const disputa = evento.type.startsWith('charge.dispute.');
    const atual = await consultarStripe(configuracao, `${disputa ? 'disputes' : evento.type === 'charge.refunded' ? 'charges' : 'refunds'}/${objeto.id}`);
    const cobranca = evento.type === 'charge.refunded' ? atual : await consultarStripe(configuracao, `charges/${atual.charge}`);
    if (atual.livemode !== false || cobranca.livemode !== false || !/^cus_[a-zA-Z0-9]+$/.test(cobranca.customer || '')) falhar(400, 'Cobrança sandbox inválida.');
    const bloqueado = disputa ? !['won', 'warning_closed'].includes(atual.status) : cobranca.refunded === true;
    return repositorio.executar('nf_registrar_bloqueio_pagamento', { p_evento: evento.id, p_criado: evento.created, p_cliente: cobranca.customer, p_referencia: `${disputa ? 'disputa' : 'reembolso'}:${disputa ? atual.id : cobranca.id}`, p_bloqueado: bloqueado });
  }
  const tipos = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'checkout.session.completed', 'invoice.payment_succeeded', 'invoice.payment_failed'];
  if (!tipos.includes(evento.type)) return { recebido: true, ignorado: true };
  const identificador = evento.type.startsWith('customer.subscription.') ? objeto?.id : objeto?.subscription || objeto?.parent?.subscription_details?.subscription;
  if (!/^sub_[a-zA-Z0-9]+$/.test(identificador || '')) falhar(400, 'Assinatura inválida.');
  // Nunca conceder plano pelo retorno do checkout ou por metadados enviados pelo navegador.
  const assinaturaAtual = await consultarStripe(configuracao, `subscriptions/${identificador}`);
  if (assinaturaAtual.livemode !== false) falhar(400, 'Assinatura de produção não autorizada.');
  // Reconciliar todas as assinaturas impede evento de uma assinatura antiga rebaixar outra ativa.
  const lista = await consultarStripe(configuracao, `subscriptions?customer=${encodeURIComponent(assinaturaAtual.customer)}&status=all&limit=100`);
  if (lista.has_more) falhar(503, 'Reconciliação requer atendimento operacional.');
  const precos = Object.values(obterPoliticaComercial(configuracao).precos).filter(Boolean);
  const vigente = lista.data?.find(item => ['active', 'trialing'].includes(item.status) && item.items?.data?.some(linha => precos.includes(linha.price?.id))) || assinaturaAtual;
  const itens = vigente.items?.data || [];
  const precoCorreto = itens.some(item => precos.includes(item.price?.id));
  const expira = vigente.current_period_end || Math.max(0, ...itens.map(item => item.current_period_end || 0));
  return repositorio.executar('nf_registrar_assinatura', {
    p_evento: evento.id, p_criado: evento.created, p_cliente: assinaturaAtual.customer, p_assinatura: vigente.id,
    p_status: precoCorreto ? vigente.status : 'preco_desconhecido', p_expira: expira,
  });
}
