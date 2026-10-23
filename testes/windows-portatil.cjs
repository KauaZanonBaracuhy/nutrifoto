const { chromium }=require('@playwright/test');
const { spawn }=require('node:child_process');
const { createServer }=require('node:net');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const raiz=path.resolve(__dirname,'..'),pasta=path.join(raiz,'evidencias/windows');
const nomeExecutavel='NutriFoto-Teste-'+require('../package.json').version+'-Windows-x64.exe';
const caminhoExecutavel=path.resolve(process.argv[2]||path.join(raiz,'builds/windows-release',nomeExecutavel));
const perfil=fs.mkdtempSync(path.join(os.tmpdir(),'nutrifoto-windows-teste-'));
const ambiente={...process.env,NUTRIFOTO_PERFIL_TESTE:perfil};delete ambiente.ELECTRON_RUN_AS_NODE;
let navegador,processo;
(async()=>{
  fs.mkdirSync(pasta,{recursive:true});
  const reserva=createServer();await new Promise(resolver=>reserva.listen(0,'127.0.0.1',resolver));const porta=reserva.address().port;await new Promise(resolver=>reserva.close(resolver));
  processo=spawn(caminhoExecutavel,['--teste-interface','--remote-debugging-port='+porta],{cwd:path.dirname(caminhoExecutavel),env:ambiente,windowsHide:true,stdio:'ignore'});
  let pronto=false;for(let tentativa=0;tentativa<240;tentativa++){try{if((await fetch('http://127.0.0.1:'+porta+'/json/version')).ok){pronto=true;break;}}catch{}await new Promise(resolver=>setTimeout(resolver,500));}
  assert(pronto,'O EXE portatil nao abriu em 120 segundos.');
  navegador=await chromium.connectOverCDP('http://127.0.0.1:'+porta);
  const contexto=navegador.contexts()[0];let pagina=contexto.pages()[0];if(!pagina)pagina=await contexto.waitForEvent('page');
  await pagina.locator('#screen-settings').waitFor({state:'attached',timeout:30000});assert.equal(await pagina.locator('#erro-inicial').textContent(),'');
  if(await pagina.locator('.onboarding-skip-btn').isVisible())await pagina.locator('.onboarding-skip-btn').click();
  assert.equal(await pagina.evaluate(()=>window.NutriFotoDesktop),true);assert.equal(await pagina.evaluate(()=>typeof window.require),'undefined');
  await pagina.screenshot({path:path.join(pasta,'04-exe-portatil.png')});
  fs.writeFileSync(path.join(pasta,'portatil.json'),JSON.stringify({resultado:'APROVADO',arquivo:caminhoExecutavel,perfil,origem:pagina.url()},null,2));
  console.log('APROVADO EXE portatil unico extrai, abre e carrega a interface local.');
  await pagina.close();
})().catch(erro=>{console.error(erro);process.exitCode=1;}).finally(async()=>{await navegador?.close().catch(()=>{});if(processo&&!processo.exitCode)await new Promise(resolver=>{const tempo=setTimeout(resolver,8000);processo.once('exit',()=>{clearTimeout(tempo);resolver();});});});
