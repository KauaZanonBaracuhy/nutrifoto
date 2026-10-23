const { app, BrowserWindow, protocol, session, Menu, dialog } = require('electron');
const { readFile, mkdir } = require('node:fs/promises');
const { resolve, join, sep, extname } = require('node:path');
const { tmpdir } = require('node:os');

const origem = 'nutrifoto://app';
const raiz = resolve(__dirname, '../www');
const tipos = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.webp':'image/webp', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8' };
const politica = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
const emTeste = process.argv.includes('--teste-interface');
const perfilTeste = emTeste ? process.env.NUTRIFOTO_PERFIL_TESTE : '';
if (perfilTeste && !resolve(perfilTeste).startsWith(resolve(tmpdir()) + sep + 'nutrifoto-windows-teste-')) throw new Error('Perfil de teste fora da pasta temporaria permitida.');
app.setPath('userData', perfilTeste || join(app.getPath('appData'), 'NutriFoto-Teste'));
app.setAppUserModelId('com.nutrifoto.teste.windows');
protocol.registerSchemesAsPrivileged([{ scheme:'nutrifoto', privileges:{ standard:true, secure:true, supportFetchAPI:true, corsEnabled:true } }]);

let janela;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.show(); janela.focus(); } });
  app.whenReady().then(iniciarAplicativo).catch(erro => { dialog.showErrorBox('NutriFoto nao abriu', erro.message); app.quit(); });
}
app.on('window-all-closed', () => app.quit());

async function atenderArquivo(pedido) {
  const endereco = new URL(pedido.url);
  if (endereco.host !== 'app') return new Response('Endereco indisponivel.', { status:404 });
  if (endereco.pathname.startsWith('/api/')) {
    const visitante = endereco.pathname === '/api/conta' && pedido.method === 'GET';
    return new Response(JSON.stringify(visitante ? { usuario:null, csrf:'desktop-local-sem-backend' } : { erro:'A conexao com contas e IA ainda nao esta configurada. Os recursos locais continuam disponiveis.' }), { status:visitante ? 200 : 503, headers:{ 'Content-Type':'application/json', 'Cache-Control':'no-store' } });
  }
  if (!['GET','HEAD'].includes(pedido.method)) return new Response(null, { status:405 });
  try {
    const caminho = decodeURIComponent(endereco.pathname === '/' ? '/index.html' : endereco.pathname);
    const arquivo = resolve(raiz, '.' + caminho);
    if (!arquivo.startsWith(raiz + sep) || !tipos[extname(arquivo)] || /(?:^|[\\/])\.|config\.local/i.test(caminho)) return new Response(null, { status:404 });
    const conteudo = await readFile(arquivo);
    return new Response(pedido.method === 'HEAD' ? null : conteudo, { headers:{ 'Content-Type':tipos[extname(arquivo)], 'Content-Security-Policy':politica, 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store' } });
  } catch { return new Response('Arquivo nao encontrado.', { status:404 }); }
}

async function iniciarAplicativo() {
  await mkdir(app.getPath('userData'), { recursive:true });
  protocol.handle('nutrifoto', atenderArquivo);
  session.defaultSession.setPermissionRequestHandler((_conteudo, _permissao, responder) => responder(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest({ urls:['http://*/*','https://*/*','ws://*/*','wss://*/*'] }, (_pedido, responder) => responder({ cancel:true }));
  session.defaultSession.on('will-download', (_evento, item) => item.setSaveDialogOptions({ defaultPath:join(app.getPath('downloads'), item.getFilename()) }));
  Menu.setApplicationMenu(null);
  janela = new BrowserWindow({
    title:'NutriFoto — teste Windows', width:450, height:940, minWidth:360, minHeight:600,
    useContentSize:true, show:!emTeste, backgroundColor:'#0B1E3F', icon:join(raiz,'icons/icon-512.png'),
    webPreferences:{ preload:join(__dirname,'precarregar.cjs'), nodeIntegration:false, contextIsolation:true, sandbox:true, webSecurity:true, devTools:emTeste, backgroundThrottling:!emTeste },
  });
  janela.webContents.setWindowOpenHandler(() => ({ action:'deny' }));
  janela.webContents.on('will-navigate', (evento, endereco) => { if (new URL(endereco).origin !== new URL(origem).origin || !endereco.startsWith(origem + '/')) evento.preventDefault(); });
  await janela.loadURL(origem + '/');
}
