import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSaude, criarOperacao, registrarMetrica, resumirMetricas } from '../servidor/operacao.js';

function respostaFicticia() {
  return { statusCode: 200, cabecalhos: {}, setHeader(nome, valor) { this.cabecalhos[nome] = valor; }, end(corpo) { this.corpo = JSON.parse(corpo); } };
}

test('Operação exige segredo forte e autenticação, limita janela e oculta falhas externas', async () => {
  const segredo = 'ficticio-para-teste-local-1234567890';
  for (const caso of [
    { ambiente: {}, status: 503 },
    { ambiente: { OPERACAO_SECRET: segredo }, status: 401 },
    { ambiente: { OPERACAO_SECRET: segredo }, autorizacao: 'Bearer ' + segredo, url: '/api/operacao?minutos=361', status: 400 },
    { ambiente: { OPERACAO_SECRET: segredo }, autorizacao: 'Bearer ' + segredo, falhar: true, status: 503 },
    { ambiente: { OPERACAO_SECRET: segredo }, autorizacao: 'Bearer ' + segredo, status: 200 },
  ]) {
    const resposta = respostaFicticia();
    await criarOperacao({ ambiente: caso.ambiente, repositorio: { executar: async (nome, parametros) => {
      if(nome==='nf_inventario_imagens_orfas')return {quantidade:2,bytes:200,uploadsPendentes:1};
      assert.equal(nome, 'nf_resumo_operacao'); assert.equal(parametros.p_minutos, 60);
      if (caso.falhar) throw Error('SEGREDO_NAO_PUBLICAVEL');
      return { http: [] };
    } } })({ method: 'GET', headers: { authorization: caso.autorizacao }, url: caso.url || '/api/operacao' }, resposta);
    assert.equal(resposta.statusCode, caso.status);
    assert.ok(!JSON.stringify(resposta.corpo).includes('SEGREDO_NAO_PUBLICAVEL'));
    assert.equal(resposta.cabecalhos['Cache-Control'], 'no-store');
    if(caso.status===200)assert.deepEqual(resposta.corpo.imagensOrfas,{quantidade:2,bytes:200,uploadsPendentes:1});
  }
});

test('Métricas persistem somente rota permitida, status e duração, sem URL ou identidade', async () => {
  const chamadas = [], mensagens = [];
  const repositorio = { executar: async (...args) => chamadas.push(args) };
  await registrarMetrica({ repositorio, caminho: '/api/desconhecido?token=privado', status: 503, duracaoMs: 90000, ambiente: { METRICAS_HABILITADAS: 'true' } });
  assert.deepEqual(chamadas, [['nf_registrar_metrica', { p_rota: '/api/outros', p_status: 503, p_duracao_ms: 60000 }]]);
  await registrarMetrica({ repositorio, caminho: '/api/ia', status: 200, duracaoMs: 1, ambiente: {} });
  await registrarMetrica({ repositorio, caminho: '/api/ia', status: 200, duracaoMs: 1, ambiente: { METRICAS_HABILITADAS: 'true', NUTRIFOTO_SIMULADO: 'true' } });
  assert.equal(chamadas.length, 1);
  await registrarMetrica({ repositorio: { executar: async () => { throw Error('segredo'); } }, ambiente: { METRICAS_HABILITADAS: 'true' }, registrar: mensagem => mensagens.push(mensagem) });
  assert.deepEqual(mensagens, ['{"evento":"metrica_indisponivel"}']);
});

test('Histogramas e alertas distinguem pagamentos, sincronização, custos e storage', () => {
  assert.equal(resumirMetricas({ http: [] }).p95AteMs, null);
  const resumo = resumirMetricas({ http: [
    { rota: '/api/dados', status: 200, faixa_ms: 2500, quantidade: 18 },
    { rota: '/api/dados', status: 503, faixa_ms: 5000, quantidade: 1 },
    { rota: '/api/webhook', status: 502, faixa_ms: 5000, quantidade: 1 },
  ], ia: { custos_desconhecidos: 1, reservas_pendentes: 1 }, storage: { bytes: 100 } }, { ALERTA_STORAGE_BYTES: '100' });
  assert.equal(resumo.p95AteMs, 5000); assert.equal(resumo.pedidos, 20); assert.equal(resumo.falhas, 2);
  assert.deepEqual(resumo.alertas, ['FALHAS_HTTP_ELEVADAS', 'LATENCIA_ELEVADA', 'FALHA_PAGAMENTO', 'FALHA_SINCRONIZACAO', 'CUSTO_IA_DESCONHECIDO', 'RESERVA_IA_PENDENTE', 'STORAGE_PROXIMO_LIMITE']);
});

test('Saúde pública informa somente vivacidade e restringe método', async () => {
  const resposta = respostaFicticia(); await criarSaude()({ method: 'GET' }, resposta);
  assert.deepEqual(resposta.corpo, { estado: 'ativo' });
  const invalida = respostaFicticia(); await criarSaude()({ method: 'POST' }, invalida); assert.equal(invalida.statusCode, 405);
});
