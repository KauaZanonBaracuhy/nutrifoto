// Carga autorizada exclusivamente em servidor efêmero de loopback com adaptador JSON fictício.
const { fork } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, dirname } = require('node:path');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const raiz = resolve(__dirname, '..');
const hash = valor => createHash('sha256').update(JSON.stringify(valor)).digest('hex');

async function executarFilho() {
  const { createServer } = await import('node:http');
  const { criarAplicacao } = await import('../servidor/aplicacao.js');
  const { criarSimulador } = await import('../servidor/simulador.js');
  const ambiente = { NUTRIFOTO_SIMULADO: 'true', APP_ORIGIN: 'http://127.0.0.1:4173', IA_QUOTA_GRATIS: '0' };
  let picoRss = process.memoryUsage().rss;
  const amostra = setInterval(() => { picoRss = Math.max(picoRss, process.memoryUsage().rss); }, 20);
  const servidor = createServer(criarAplicacao({ ambiente, repositorio: criarSimulador(process.env.ARQUIVO_CARGA), registrar: () => {} }));
  servidor.requestTimeout = 30000;
  servidor.listen(0, '127.0.0.1', () => { ambiente.APP_ORIGIN = `http://127.0.0.1:${servidor.address().port}`; process.send({ origem: ambiente.APP_ORIGIN }); });
  process.on('message', mensagem => {
    if (mensagem === 'medir') process.send({ recursos: { cpuMicros: process.cpuUsage(), picoRssBytes: picoRss, memoria: process.memoryUsage() } });
    if (mensagem === 'encerrar') { clearInterval(amostra); servidor.closeAllConnections(); servidor.close(() => process.exit()); }
  });
}

function esperarMensagem(filho, chave) {
  return new Promise((resolver, rejeitar) => {
    const prazo = setTimeout(() => { filho.kill(); rejeitar(Error('Prazo da carga local excedido.')); }, 45000);
    function receber(mensagem) { if (mensagem[chave]) { clearTimeout(prazo); filho.off('message', receber); resolver(mensagem[chave]); } }
    filho.on('message', receber); filho.once('error', rejeitar);
  });
}

async function executarRodada(concorrencia) {
  const temporaria = mkdtempSync(join(tmpdir(), 'nutrifoto-carga-comercial-'));
  const arquivo = join(temporaria, 'dados.json');
  const usuario = '11111111-1111-4111-8111-111111111111';
  const dados = { revisao: 1, dados: { meals: Array.from({ length: 10000 }, (_, i) => ({ id: i + 1, nome: 'Registro fictício ' + i, calorias: 100 })) } };
  writeFileSync(arquivo, JSON.stringify({ usuarios: [{ id: usuario, email: 'ana@exemplo.test' }], sessoes: {}, dados: { [usuario]: dados }, consumo: {}, operacoes: {}, limites: {}, assinaturas: {} }));
  const filho = fork(__filename, ['--filho'], { cwd: raiz, execArgv: ['--max-old-space-size=384'], env: { ...process.env, ARQUIVO_CARGA: arquivo }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let erroFilho = ''; filho.stderr.on('data', parte => { erroFilho += parte; });
  try {
    const origem = await esperarMensagem(filho, 'origem');
    const inicial = await fetch(origem + '/api/conta'), sessao = await inicial.json();
    let cookies = inicial.headers.getSetCookie().map(cookie => cookie.split(';')[0]);
    const login = await fetch(origem + '/api/conta', { method: 'POST', headers: { Origin: origem, 'Content-Type': 'application/json', 'X-CSRF-Token': sessao.csrf, Cookie: cookies.join('; ') }, body: JSON.stringify({ acao: 'entrar', email: 'ana@exemplo.test', senha: 'Teste-local-2026!' }) });
    if (!login.ok) throw Error('Falha na preparação isolada: ' + login.status);
    cookies.push(...login.headers.getSetCookie().map(cookie => cookie.split(';')[0]));
    const duracoes = [], status = {}, total = Math.max(200, concorrencia * 2);
    let proximo = 0; const inicio = performance.now();
    const recursosAntes = esperarMensagem(filho, 'recursos'); filho.send('medir'); const antes = await recursosAntes;
    await Promise.all(Array.from({ length: concorrencia }, async () => {
      while (proximo++ < total) {
        const tempo = performance.now();
        const resposta = await fetch(origem + '/api/assinatura', { headers: { Cookie: cookies.join('; ') }, signal: AbortSignal.timeout(30000) });
        const corpo = await resposta.json();
        if (resposta.ok && corpo.plano !== 'gratuito') throw Error('Contrato de assinatura divergente.');
        duracoes.push(performance.now() - tempo); status[resposta.status] = (status[resposta.status] || 0) + 1;
      }
    }));
    const duracaoMs = performance.now() - inicio;
    const recursosDepois = esperarMensagem(filho, 'recursos'); filho.send('medir'); const depois = await recursosDepois;
    const estado = JSON.parse(readFileSync(arquivo));
    const integridade = hash(estado.dados[usuario]) === hash(dados) && Object.keys(estado.sessoes).length === 1;
    duracoes.sort((a, b) => a - b);
    const percentil = fracao => duracoes[Math.ceil(duracoes.length * fracao) - 1];
    const cpuMicros = depois.cpuMicros.user + depois.cpuMicros.system - antes.cpuMicros.user - antes.cpuMicros.system;
    if (!integridade || Object.keys(status).some(codigo => !['200', '429'].includes(codigo))) throw Error('Falha de integridade/status: ' + JSON.stringify(status));
    return { concorrencia, pedidos: total, duracaoMs, pedidosPorSegundo: total * 1000 / duracaoMs, p50Ms: percentil(.5), p95Ms: percentil(.95), p99Ms: percentil(.99), status, cpuMicros, cpuPercentualUmNucleo: cpuMicros / (duracaoMs * 10), picoRssBytes: depois.picoRssBytes, registrosFicticios: 10000, integridade, banco: 'Adaptador JSON com escrita serializada; não mede concorrência PostgreSQL.' };
  } catch (erro) { throw Error(erro.message + ' ' + erroFilho); }
  finally {
    if (filho.exitCode === null && filho.signalCode === null) { const encerrado = new Promise(resolver => filho.once('exit', resolver)); filho.kill(); await encerrado; }
    if (dirname(resolve(temporaria)) !== resolve(tmpdir()) || !temporaria.includes('nutrifoto-carga-comercial-')) throw Error('Destino temporário não verificado.');
    rmSync(temporaria, { recursive: true, force: true });
  }
}

if (process.argv.includes('--filho')) executarFilho().catch(erro => { console.error(erro); process.exit(1); });
else (async () => {
  const rodadas = [];
  for (const concorrencia of [10, 50, 100, 500]) { const resultado = await executarRodada(concorrencia); rodadas.push(resultado); console.log(JSON.stringify(resultado)); }
  const pasta = join(raiz, 'evidencias', 'comercial'); mkdirSync(pasta, { recursive: true });
  writeFileSync(join(pasta, 'carga-comercial.json'), JSON.stringify({ geradoEm: new Date().toISOString(), simulado: true, redeExterna: false, limiteHeapServidorMb: 384, rodadas, limite: 'Mede proteção e latência HTTP local com fixtures; não comprova capacidade comercial dos provedores ou usuários simultâneos.' }, null, 2));
})().catch(erro => { console.error(erro); process.exitCode = 1; });
