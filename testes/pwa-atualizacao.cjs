// Testa o SW e a UI reais; varia somente a versão do SW em memória, sem editar www.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile, mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
const { resolve, join, extname, dirname } = require('node:path');
const { tmpdir } = require('node:os');
const raiz = resolve(__dirname, '..'), pasta = join(raiz, 'evidencias/comercial/pwa-atualizacao');
const resultados = [], errosPagina = [];
let navegador, servidor, temporaria, revisao = 'ensaio-1';
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };

async function verificar(nome, acao) {
  try { await acao(); resultados.push({ nome, estado: 'APROVADA EM AMBIENTE LOCAL' }); console.log('APROVADO ' + nome); }
  catch (erro) { resultados.push({ nome, estado: 'REPROVADA', erro: erro.message }); throw erro; }
}

(async () => {
  await mkdir(pasta, { recursive: true }); temporaria = await mkdtemp(join(tmpdir(), 'nutrifoto-pwa-atualizacao-'));
  const { criarAplicacao } = await import('../servidor/aplicacao.js');
  const { criarSimulador } = await import('../servidor/simulador.js');
  const ambiente = { NUTRIFOTO_SIMULADO: 'true', APP_ORIGIN: 'http://127.0.0.1:4173' };
  const api = criarAplicacao({ ambiente, repositorio: criarSimulador(join(temporaria, 'fixtures.json')), registrar: () => {} });
  const permitidos = new Set([...JSON.parse(await readFile(join(raiz, 'www/precache.json'), 'utf8')), '/precache.json', '/sw.js', '/']);
  const sw = await readFile(join(raiz, 'www/sw.js'), 'utf8');
  assert.match(sw, /const VERSAO_CACHE='[^']+';/, 'Build deve gerar versão do cache.');
  servidor = createServer(async (pedido, resposta) => {
    const caminho = new URL(pedido.url, 'http://local').pathname;
    if (caminho.startsWith('/api/')) return api(pedido, resposta);
    if (!permitidos.has(caminho)) { resposta.writeHead(404); resposta.end(); return; }
    try {
      resposta.setHeader('Cache-Control', 'no-store'); resposta.setHeader('Content-Type', tipos[extname(caminho)] || 'text/html');
      let conteudo = caminho === '/sw.js' ? sw.replace(/const VERSAO_CACHE='[^']+';/, `const VERSAO_CACHE='nutrifoto-estatico-${revisao}';`) : await readFile(join(raiz, 'www', caminho === '/' ? 'index.html' : caminho.slice(1)));
      if(caminho === '/' || caminho === '/index.html')conteudo=conteudo.toString().replace('<body',`<body data-revisao="${revisao}"`);
      resposta.end(conteudo);
    } catch { resposta.writeHead(404); resposta.end(); }
  });
  await new Promise(resolver => servidor.listen(0, '127.0.0.1', resolver)); ambiente.APP_ORIGIN = `http://127.0.0.1:${servidor.address().port}`;
  try { navegador = await chromium.launch({ headless: true, channel: 'chrome' }); } catch { navegador = await chromium.launch({ headless: true }); }
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const pagina = await contexto.newPage(); pagina.setDefaultTimeout(15000);
  pagina.on('pageerror', erro => errosPagina.push(erro.message));
  await verificar('Instalação inicial do SW real e controle após recarregar', async () => {
    await pagina.goto(ambiente.APP_ORIGIN, { waitUntil: 'networkidle' });
    await pagina.evaluate(() => navigator.serviceWorker.ready);
    if (await pagina.locator('.onboarding-skip-btn').isVisible()) await pagina.locator('.onboarding-skip-btn').click();
    await pagina.reload({ waitUntil: 'networkidle' });
    await pagina.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    assert.equal(await pagina.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting), null);
    assert(await pagina.evaluate(async () => (await caches.keys()).includes('nutrifoto-estatico-ensaio-1')));
  });
  await verificar('Nova revisão permanece aguardando e exibe aviso sem diálogo automático', async () => {
    revisao = 'ensaio-2';
    await pagina.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await pagina.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting));
    await pagina.locator('.nav-btn[data-screen="settings"]').click();
    await pagina.locator('#atualizacao-app').waitFor({ state: 'visible' });
    assert.equal(await pagina.getByRole('dialog').count(), 0);
    assert(await pagina.locator('#atualizar-app').isEnabled());
    await pagina.screenshot({ path: join(pasta, 'atualizacao-disponivel.png') });
  });
  await verificar('Cancelar atualização preserva worker aguardando e conteúdo em edição', async () => {
    const entrada = pagina.locator('#set-calories');
    await entrada.fill('2345');
    await pagina.locator('#atualizar-app').click();
    await pagina.getByRole('dialog').waitFor();
    assert.match(await pagina.getByRole('dialog').textContent(), /Salve seus rascunhos/);
    await pagina.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert(await pagina.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting)));
    assert.equal(await entrada.inputValue(), '2345');
    assert(await pagina.locator('#atualizar-app').isEnabled());
  });
  await verificar('Reabertura antes de atualizar conserva HTML e módulos da mesma revisão',async()=>{
    await pagina.reload({waitUntil:'networkidle'});
    assert.equal(await pagina.locator('body').getAttribute('data-revisao'),'ensaio-1');
    await pagina.locator('.nav-btn[data-screen="settings"]').click();
    await pagina.locator('#atualizacao-app').waitFor({state:'visible'});
  });
  await verificar('Confirmação explícita ativa nova revisão e recarrega aplicativo', async () => {
    await pagina.locator('#atualizar-app').click();
    await pagina.getByRole('dialog').waitFor();
    await Promise.all([pagina.waitForNavigation({ waitUntil: 'networkidle' }), pagina.getByRole('button', { name: 'Confirmar', exact: true }).click()]);
    await pagina.waitForFunction(async () => {
      const registro = await navigator.serviceWorker.getRegistration();
      return registro?.active?.state === 'activated' && !registro.waiting;
    });
    assert.deepEqual(await pagina.evaluate(async () => (await caches.keys()).filter(chave => chave.startsWith('nutrifoto-estatico-'))), ['nutrifoto-estatico-ensaio-2']);
    await pagina.locator('.nav-btn[data-screen="settings"]').click();
    assert.equal(await pagina.locator('body').getAttribute('data-revisao'),'ensaio-2');
    await pagina.waitForFunction(() => document.querySelector('#atualizacao-app').hidden);
    await pagina.screenshot({ path: join(pasta, 'atualizacao-aplicada.png') });
  });
  await verificar('Cache atualizado exclui APIs e conserva navegação offline', async () => {
    assert.equal(await pagina.evaluate(async () => (await fetch('/api/conta')).status), 200);
    const urls = await pagina.evaluate(async () => (await Promise.all((await caches.keys()).map(async chave => (await (await caches.open(chave)).keys()).map(pedido => pedido.url)))).flat());
    assert(!urls.some(url => new URL(url).pathname.startsWith('/api/')));
    await contexto.setOffline(true);
    await pagina.goto(ambiente.APP_ORIGIN + '/?tela=settings', { waitUntil: 'networkidle' });
    await pagina.locator('#screen-settings').waitFor({ state: 'visible' });
    assert.equal(await pagina.locator('#erro-inicial').textContent(), '');
    await contexto.setOffline(false);
  });
  assert.deepEqual(errosPagina, []);
  await writeFile(join(pasta, 'resultado.json'), JSON.stringify({ geradoEm: new Date().toISOString(), navegador: navegador.version(), revisoes: ['ensaio-1', 'ensaio-2'], fonteAlterada: false, api: 'Simulador local; atualização/cache executados no navegador real.', resultados, errosPagina }, null, 2));
})().catch(async erro => {
  console.error(erro); process.exitCode = 1;
  await mkdir(pasta, { recursive: true }); await writeFile(join(pasta, 'resultado.json'), JSON.stringify({ resultados, errosPagina, erro: erro.message }, null, 2));
}).finally(async () => {
  await navegador?.close(); if (servidor) { servidor.closeAllConnections(); await new Promise(resolver => servidor.close(resolver)); }
  if (temporaria) { assert.equal(dirname(resolve(temporaria)), resolve(tmpdir())); assert(temporaria.includes('nutrifoto-pwa-atualizacao-')); await rm(temporaria, { recursive: true, force: true }); }
});
