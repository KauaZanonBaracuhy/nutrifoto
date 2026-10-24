import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { criarRepositorio } from '../servidor/repositorio.js';
import { criarAplicacao } from '../servidor/aplicacao.js';
import { chamarStripe, receberWebhook, abrirPagamento } from '../servidor/assinatura.js';
import { executarIA } from '../servidor/ia.js';

const ambiente = { APP_ORIGIN: 'https://homologacao.exemplo.test', SUPABASE_URL: 'https://supabase.exemplo.test', SUPABASE_ANON_KEY: 'chave-publica-ficticia', SUPABASE_SERVICE_ROLE_KEY: 'chave-privada-ficticia', RATE_LIMIT_SALT: 'sal-ficticio', STRIPE_SECRET_KEY: 'sk_test_ficticio', STRIPE_WEBHOOK_SECRET: 'whsec_ficticio', STRIPE_PRICE_ID: 'price_ficticio' };
const configuracao = { ambiente, origem: ambiente.APP_ORIGIN, simulado: false };

test('teto de tokens da análise é conservador, servidor e validado antes do provedor',async contexto=>{
  let chamadas=0;
  contexto.mock.method(globalThis,'fetch',async(_url,opcoes)=>{chamadas++;assert.equal(JSON.parse(opcoes.body).max_tokens,700);return Response.json({choices:[{message:{content:'{"alimentos":[],"total":{"calorias":0,"proteina_g":0,"carboidrato_g":0,"gordura_g":0}}'}}],usage:{total_tokens:50,cost:0.00001}});});
  const base={...configuracao,ambiente:{...ambiente,OPENROUTER_API_KEY:'ficticia',IA_MAX_TOKENS_ANALISE:'700'}};
  await executarIA({tipo:'texto',texto:'nenhum alimento'},base);
  for(const limite of ['0','1501','NaN','700.5'])await assert.rejects(executarIA({tipo:'texto',texto:'teste'},{...base,ambiente:{...base.ambiente,IA_MAX_TOKENS_ANALISE:limite}}),/Limite de tokens/);
  assert.equal(chamadas,1);
});

test('401 do provedor não expõe credencial; 429 e resposta inválida têm erros controlados',async contexto=>{
  let status=401;
  contexto.mock.method(globalThis,'fetch',async()=>status===200?Response.json({choices:[{message:{content:'{"alimentos":[{"nome":"Falso","porcao_estimada_g":-1}],"total":{}}'}}]}):Response.json({error:{message:'segredo-ficticio-do-provedor'}},{status}));
  const configurada={...configuracao,ambiente:{...ambiente,OPENROUTER_API_KEY:'ficticia'}};
  for(const codigo of [401,429,503]){status=codigo;await assert.rejects(executarIA({tipo:'texto',texto:'teste'},configurada),erro=>erro.status===(codigo===429?429:502)&&!erro.message.includes('segredo'));}
  status=200;await assert.rejects(executarIA({tipo:'texto',texto:'teste'},configurada),erro=>erro.status===502&&erro.codigo==='IA_INVALIDA');
});

test('checkout concorrente reutiliza a intenção persistente e parâmetros Stripe',async contexto=>{
  const pedidos=[];
  contexto.mock.method(globalThis,'fetch',async(url,opcoes)=>{
    if(url.includes('subscriptions?'))return Response.json({data:[],has_more:false});
    pedidos.push(opcoes);return Response.json({url:'https://checkout.stripe.com/teste'});
  });
  const repositorio={executar:async(nome,parametros)=>nome==='nf_cliente'?'cus_ficticio':{chave:'primeira',expira:1999999999}};
  await Promise.all(['primeira','segunda'].map(chave=>abrirPagamento({acao:'checkout'},{id:'usuario'},repositorio,configuracao,chave)));
  assert.equal(pedidos.length,2);
  assert.equal(pedidos[0].headers['Idempotency-Key'],pedidos[1].headers['Idempotency-Key']);
  assert.equal(pedidos[0].body,pedidos[1].body);
});

test('adaptador REST usa chave servidor, propaga quota controlada e oculta erro externo', async contexto => {
  const chamadas = [];
  contexto.mock.method(globalThis, 'fetch', async (url, opcoes) => {
    chamadas.push({ url, opcoes });
    if (url.endsWith('/nf_reservar_ia')) return Response.json({ erro: 'Quota de IA atingida.', status: 429, codigo: 'QUOTA_EXCEDIDA' });
    if (url.endsWith('/nf_ler_dados')) return Response.json({ mensagemSecreta: 'segredo-nao-deve-sair' }, { status: 500 });
    return Response.json({ id: 'usuario-ficticio' });
  });
  const repositorio = criarRepositorio(configuracao);
  const usuario = await repositorio.chamarAutenticacao('user', 'GET', undefined, 'acesso-ficticio');
  assert.equal(usuario.dados.id, 'usuario-ficticio');
  assert.equal(chamadas[0].opcoes.headers.Authorization, 'Bearer acesso-ficticio');
  await assert.rejects(repositorio.executar('nf_reservar_ia', { p_usuario: 'usuario-ficticio' }), erro => erro.status === 429);
  assert.equal(chamadas[1].opcoes.headers.apikey, ambiente.SUPABASE_SERVICE_ROLE_KEY);
  await assert.rejects(repositorio.executar('nf_ler_dados', {}), erro => erro.status === 503 && !erro.message.includes('segredo'));
});

