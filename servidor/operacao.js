import { compararSegredo, obterConfiguracao } from './seguranca.js';
import { criarRepositorio } from './repositorio.js';

const rotas = new Set(['/api/conta', '/api/dados', '/api/ia', '/api/assinatura', '/api/imagens', '/api/webhook']);
const faixas = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 60000];

export async function registrarMetrica({ repositorio, caminho, status, duracaoMs, ambiente = process.env, registrar = console.info }) {
  if (!repositorio || ambiente.NUTRIFOTO_SIMULADO === 'true' || ambiente.METRICAS_HABILITADAS !== 'true') return;
  const rota = rotas.has(caminho) ? caminho : '/api/outros';
  try {
    await repositorio.executar('nf_registrar_metrica', { p_rota: rota, p_status: Number(status), p_duracao_ms: Math.min(60000, Math.max(0, Math.round(duracaoMs))) });
  } catch {
    // Não incluir URL, usuário, corpo ou mensagem externa. A falha de observação não altera o pedido já atendido.
    registrar(JSON.stringify({ evento: 'metrica_indisponivel' }));
  }
}

export function resumirMetricas(resumo, ambiente = {}) {
  const linhas = resumo.http || [];
  const pedidos = linhas.reduce((soma, linha) => soma + Number(linha.quantidade), 0);
  const falhas = linhas.filter(linha => Number(linha.status) >= 500).reduce((soma, linha) => soma + Number(linha.quantidade), 0);
  const histograma = faixas.map(faixa => ({ ateMs: faixa, quantidade: linhas.filter(linha => Number(linha.faixa_ms) === faixa).reduce((soma, linha) => soma + Number(linha.quantidade), 0) }));
  let acumulado = 0;
  const p95AteMs = pedidos ? histograma.find(faixa => (acumulado += faixa.quantidade) >= pedidos * .95)?.ateMs ?? null : null;
  const alertas = [];
  if (pedidos >= 20 && falhas / pedidos >= .05) alertas.push('FALHAS_HTTP_ELEVADAS');
  if (pedidos >= 20 && p95AteMs >= Number(ambiente.ALERTA_P95_MS || 2500)) alertas.push('LATENCIA_ELEVADA');
  if (linhas.some(linha => ['/api/assinatura', '/api/webhook'].includes(linha.rota) && Number(linha.status) >= 500)) alertas.push('FALHA_PAGAMENTO');
  if (linhas.some(linha => linha.rota === '/api/dados' && Number(linha.status) >= 500)) alertas.push('FALHA_SINCRONIZACAO');
  if (linhas.some(linha => linha.rota === '/api/imagens' && Number(linha.status) >= 500)) alertas.push('FALHA_STORAGE');
  if (Number(resumo.ia?.custos_desconhecidos || 0) > 0) alertas.push('CUSTO_IA_DESCONHECIDO');
  if (Number(resumo.ia?.reservas_pendentes || 0) > 0) alertas.push('RESERVA_IA_PENDENTE');
  const tetoStorage = Number(ambiente.ALERTA_STORAGE_BYTES || 0);
  if (tetoStorage > 0 && Number(resumo.storage?.bytes || 0) >= tetoStorage) alertas.push('STORAGE_PROXIMO_LIMITE');
  return { ...resumo, pedidos, falhas, p95AteMs: pedidos ? p95AteMs : null, histograma, alertas, aviso: 'Percentil é o limite superior aproximado do histograma; última faixa satura em 60 segundos.' };
}

export function criarSaude() {
  return async function atenderSaude(requisicao, resposta) {
    resposta.setHeader('Content-Type', 'application/json'); resposta.setHeader('Cache-Control', 'no-store'); resposta.setHeader('X-Content-Type-Options', 'nosniff');
    resposta.statusCode = requisicao.method === 'GET' ? 200 : 405;
    resposta.end(JSON.stringify(requisicao.method === 'GET' ? { estado: 'ativo' } : { erro: 'Método não permitido.' }));
  };
}

export function criarOperacao({ ambiente = process.env, repositorio: adaptador } = {}) {
  return async function atenderOperacao(requisicao, resposta) {
    resposta.setHeader('Content-Type', 'application/json'); resposta.setHeader('Cache-Control', 'no-store'); resposta.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (!ambiente.OPERACAO_SECRET || ambiente.OPERACAO_SECRET.length < 32) { resposta.statusCode = 503; resposta.end(JSON.stringify({ erro: 'Monitoramento ainda não configurado.' })); return; }
      if (requisicao.method !== 'GET' || !compararSegredo(requisicao.headers.authorization, 'Bearer ' + ambiente.OPERACAO_SECRET)) { resposta.statusCode = 401; resposta.end(JSON.stringify({ erro: 'Acesso não autorizado.' })); return; }
      const repositorio = adaptador || criarRepositorio(obterConfiguracao(ambiente));
      const minutos = Number(new URL(requisicao.url, 'http://local').searchParams.get('minutos') || 60);
      if (!Number.isInteger(minutos) || minutos < 1 || minutos > 360) { resposta.statusCode = 400; resposta.end(JSON.stringify({ erro: 'Use janela de 1 a 360 minutos.' })); return; }
      const [resumo,imagensOrfas] = await Promise.all([
        repositorio.executar('nf_resumo_operacao', { p_minutos: minutos }),
        repositorio.executar('nf_inventario_imagens_orfas'),
      ]);
      resumo.imagensOrfas=imagensOrfas;
      resposta.end(JSON.stringify({ pronto: true, metricasHabilitadas: ambiente.METRICAS_HABILITADAS === 'true', ...resumirMetricas(resumo, ambiente) }));
    } catch { resposta.statusCode = 503; resposta.end(JSON.stringify({ pronto: false, erro: 'Operação indisponível. Verifique a infraestrutura.' })); }
  };
}
