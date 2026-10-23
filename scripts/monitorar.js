// Uso: node --env-file=.env scripts/monitorar.js. Só lê; nenhum envio externo ou alteração de dados.
const origem = process.env.MONITOR_ORIGIN || process.env.APP_ORIGIN;
const segredo = process.env.OPERACAO_SECRET;
try {
  const url = new URL(origem);
  if (url.origin !== origem || (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol !== 'https:')) throw Error('Origem inválida.');
  if (!segredo || segredo.length < 32) throw Error('Defina OPERACAO_SECRET com pelo menos 32 caracteres.');
  const resposta = await fetch(origem + '/api/operacao', { headers: { Authorization: 'Bearer ' + segredo }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!resposta.ok) throw Error('Monitoramento indisponível: HTTP ' + resposta.status);
  const resumo = await resposta.json();
  console.log(JSON.stringify(resumo, null, 2));
  if (resumo.alertas?.length) process.exitCode = 2;
} catch (erro) { console.error(erro.message); process.exitCode = 1; }