test('OpenRouter recebe quantidade e modelo fixo, valida JSON e não devolve erro ou token externo', async contexto => {
  const alimento = { nome: 'Arroz', porcao_estimada_g: 200, calorias: 248, proteina_g: 5.2, carboidrato_g: 51.6, gordura_g: 2 };
  const analise = { alimentos: [alimento], total: { calorias: 248, proteina_g: 5.2, carboidrato_g: 51.6, gordura_g: 2 } };
  let corpo;
  contexto.mock.method(globalThis, 'fetch', async (url, opcoes) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    corpo = JSON.parse(opcoes.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify(analise) } }], usage: { total_tokens: 100, cost: 0.001 } });
  });
  const resultado = await executarIA({ tipo: 'texto', texto: 'arroz', gramas: 200 }, { ...configuracao, ambiente: { ...ambiente, OPENROUTER_API_KEY: 'chave-ficticia' } });
  assert.equal(resultado.total.calorias, 248);
  assert.equal(corpo.model, 'openai/gpt-4o-mini');
  assert.equal(JSON.parse(corpo.messages[1].content).quantidadeTotalGramas, 200);
  assert.equal(corpo.max_tokens, 1500);
  assert.equal(corpo.provider.data_collection, 'deny');
  assert.equal(resultado.uso.tokens, 100);
  assert.ok(!JSON.stringify(resultado).includes('chave-ficticia'));
});

test('Stripe real fica bloqueado, webhook recupera assinatura no servidor e ignora cliente forjado', async contexto => {
  await assert.rejects(chamarStripe({ ambiente: { STRIPE_SECRET_KEY: 'sk_live_ficticio' } }, 'customers', {}), /sandbox/);
  const assinatura = { id: 'sub_ficticio', customer: 'cus_vinculado', livemode: false, status: 'active', current_period_end: 9999999999, items: { data: [{ price: { id: 'price_ficticio' } }] } };
  const consultas = [];
  contexto.mock.method(globalThis, 'fetch', async (url, opcoes) => {
    consultas.push(url);
    assert.equal(opcoes.headers['Stripe-Version'], '2025-02-24.acacia');
    return Response.json(url.includes('subscriptions?') ? { data: [assinatura], has_more: false } : assinatura);
  });
  let gravado;
  const repositorio = { executar: async (nome, parametros) => { assert.equal(nome, 'nf_registrar_assinatura'); gravado = parametros; return { recebido: true }; } };
  const evento = { id: 'evt_ficticio', created: 100, livemode: false, type: 'checkout.session.completed', data: { object: { subscription: 'sub_ficticio', customer: 'cus_forjado', metadata: { usuario: 'outro' } } } };
  const corpo = JSON.stringify(evento);
  const agora = Math.floor(Date.now() / 1000);
  const hmac = createHmac('sha256', ambiente.STRIPE_WEBHOOK_SECRET).update(`${agora}.${corpo}`).digest('hex');
  assert.deepEqual(await receberWebhook(corpo, `t=${agora},v1=${hmac}`, repositorio, configuracao), { recebido: true });
  assert.equal(consultas.length, 2);
  assert.equal(gravado.p_cliente, 'cus_vinculado');
  assert.equal(gravado.p_status, 'active');
  assert.equal(gravado.p_usuario, undefined);
});

test('renovação de sessão fica no cookie e sessão revogada no banco nega JWT ainda não expirado', async () => {
  const sessao = '33333333-3333-4333-8333-333333333333';
  const token = `cabecalho.${Buffer.from(JSON.stringify({ session_id: sessao })).toString('base64url')}.assinatura-ficticia`;
  let ativa = true;
  const repositorio = {
    async chamarAutenticacao(caminho, metodo, corpo, acesso) {
      if (caminho === 'token?grant_type=refresh_token') {
        assert.equal(corpo.refresh_token, 'renovacao-ficticia');
        return { ok: true, dados: { access_token: token, refresh_token: 'nova-renovacao-ficticia', expires_in: 3600 } };
      }
      assert.equal(caminho, 'user');
      return acesso === token ? { ok: true, dados: { id: '11111111-1111-4111-8111-111111111111', email: 'ana@exemplo.test' } } : { ok: false };
    },
    async executar(nome, parametros) {
      if (nome === 'nf_limitar') return true;
      if (nome === 'nf_sessao_ativa') { assert.equal(parametros.p_sessao, sessao); return ativa; }
      throw new Error('Operação inesperada.');
    },
  };
  const servidor = createServer(criarAplicacao({ ambiente, repositorio, registrar: () => {} }));
  await new Promise(resolver => servidor.listen(0, '127.0.0.1', resolver));
  try {
    const origemLocal = `http://127.0.0.1:${servidor.address().port}`;
    const renovada = await fetch(origemLocal + '/api/conta', { headers: { Cookie: 'nf_acesso=expirado;nf_renovacao=renovacao-ficticia' } });
    assert.equal(renovada.status, 200);
    assert.ok(renovada.headers.getSetCookie().some(cookie => cookie.includes('Secure') && cookie.includes(token)));
    assert.ok(!(await renovada.text()).includes(token));
    ativa = false;
    const revogada = await fetch(origemLocal + '/api/dados', { headers: { Cookie: `nf_acesso=${token}` } });
    assert.equal(revogada.status, 401);
  } finally { await new Promise(resolver => servidor.close(resolver)); }
});
