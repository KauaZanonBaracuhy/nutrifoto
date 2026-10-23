import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import { criarAplicacao } from '../servidor/aplicacao.js';
import { criarSimulador } from '../servidor/simulador.js';
import { obterConfiguracao, verificarAssinaturaWebhook } from '../servidor/seguranca.js';
import { validarPedidoIA } from '../servidor/ia.js';

let servidor;
let origem;
let pasta;
let arquivo;
let ambiente;
const registros = [];

before(async () => {
  pasta = await mkdtemp(join(tmpdir(), 'nutrifoto-backend-'));
  arquivo = join(pasta, 'fixtures.json');
  ambiente = { NUTRIFOTO_SIMULADO: 'true', IA_QUOTA_GRATIS: '3' };
  servidor = createServer((requisicao, resposta) => criarAplicacao({ ambiente, repositorio: adaptador, registrar: linha => registros.push(linha) })(requisicao, resposta));
  const adaptador = criarSimulador(arquivo);
  await new Promise(resolver => servidor.listen(0, '127.0.0.1', resolver));
  origem = `http://127.0.0.1:${servidor.address().port}`;
  ambiente.APP_ORIGIN = origem;
});
after(async () => {
  await new Promise(resolver => servidor.close(resolver));
  await rm(pasta, { recursive: true, force: true });
});

function criarCliente() {
  const cookies = {};
  let csrf;
  async function solicitar(caminho, { metodo = 'GET', dados, cabecalhos = {} } = {}) {
    const resposta = await fetch(origem + caminho, {
      method: metodo,
      headers: { Cookie: Object.entries(cookies).map(([nome, valor]) => `${nome}=${valor}`).join('; '), Origin: origem, 'Content-Type': 'application/json', 'X-Ciencia-IA': '1', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...cabecalhos },
      ...(dados === undefined ? {} : { body: typeof dados === 'string' ? dados : JSON.stringify(dados) }),
    });
    for (const cookie of resposta.headers.getSetCookie()) {
      const [nome, valor] = cookie.split(';')[0].split('=');
      if (valor) cookies[nome] = valor; else delete cookies[nome];
    }
    const corpo = await resposta.json();
    if (corpo.csrf) csrf = corpo.csrf;
    return { status: resposta.status, corpo, cabecalhos: resposta.headers };
  }
  return { solicitar, cookies };
}

