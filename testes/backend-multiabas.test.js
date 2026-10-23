import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { criarAplicacao } from '../servidor/aplicacao.js';
import { criarSimulador } from '../servidor/simulador.js';

test('cookies trocados em outra aba não permitem ler, gravar, consumir IA ou excluir a conta nova', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'nutrifoto-multiabas-'));
  const repositorio = criarSimulador(join(pasta, 'fixtures.json'));
  const ambiente = { NUTRIFOTO_SIMULADO: 'true', IA_QUOTA_GRATIS: '5' };
  const servidor = createServer(criarAplicacao({ ambiente, repositorio, registrar() {} }));
  await new Promise(resolver => servidor.listen(0, '127.0.0.1', resolver));
  ambiente.APP_ORIGIN = `http://127.0.0.1:${servidor.address().port}`;
  async function solicitar(cliente, caminho, metodo = 'GET', dados, contaEsperada) {
    const resposta = await fetch(ambiente.APP_ORIGIN + caminho, { method: metodo, headers: { Origin: ambiente.APP_ORIGIN, Cookie: Object.entries(cliente.cookies).map(([nome, valor]) => `${nome}=${valor}`).join('; '), 'Content-Type': 'application/json', 'X-CSRF-Token': cliente.csrf || '', 'X-Idempotency-Key': randomUUID(), 'X-Ciencia-IA': '1', ...(contaEsperada === undefined ? {} : { 'X-Conta-Esperada': contaEsperada }) }, ...(dados === undefined ? {} : { body: JSON.stringify(dados) }) });
    for (const cookie of resposta.headers.getSetCookie()) { const [nome, valor] = cookie.split(';')[0].split('='); if (valor) cliente.cookies[nome] = valor; else delete cliente.cookies[nome]; }
    const corpo = await resposta.json();
    if (corpo.csrf) cliente.csrf = corpo.csrf;
    return { status: resposta.status, corpo };
  }
  try {
    const ana = { cookies: {} }; const bruno = { cookies: {} };
    for (const [cliente, email] of [[ana, 'ana@exemplo.test'], [bruno, 'bruno@exemplo.test']]) {
      await solicitar(cliente, '/api/conta');
      const entrada = await solicitar(cliente, '/api/conta', 'POST', { acao: 'entrar', email, senha: 'Teste-local-2026!' });
      assert.equal(entrada.status, 200); cliente.id = entrada.corpo.usuario.id;
    }
    // A aba antiga continua esperando Ana; navegador já compartilha cookies de Bruno.
    for (const [caminho, metodo, dados] of [
      ['/api/dados', 'GET'], ['/api/dados', 'PUT', { revisao: 0, dados: { meals: [], tema: 'light' } }],
      ['/api/ia', 'POST', { tipo: 'texto', texto: 'banana' }],
      ['/api/imagens?id=invalido', 'GET'], ['/api/assinatura', 'POST', { acao: 'checkout' }],
      ['/api/conta', 'POST', { acao: 'sair' }], ['/api/conta', 'POST', { acao: 'excluir', confirmacao: 'EXCLUIR' }],
    ]) {
      const resposta = await solicitar(bruno, caminho, metodo, dados, ana.id);
      assert.equal(resposta.status, 409); assert.equal(resposta.corpo.codigo, 'CONTA_ALTERADA');
    }
    assert.deepEqual((await solicitar(bruno, '/api/dados', 'GET', undefined, bruno.id)).corpo, { revisao: 0, dados: {} });
    assert.equal((await solicitar(bruno, '/api/assinatura', 'GET', undefined, bruno.id)).corpo.consumo, 0);
    assert.equal((await solicitar(bruno, '/api/conta')).corpo.usuario.id, bruno.id);
    assert.equal((await solicitar(bruno, '/api/dados', 'GET', undefined, 'invalido')).status, 409);
    assert.equal((await solicitar(bruno, '/api/dados', 'GET', undefined, bruno.id.toUpperCase())).status, 200);
  } finally {
    await new Promise(resolver => servidor.close(resolver));
    await rm(pasta, { recursive: true, force: true });
  }
});
