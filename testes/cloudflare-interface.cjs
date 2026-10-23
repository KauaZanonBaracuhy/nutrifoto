// Executa o Worker real no workerd/Wrangler, sem credenciais ou IA externas.
const {spawn,spawnSync}=require('node:child_process'),{chromium}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const raiz=path.resolve(__dirname,'..'),pasta=path.join(raiz,'evidencias/cloudflare'),origem=process.env.NUTRIFOTO_URL_PREVIA||'http://127.0.0.1:8791';
fs.mkdirSync(pasta,{recursive:true});let logs='',navegador;const erros=[],resultados=[];
const processo=process.env.NUTRIFOTO_URL_PREVIA?null:spawn(process.execPath,['scripts/wrangler-local.js','--port','8791'],{cwd:raiz,env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
processo?.stdout.on('data',dados=>logs+=dados);processo?.stderr.on('data',dados=>logs+=dados);
async function verificar(nome,acao){await acao();resultados.push(nome);console.log('APROVADO '+nome);}
(async()=>{try{
 let pronta=false;for(let i=0;i<200;i++){try{if((await fetch(origem+'/api/saude')).ok){pronta=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(pronta,'Wrangler não iniciou: '+logs.slice(-1500));
 await verificar('API real Workers: versão, planos, configuração ausente e métodos',async()=>{
  const versao=await(await fetch(origem+'/api/versao')).json();assert.equal(versao.versao,'0.3.2');
  const oferta=await(await fetch(origem+'/api/licenca')).json();assert.deepEqual(oferta.planos.map(p=>[p.centavos,p.fotos]),[[2490,50],[3490,100]]);
  for(const rota of ['conta','dados','ia','operacao','manutencao']){const r=await fetch(origem+'/api/'+rota);assert.equal(r.status,503,rota);assert.match(r.headers.get('content-type'),/json/);assert.equal(r.headers.get('cache-control'),'no-store');}
  assert.equal((await fetch(origem+'/api/inexistente',{headers:{'Sec-Fetch-Mode':'navigate'}})).status,404);assert.equal((await fetch(origem+'/api/asaas-webhook')).status,405);
  const tentativa=await fetch(origem+'/api/licenca',{method:'POST',headers:{'content-type':'application/json',origin:'https://exemplo-malicioso.test'},body:'{"acao":"desafio"}'});assert.equal(tentativa.status,503);
 });
 await verificar('Assets corretos, exemplos privados excluídos e versão atual no workerd',async()=>{
  for(const nome of ['js/base.js','js/captura.js','js/resultados.js','sw.js'])assert.equal(await(await fetch(origem+'/'+nome)).text(),fs.readFileSync(path.join(raiz,'www',nome),'utf8'));
  for(const nome of ['/index.html','/telas/capture.html'])assert.equal((await fetch(origem+nome,{redirect:'manual'})).status,200,'HTML não deve redirecionar: '+nome);
  for(const nome of JSON.parse(fs.readFileSync(path.join(raiz,'www/precache.json'),'utf8')))assert.equal((await fetch(origem+nome,{redirect:'manual'})).status,200,'Precache ausente: '+nome);
  assert.equal((await fetch(origem+'/js/config.example.js')).status,404);assert.equal((await fetch(origem+'/.env')).status,404);assert.equal((await fetch(origem+'/nao-existe')).status,404);assert.match((await fetch(origem+'/')).headers.get('content-security-policy'),/default-src/);
 });
 try{navegador=await chromium.launch({headless:true});}catch{navegador=await chromium.launch({headless:true,channel:'chrome'});}
 const contexto=await navegador.newContext({viewport:{width:390,height:844}});
 const pagina=await contexto.newPage();pagina.on('pageerror',erro=>erros.push(erro.message));
 await verificar('Web no Wrangler: navegação, perfil e explicação de Pix sem login',async()=>{
  await pagina.goto(origem+'/?tela=ativacao');await pagina.locator('#licenca-versao').filter({hasText:'0.3.2'}).waitFor();if(await pagina.locator('.onboarding-skip-btn').isVisible())await pagina.locator('.onboarding-skip-btn').click();
  await pagina.locator('#licenca-pagar').click();await pagina.locator('#licenca-erro').filter({hasText:'nenhum Pix será criado aqui'}).waitFor();
  for(const tela of ['dashboard','history','settings','diet']){await pagina.locator('.nav-btn[data-screen='+tela+']').click();await pagina.locator('#screen-'+tela+'.active').waitFor();}
  for(const [campo,valor]of[['dp-idade','30'],['dp-peso','70'],['dp-altura','170']]){await pagina.locator('#'+campo).evaluate(e=>{const d=e.closest('details');if(d)d.open=true;});await pagina.locator('#'+campo).fill(valor);}
  await pagina.locator('#btn-save-profile').click();await pagina.locator('#perfil-feedback').filter({hasText:'Perfil salvo'}).waitFor();await pagina.reload();await pagina.locator('#dp-idade').waitFor();assert.equal(await pagina.locator('#dp-idade').inputValue(),'30');
  await pagina.screenshot({path:path.join(pasta,'worker-perfil.png')});
 });
 await verificar('PWA real do Worker controla reabertura e mantém diário offline',async()=>{
  const contextoPwa=await navegador.newContext();const reaberta=await contextoPwa.newPage();await reaberta.goto(origem+'/');await reaberta.evaluate(()=>navigator.serviceWorker.ready);await reaberta.reload();assert.equal(await reaberta.evaluate(()=>Boolean(navigator.serviceWorker.controller)),true);await contextoPwa.setOffline(true);await reaberta.goto(origem+'/?tela=dashboard');await reaberta.locator('#screen-dashboard.active').waitFor();assert.equal(await reaberta.locator('#erro-inicial').textContent(),'');await contextoPwa.close();assert.deepEqual(erros,[]);
 });
}catch(erro){console.error(erro);process.exitCode=1;resultados.push({falha:erro.message});}finally{await navegador?.close();if(processo&&process.platform==='win32')spawnSync('taskkill',['/PID',String(processo.pid),'/T','/F'],{stdio:'ignore'});else processo?.kill();fs.writeFileSync(path.join(pasta,processo?'worker-local.json':'worker-previa.json'),JSON.stringify({ambiente:origem+'; sem configuração de serviços externos',resultados,erros},null,2));fs.writeFileSync(path.join(pasta,'wrangler-local.log'),logs);}})();