async function entrar(email) {
  const cliente = criarCliente();
  const inicial = await cliente.solicitar('/api/conta');
  assert.equal(inicial.status, 200);
  assert.equal(inicial.corpo.usuario, null);
  const resposta = await cliente.solicitar('/api/conta', { metodo: 'POST', dados: { acao: 'entrar', email, senha: 'Teste-local-2026!' } });
  assert.equal(resposta.status, 200);
  assert.ok(resposta.cabecalhos.getSetCookie().some(cookie => cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict')));
  assert.equal(resposta.corpo.access_token, undefined);
  return cliente;
}

test('configuração comercial falha fechada e simulação é proibida em produção', () => {
  assert.throws(() => obterConfiguracao({}), /configurada/);
  assert.throws(() => obterConfiguracao({ NUTRIFOTO_SIMULADO: 'true', NODE_ENV: 'production' }), /proibida/);
  assert.throws(() => obterConfiguracao({ NUTRIFOTO_SIMULADO: 'true', APP_ORIGIN: 'https://exemplo.com' }), /local/);
});

test('sessão, isolamento, revisão, idempotência e persistência após recriar adaptador', async () => {
  const anonimo = criarCliente();
  assert.equal((await anonimo.solicitar('/api/dados')).status, 401);
  const ana = await entrar('ana@exemplo.test');
  const bruno = await entrar('bruno@exemplo.test');
  const chave = randomUUID();
  const dados = { meals: [{ id: 1, dia: '2026-10-21', createdAt: '2026-10-21T12:00:00Z', alimentos: [{ nome: '<script>marcador</script>', porcao_estimada_g: 100, calorias: 100, proteina_g: 2, carboidrato_g: 20, gordura_g: 1 }], total: { calorias: 100, proteina_g: 2, carboidrato_g: 20, gordura_g: 1 }, imageDataUrl: 'data:image/png;base64,aW1hZ2Vt' }], weights: [], water: [], tema: 'dark', notificacoes: { enabled: true }, tutorial: '1' };
  const gravada = await ana.solicitar('/api/dados', { metodo: 'PUT', dados: { revisao: 0, dados, usuario: '22222222-2222-4222-8222-222222222222' }, cabecalhos: { 'X-Idempotency-Key': chave } });
  assert.equal(gravada.status, 200);
  assert.equal(gravada.corpo.revisao, 1);
  assert.deepEqual((await bruno.solicitar('/api/dados')).corpo, { revisao: 0, dados: {} });
  const repetida = await ana.solicitar('/api/dados', { metodo: 'PUT', dados: { revisao: 0, dados, usuario: '22222222-2222-4222-8222-222222222222' }, cabecalhos: { 'X-Idempotency-Key': chave } });
  assert.equal(repetida.corpo.revisao, 1);
  const conflito = await ana.solicitar('/api/dados', { metodo: 'PUT', dados: { revisao: 0, dados: { meals: [], weights: [], water: [] } }, cabecalhos: { 'X-Idempotency-Key': randomUUID() } });
  assert.equal(conflito.status, 409);
  assert.equal(conflito.corpo.codigo, 'CONFLITO_REVISAO');
  const adaptadorReaberto = criarSimulador(arquivo);
  assert.deepEqual(await adaptadorReaberto.executar('nf_ler_dados', { p_usuario: '11111111-1111-4111-8111-111111111111' }), { revisao: 1, dados });
  assert.equal((await ana.solicitar('/api/dados', { metodo: 'PUT', dados: { revisao: 1, dados: {} } })).status, 400);
});

test('CSRF, origem, JSON, tamanho e métodos rejeitam solicitações inválidas', async () => {
  const ana = await entrar('ana@exemplo.test');
  assert.equal((await ana.solicitar('/api/ia', { metodo: 'POST', dados: { tipo: 'texto', texto: 'arroz' }, cabecalhos: { 'X-CSRF-Token': 'invalido' } })).status, 403);
  assert.equal((await ana.solicitar('/api/ia', { metodo: 'POST', dados: {}, cabecalhos: { Origin: 'https://atacante.test' } })).status, 403);
  assert.equal((await ana.solicitar('/api/ia', { metodo: 'POST', dados: '{quebrado' })).status, 400);
  assert.equal((await ana.solicitar('/api/ia', { metodo: 'POST', dados: 'x'.repeat(4_000_001) })).status, 413);
  assert.equal((await ana.solicitar('/api/dados', { metodo: 'DELETE', dados: {} })).status, 405);
});

test('quota concorrente limita consumo e reenvio não cobra segunda chamada', async () => {
  const bruno = await entrar('bruno@exemplo.test');
  const semCiencia = await bruno.solicitar('/api/ia', { metodo: 'POST', dados: { tipo: 'texto', texto: 'arroz' }, cabecalhos: { 'X-Ciencia-IA': '' } });
  assert.equal(semCiencia.status, 403);
  const chave = randomUUID();
  const primeira = await bruno.solicitar('/api/ia', { metodo: 'POST', dados: { tipo: 'texto', texto: 'arroz' }, cabecalhos: { 'X-Idempotency-Key': chave } });
  assert.equal(primeira.status, 200);
  assert.equal(primeira.corpo.simulado, true);
  const repetida = await bruno.solicitar('/api/ia', { metodo: 'POST', dados: { tipo: 'texto', texto: 'arroz' }, cabecalhos: { 'X-Idempotency-Key': chave } });
  assert.deepEqual(repetida.corpo, primeira.corpo);
  const trocada = await bruno.solicitar('/api/ia', { metodo: 'POST', dados: { tipo: 'texto', texto: 'feijao' }, cabecalhos: { 'X-Idempotency-Key': chave } });
  assert.equal(trocada.status, 409);
  const respostas = await Promise.all(Array.from({ length: 8 }, () => bruno.solicitar('/api/ia', { metodo: 'POST', dados: { tipo: 'texto', texto: 'arroz' }, cabecalhos: { 'X-Idempotency-Key': randomUUID() } })));
  assert.equal(respostas.filter(resposta => resposta.status === 200).length, 2);
  assert.equal(respostas.filter(resposta => resposta.status === 429).length, 6);
  assert.equal((await bruno.solicitar('/api/assinatura')).corpo.consumo, 3);
});

test('plano não homologado, imagem forjada e perfil inseguro bloqueados antes do provedor', () => {
  assert.throws(() => validarPedidoIA({ tipo: 'plano', perfil: {} }, { simulado: false, ambiente: {} }), /homologação/);
  assert.throws(() => validarPedidoIA({ tipo: 'foto', mediaType: 'image/png', base64: Buffer.from('arquivo-invalido').toString('base64') }, {}), /incompatível/);
  assert.throws(() => validarPedidoIA({ tipo: 'plano', perfil: { idade: -1 } }, { simulado: true }), /Idade/);
});

test('assinaturas nunca habilitam checkout real ou fingem teste de pagamento', async () => {
  const ana = await entrar('ana@exemplo.test');
  const resposta = await ana.solicitar('/api/assinatura', { metodo: 'POST', dados: { acao: 'checkout' }, cabecalhos: { 'X-Idempotency-Key': randomUUID() } });
  assert.equal(resposta.status, 503);
  assert.match(resposta.corpo.erro, /Stripe/);
});

test('imagens privadas: upload, deduplicação, persistência, quota e IDOR entre contas', async () => {
  const ana = await entrar('ana@exemplo.test');
  const bruno = await entrar('bruno@exemplo.test');
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const opcoes = { metodo: 'POST', dados: { dataUrl }, cabecalhos: { 'X-Idempotency-Key': randomUUID() } };
  const criada = await ana.solicitar('/api/imagens', opcoes);
  assert.equal(criada.status, 200);
  assert.match(criada.corpo.id, /^[a-f0-9]{64}\.png$/);
  assert.equal((await ana.solicitar('/api/imagens', opcoes)).corpo.id, criada.corpo.id);
  assert.equal((await ana.solicitar(`/api/imagens?id=${criada.corpo.id}`)).corpo.dataUrl, dataUrl);
  assert.equal((await bruno.solicitar(`/api/imagens?id=${criada.corpo.id}`)).status, 404);
  assert.equal((await ana.solicitar('/api/imagens?id=../outra-conta')).status, 400);
  const reaberto = criarSimulador(arquivo);
  assert.equal((await reaberto.executar('nf_ler_imagem', { p_usuario: '11111111-1111-4111-8111-111111111111', p_imagem: criada.corpo.id })).dataUrl, dataUrl);
  ambiente.IMAGENS_LIMITE_BYTES = '1';
  const excedida = await bruno.solicitar('/api/imagens', opcoes);
  assert.equal(excedida.status, 429);
  delete ambiente.IMAGENS_LIMITE_BYTES;
});

test('assinatura webhook exige corpo original, HMAC válido e timestamp recente', () => {
  const corpo = '{"id":"evt_ficticio","livemode":false}';
  const instante = Math.floor(Date.now() / 1000);
  const segredo = 'whsec_ficticio_nao_real';
  const assinatura = createHmac('sha256', segredo).update(`${instante}.${corpo}`).digest('hex');
  assert.doesNotThrow(() => verificarAssinaturaWebhook(corpo, `t=${instante},v1=${assinatura}`, segredo));
  assert.throws(() => verificarAssinaturaWebhook(corpo + ' ', `t=${instante},v1=${assinatura}`, segredo));
  assert.throws(() => verificarAssinaturaWebhook(corpo, `t=${instante},v1=${assinatura}`, segredo, Date.now() + 301000));
});

test('logout revoga sessão, exclusão remove dados e logs não contêm conteúdo ou credenciais', async () => {
  const ana = await entrar('ana@exemplo.test');
  const token = ana.cookies.nf_acesso;
  assert.equal((await ana.solicitar('/api/conta', { metodo: 'POST', dados: { acao: 'sair' } })).status, 200);
  assert.equal((await ana.solicitar('/api/dados')).status, 401);
  const adaptador = criarSimulador(arquivo);
  assert.equal((await adaptador.chamarAutenticacao('user', 'GET', undefined, token)).ok, false);
  const anaNovamente = await entrar('ana@exemplo.test');
  assert.equal((await anaNovamente.solicitar('/api/conta', { metodo: 'POST', dados: { acao: 'excluir', confirmacao: 'EXCLUIR' } })).status, 200);
  assert.equal((await anaNovamente.solicitar('/api/dados')).status, 401);
  const estado = JSON.parse(await readFile(arquivo, 'utf8'));
  assert.equal(estado.dados['11111111-1111-4111-8111-111111111111'], undefined);
  assert.ok(registros.length > 20);
  assert.ok(!registros.join('').includes(token));
  assert.ok(!registros.join('').includes('marcador'));
  assert.ok(!registros.join('').includes('Teste-local-2026!'));
});
