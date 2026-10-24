import { randomBytes, createHash, timingSafeEqual, createHmac } from 'node:crypto';

export function falhar(status, mensagem, codigo = 'REQUISICAO_INVALIDA') {
  throw Object.assign(new Error(mensagem), { status, codigo });
}

export function criarToken() { return randomBytes(32).toString('base64url'); }
export function resumir(valor) { return createHash('sha256').update(valor).digest('hex'); }
export function compararSegredo(primeiro, segundo) {
  const a = Buffer.from(String(primeiro || ''));
  const b = Buffer.from(String(segundo || ''));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export function obterConfiguracao(ambiente = process.env) {
  const simulado = ambiente.NUTRIFOTO_SIMULADO === 'true';
  if (simulado && (ambiente.NODE_ENV === 'production' || ambiente.VERCEL || ambiente.CI_PRODUCAO)) {
    falhar(503, 'Simulação proibida neste ambiente.');
  }
  const origem = ambiente.APP_ORIGIN || (simulado ? 'http://127.0.0.1:4173' : '');
  let url;
  try { url = new URL(origem); } catch { falhar(503, 'Origem do aplicativo não configurada.'); }
  if (url.origin !== origem || (!simulado && url.protocol !== 'https:')) falhar(503, 'Origem do aplicativo inválida.');
  if (simulado && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) falhar(503, 'Simulação restrita ao computador local.');
  if (!simulado && (!ambiente.SUPABASE_URL?.startsWith('https://') || !ambiente.SUPABASE_ANON_KEY || !ambiente.SUPABASE_SERVICE_ROLE_KEY || !ambiente.RATE_LIMIT_SALT)) {
    falhar(503, 'Serviço ainda não configurado.');
  }
  const lerLimite = (nome, padrao) => {
    const numero = Number(ambiente[nome] ?? padrao);
    if (!Number.isInteger(numero) || numero < 0 || numero > 10000) falhar(503, 'Limite de consumo inválido.');
    return numero;
  };
  return { ambiente, origem, simulado, limiteGratis: lerLimite('IA_QUOTA_GRATIS', 0), limitePago: lerLimite('IA_QUOTA_PAGO', 0) };
}

export function lerCookies(requisicao) {
  return Object.fromEntries((requisicao.headers.cookie || '').split(';').filter(Boolean).map(parte => {
    const indice = parte.indexOf('=');
    return [parte.slice(0, indice).trim(), parte.slice(indice + 1).trim()];
  }));
}

export function definirCookie(resposta, nome, valor, configuracao, segundos = 2592000) {
  const anterior = resposta.getHeader('Set-Cookie') || [];
  resposta.setHeader('Set-Cookie', [...(Array.isArray(anterior) ? anterior : [anterior]), `${nome}=${valor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${segundos}${configuracao.simulado ? '' : '; Secure'}`]);
}

export function validarOrigem(requisicao, configuracao) {
  if (requisicao.headers.origin !== configuracao.origem || requisicao.headers['sec-fetch-site'] === 'cross-site') falhar(403, 'Origem não autorizada.', 'ORIGEM_INVALIDA');
  const cookies = lerCookies(requisicao);
  if (!compararSegredo(cookies.nf_csrf, requisicao.headers['x-csrf-token'])) falhar(403, 'Atualize a sessão e tente novamente.', 'CSRF_INVALIDO');
  if (!String(requisicao.headers['content-type'] || '').startsWith('application/json')) falhar(415, 'Envie JSON.');
}

export async function lerCorpo(requisicao, limite = 4_000_000, bruto = false) {
  // O handler Vercel desabilita bodyParser para aplicar limite também durante streaming.
  let tamanho = 0;
  const partes = [];
  if (Number(requisicao.headers['content-length']) > limite) falhar(413, 'Conteúdo excede o limite permitido.');
  for await (const parte of requisicao) {
    const buffer = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
    tamanho += buffer.length;
    if (tamanho > limite) falhar(413, 'Conteúdo excede o limite permitido.');
    partes.push(buffer);
  }
  const texto = Buffer.concat(partes).toString('utf8');
  if (bruto) return texto;
  try { return texto ? JSON.parse(texto) : {}; } catch { falhar(400, 'JSON inválido.'); }
}

export function obterIdempotencia(requisicao) {
  const chave = requisicao.headers['x-idempotency-key'];
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(chave || '')) falhar(400, 'Chave de idempotência obrigatória.');
  return chave;
}

export async function lerRespostaLimitada(resposta, limite) {
  if (Number(resposta.headers.get('content-length') || 0) > limite) falhar(502, 'Resposta externa excede o limite.');
  const partes = [];
  let tamanho = 0;
  for await (const parte of resposta.body || []) {
    tamanho += parte.length;
    if (tamanho > limite) falhar(502, 'Resposta externa excede o limite.');
    partes.push(Buffer.from(parte));
  }
  return Buffer.concat(partes);
}

export async function buscarJson(url, opcoes = {}, tempo = 12000, limiteResposta = 1_000_000) {
  try {
    const resposta = await fetch(url, { ...opcoes, signal: AbortSignal.timeout(tempo) });
    const texto = (await lerRespostaLimitada(resposta, limiteResposta)).toString('utf8');
    let dados = {};
    try { dados = texto ? JSON.parse(texto) : {}; } catch { falhar(502, 'Resposta externa inválida.'); }
    return { ok: resposta.ok, status: resposta.status, dados };
  } catch (erro) {
    if (erro.status) throw erro;
    falhar(503, 'Serviço temporariamente indisponível.', 'PROVEDOR_INDISPONIVEL');
  }
}

export function verificarAssinaturaWebhook(corpo, cabecalho, segredo, agora = Date.now()) {
  const partes = String(cabecalho || '').split(',').map(parte => parte.split('='));
  const instante = partes.find(([nome]) => nome === 't')?.[1];
  if (!/^\d+$/.test(instante || '') || Math.abs(agora / 1000 - Number(instante)) > 300) falhar(400, 'Assinatura de evento inválida.');
  const assinatura = createHmac('sha256', segredo).update(`${instante}.${corpo}`).digest('hex');
  if (!partes.some(([nome, valor]) => nome === 'v1' && compararSegredo(valor, assinatura))) falhar(400, 'Assinatura de evento inválida.');
}
