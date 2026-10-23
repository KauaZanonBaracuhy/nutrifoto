import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obterOrcamentoIA, reservarAnalise, finalizarAnalise } from '../servidor/custos.js';
import { obterPoliticaComercial } from '../servidor/comercial.js';
import { reconciliarEvento } from '../servidor/assinatura.js';
import { executarIA } from '../servidor/ia.js';

const configuracao = { ambiente: { IA_ORCAMENTO_MENSAL_USD: '10', IA_ORCAMENTO_USUARIO_MENSAL_USD: '1', IA_RESERVA_OPERACAO_USD: '0.03', IA_PRECO_MAX_ENTRADA_USD_MILHAO: '0.15', IA_PRECO_MAX_SAIDA_USD_MILHAO: '0.6', STRIPE_PRICE_MENSAL_ID: 'price_mensal', STRIPE_PRICE_ANUAL_ID: 'price_anual' }, limiteGratis: 5, limitePago: 50 };

test('orçamento exige teto conservador e configuração explícita antes da reserva', async () => {
  assert.throws(() => obterOrcamentoIA({ ambiente: {} }), /não configurado/);
  assert.throws(() => obterOrcamentoIA({ ...configuracao, ambiente: { ...configuracao.ambiente, IA_RESERVA_OPERACAO_USD: '0.001' } }), /insuficiente/);
  assert.equal(obterOrcamentoIA(configuracao).p_reserva, 0.03);
  const chamadas = [];
  const repositorio = { executar: async (nome, parametros) => { chamadas.push({ nome, parametros }); return { repetido: false }; } };
  await reservarAnalise({ tipo: 'texto', texto: 'banana' }, { id: 'usuario' }, 'chave', repositorio, configuracao);
  assert.equal(chamadas[0].nome, 'nf_reservar_ia_comercial');
  assert.match(chamadas[0].parametros.p_hash, /^[a-f0-9]{64}$/);
  await finalizarAnalise({ uso: { custoUsd: null, tokens: 10 } }, { id: 'usuario' }, 'chave', repositorio, configuracao);
  assert.equal(chamadas[1].nome, 'nf_finalizar_ia_comercial');
  assert.equal(chamadas[1].parametros.p_custo, null);
});

test('preços mensal/anual são referências configuradas sem valor monetário inventado', () => {
  const politica = obterPoliticaComercial(configuracao);
  assert.deepEqual(politica.precos, { mensal: 'price_mensal', anual: 'price_anual' });
  assert.equal(politica.pago.analises, 50);
  assert.equal(politica.pago.planos, false);
});

test('requisição de IA transmite tetos de preço ao roteador sem executar serviço externo', async () => {
  let corpo;
  await executarIA({ tipo: 'texto', texto: 'banana' }, { ...configuracao, ambiente: { ...configuracao.ambiente, OPENROUTER_API_KEY: 'segredo-ficticio-local' } }, async (_, pedido) => {
    corpo = JSON.parse(pedido.body);
    return { ok: true, dados: { choices: [{ message: { content: '{"alimentos":[],"total":{"calorias":0,"proteina_g":0,"carboidrato_g":0,"gordura_g":0}}' } }], usage: { cost: 0, total_tokens: 1 } } };
  });
  assert.deepEqual(corpo.provider.max_price, { prompt: 0.15, completion: 0.6 });
  assert.equal(corpo.max_tokens, 1500);
});

test('reconciliação Stripe aceita preço anual e usa assinatura atual para falha de renovação', async () => {
  const assinatura = { id: 'sub_1', customer: 'cus_1', livemode: false, status: 'past_due', current_period_end: 123, items: { data: [{ price: { id: 'price_anual' } }] } };
  let gravada;
  await reconciliarEvento({ id: 'evt_1', created: 100, type: 'invoice.payment_failed', data: { object: { subscription: 'sub_1' } } }, { executar: async (nome, parametros) => { gravada = { nome, parametros }; } }, configuracao, async (_, caminho) => caminho.includes('?') ? { data: [assinatura] } : assinatura);
  assert.equal(gravada.parametros.p_status, 'past_due');
  assert.equal(gravada.parametros.p_assinatura, 'sub_1');
});

test('reembolso integral e disputa usam estado atual do provedor, parcial não bloqueia', async () => {
  for (const [tipo, atual, esperado] of [
    ['charge.refunded', { id: 'ch_1', customer: 'cus_1', livemode: false, refunded: true }, true],
    ['charge.refunded', { id: 'ch_1', customer: 'cus_1', livemode: false, refunded: false }, false],
    ['charge.dispute.closed', { id: 'dp_1', charge: 'ch_1', livemode: false, status: 'won' }, false],
    ['charge.dispute.created', { id: 'dp_1', charge: 'ch_1', livemode: false, status: 'needs_response' }, true],
  ]) {
    let gravada;
    await reconciliarEvento({ id: 'evt_1', created: 100, type: tipo, data: { object: { id: atual.id } } }, { executar: async (nome, parametros) => { gravada = { nome, parametros }; } }, configuracao, async (_, caminho) => caminho.startsWith('charges/') && atual.charge ? { id: 'ch_1', customer: 'cus_1', livemode: false } : atual);
    assert.equal(gravada.nome, 'nf_registrar_bloqueio_pagamento');
    assert.equal(gravada.parametros.p_bloqueado, esperado);
  }
});

test('webhook financeiro sem objeto válido recusa400 antes de consultar serviço', async () => {
  for(const object of [null,{}, {id:null}, {id:'../customers'}]) {
    await assert.rejects(reconciliarEvento({type:'charge.refunded',data:{object}}, {}, configuracao, async()=>assert.fail('Não pode consultar Stripe')),erro=>erro.status===400);
  }
});
