const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {spawn}=require('node:child_process');const {chromium}=require('@playwright/test');
const raiz=path.resolve(__dirname,'..'),pasta=path.join(raiz,'evidencias/comercial');
fs.mkdirSync(pasta,{recursive:true});const temporario=fs.mkdtempSync(path.join(os.tmpdir(),'nutrifoto-continuidade-'));
const arquivo=path.join(temporario,'fixtures.json'),origem='http://127.0.0.1:4494';
const servidor=spawn(process.execPath,['servidor/local.js','--simulado','--porta','4494'],{cwd:raiz,env:{...process.env,NUTRIFOTO_FIXTURES:arquivo},stdio:['ignore','pipe','pipe']});
let navegador,logs='';servidor.stdout.on('data',parte=>logs+=parte);servidor.stderr.on('data',parte=>logs+=parte);
const resultados=[];
async function verificar(nome,acao){await acao();resultados.push({nome,estado:'APROVADA COM SIMULAÇÃO'});console.log('APROVADO: '+nome);}
async function abrir(contexto){const pagina=await contexto.newPage();pagina.setDefaultTimeout(12000);await pagina.goto(origem+'/?tela=conta',{waitUntil:'networkidle'});if(await pagina.locator('.onboarding-skip-btn').isVisible())await pagina.locator('.onboarding-skip-btn').click();return pagina;}
async function conta(pagina){await pagina.locator('.nav-btn[data-screen=settings]').click();await pagina.locator('[data-ir-tela=conta]').first().click();await pagina.locator('#screen-conta.active').waitFor();}
async function entrar(pagina,email){await conta(pagina);await pagina.locator('#conta-email').fill(email);await pagina.locator('#conta-senha').fill('Teste-local-2026!');await pagina.locator('#formulario-conta button[type=submit]').click();await pagina.locator('#screen-dashboard.active').waitFor();}
async function dados(pagina){return pagina.evaluate(async()=>({conta:(await import('/js/storage.js')).obterContaArmazenamento(),pesos:await(await import('/js/db.js')).listarPesos()}));}
(async()=>{try{
 for(let tentativa=0;tentativa<60;tentativa++){try{if((await fetch(origem)).ok)break;}catch{}await new Promise(resolver=>setTimeout(resolver,100));if(tentativa===59)throw new Error('Servidor não iniciou: '+logs);}
 try{navegador=await chromium.launch({headless:true});}catch{navegador=await chromium.launch({channel:'chrome',headless:true});}
 const contexto=await navegador.newContext({viewport:{width:390,height:844}});let pagina=await abrir(contexto);
 await entrar(pagina,'ana@exemplo.test');await pagina.evaluate(async()=>{await(await import('/js/db.js')).salvarPeso(70);await(await import('/js/sincronizacao.js')).sincronizarDados();await navigator.serviceWorker.ready;});
 await pagina.reload({waitUntil:'networkidle'});await pagina.waitForFunction(()=>navigator.serviceWorker.controller);
 await verificar('offline real: fechar/reabrir mantém namespace e dados sem fabricar autenticação',async()=>{
  await contexto.setOffline(true);await pagina.close();pagina=await abrir(contexto);await pagina.waitForFunction(()=>document.querySelector('#estado-conta').textContent.includes('Sem conexão'));
  const locais=await dados(pagina);assert.equal(locais.conta,'11111111-1111-4111-8111-111111111111');assert.equal(locais.pesos[0].peso_kg,70);
  assert.equal(await pagina.evaluate(async()=>(await import('/js/servicoHttp.js')).obterSessaoAtual()),null);
  await pagina.evaluate(async()=>{await(await import('/js/db.js')).salvarPeso(71);});
  const bloqueados=await pagina.evaluate(async()=>{sessionStorage.setItem('nutrifoto.cienciaIa','1');const servico=await import('/js/servicoHttp.js');const retorno=[];for(const caminho of ['/api/ia','/api/assinatura']){try{await servico.requisitarApi(caminho,{method:'POST',body:'{"acao":"checkout","tipo":"texto","texto":"teste"}'});retorno.push(false);}catch{retorno.push(true);}}return retorno;});assert.deepEqual(bloqueados,[true,true]);
 });
 await verificar('reconexão revalida o titular antes de enviar alterações offline',async()=>{
  await contexto.setOffline(false);await pagina.evaluate(async()=>{await(await import('/js/sincronizacao.js')).sincronizarDados();});
  const remoto=await pagina.evaluate(async()=>(await fetch('/api/dados')).json());assert.equal(remoto.dados.weights[0].peso_kg,71);assert.equal(await pagina.evaluate(async()=>(await import('/js/continuidadeConta.js')).obterContaOffline()),null);
 });
 await verificar('logout confirmado impede reabrir automaticamente a conta anterior offline',async()=>{
  await conta(pagina);await pagina.locator('#conta-sair').click();await pagina.locator('#screen-dashboard.active').waitFor();assert.equal(await pagina.evaluate(()=>localStorage.getItem('nutrifoto.ultimaContaOffline')),null);
  await contexto.setOffline(true);await pagina.close();pagina=await abrir(contexto);const locais=await dados(pagina);assert.equal(locais.conta,null);assert.equal(locais.pesos.length,0);await contexto.setOffline(false);
 });await contexto.close();
 const abas=await navegador.newContext(),a=await abrir(abas);await entrar(a,'ana@exemplo.test');await a.evaluate(async()=>{await(await import('/js/db.js')).salvarPeso(73);await(await import('/js/sincronizacao.js')).sincronizarDados();});
 const b=await abrir(abas);await conta(b);await b.locator('#conta-sair').click();await b.locator('#screen-dashboard.active').waitFor();await entrar(b,'bruno@exemplo.test');
 await verificar('duas abas com cookies compartilhados: conta B não recebe dados da antiga aba A',async()=>{
  const antes=JSON.parse(fs.readFileSync(arquivo));
  const rejeitado=await a.evaluate(async()=>{try{await(await import('/js/sincronizacao.js')).sincronizarDados();return false;}catch(erro){return erro.status===409||erro.message.includes('conta mudou');}});assert.equal(rejeitado,true);
  await a.waitForFunction(async()=>(await import('/js/storage.js')).obterContaArmazenamento()===null);
  const depois=JSON.parse(fs.readFileSync(arquivo));assert.deepEqual(depois.dados['22222222-2222-4222-8222-222222222222'],antes.dados['22222222-2222-4222-8222-222222222222']);assert.equal(depois.dados['11111111-1111-4111-8111-111111111111'].dados.weights[0].peso_kg,73);
  assert.equal((await dados(a)).conta,null);await a.screenshot({path:path.join(pasta,'multiabas-conta-bloqueada.png')});
 });await abas.close();
}catch(erro){console.error(erro);process.exitCode=1;resultados.push({estado:'REPROVADA',erro:erro.message});}
finally{await navegador?.close();servidor.kill();fs.writeFileSync(path.join(pasta,'continuidade-interface.json'),JSON.stringify(resultados,null,2));}})();
