const {chromium,firefox,webkit}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const raiz=path.resolve(__dirname,'..'),pasta=path.join(raiz,'evidencias/comercial/interface');
fs.mkdirSync(pasta,{recursive:true});
const temporario=fs.mkdtempSync(path.join(os.tmpdir(),'nutrifoto-comercial-ui-'));
const origem='http://127.0.0.1:4391';
const servidor=spawn(process.execPath,['servidor/local.js','--simulado','--porta','4391'],{cwd:raiz,env:{...process.env,NUTRIFOTO_FIXTURES:path.join(temporario,'contas.json')},stdio:['ignore','pipe','pipe']});
let logs='';servidor.stdout.on('data',dados=>logs+=dados);servidor.stderr.on('data',dados=>logs+=dados);
const resultados=[],indisponiveis=[];
async function verificar(motor,nome,executar){try{await executar();resultados.push({motor,nome,estado:'APROVADA COM SIMULAÇÃO'});console.log('APROVADO '+motor+' '+nome);}catch(erro){resultados.push({motor,nome,estado:'REPROVADA',erro:erro.message});throw erro;}}
async function abrir(contexto,endereco=origem){const pagina=await contexto.newPage();pagina.setDefaultTimeout(12000);await pagina.goto(endereco,{waitUntil:'networkidle'});if(await pagina.locator('.onboarding-skip-btn').isVisible())await pagina.locator('.onboarding-skip-btn').click();return pagina;}
async function ir(pagina,tela){await pagina.evaluate(async nome=>(await import('/js/base.js')).mostrarTela(nome),tela);await pagina.locator('#screen-'+tela).waitFor({state:'visible'});}
(async()=>{
  for(let tentativa=0;tentativa<100;tentativa++){try{if((await fetch(origem)).ok)break;}catch{}await new Promise(resolver=>setTimeout(resolver,100));}
  for(const [motor,fabrica] of Object.entries({chrome:chromium,firefox,webkit})){
    let navegador;
    try{if(motor==='chrome'){try{navegador=await fabrica.launch({headless:true,channel:'chrome'});}catch{navegador=await fabrica.launch({headless:true});}}else navegador=await fabrica.launch({headless:true});}catch(erro){indisponiveis.push({motor,erro:erro.message});continue;}
    const contexto=await navegador.newContext({viewport:{width:390,height:844},locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
    const erros=[];contexto.on('page',pagina=>pagina.on('pageerror',erro=>erros.push(erro.message)));
    await contexto.route('**/*',rota=>rota.request().url().startsWith(origem)?rota.continue():rota.abort());
    try {
      const pagina=await abrir(contexto);
      await verificar(motor,'formulário: erro associado e teclado',async()=>{
        await ir(pagina,'conta');await pagina.locator('#conta-email').fill('inválido');await pagina.locator('#conta-email').press('Enter');
        await pagina.waitForFunction(()=>document.querySelector('#conta-email').getAttribute('aria-invalid')==='true');
        assert.match(await pagina.locator('#conta-erro').textContent(),/e-mail válido/);assert.equal(await pagina.locator('#conta-email').getAttribute('aria-describedby'),'conta-erro');
        await pagina.locator('#conta-email').fill('ana@exemplo.test');await pagina.locator('#conta-senha').fill('Teste-local-2026!');await pagina.locator('#conta-senha').press('Enter');await pagina.locator('#screen-dashboard').waitFor({state:'visible'});
      });
      await verificar(motor,'assinatura: benefícios do servidor e oferta indisponível',async()=>{
        await ir(pagina,'conta');await pagina.locator('[data-ir-tela="assinatura"]').click();await pagina.waitForFunction(()=>document.querySelector('#assinatura-estado').textContent.includes('análises utilizadas'));
        assert.equal(await pagina.locator('#assinatura-checkout').isDisabled(),true);assert.match(await pagina.locator('#assinatura-oferta').textContent(),/Nenhuma oferta/);
        assert.equal(await pagina.locator('#assinatura-beneficios li').count(),5);await pagina.screenshot({path:path.join(pasta,motor+'-assinatura.png'),fullPage:true});
      });
      await verificar(motor,'oferta anual centralizada e pagamento indisponível recuperável',async()=>{
        await contexto.route('**/api/assinatura',rota=>rota.request().method()==='GET'?rota.fulfill({json:{plano:'gratuito',status:'ativo',consumo:0,limite:3,periodos:['mensal','anual'],capacidades:{analises:3,fotos:2,armazenamentoBytes:1000000,analiseTexto:true,analiseFoto:true,sincronizacao:true}}}):rota.fulfill({status:503,json:{erro:'Checkout de teste indisponível. Tente novamente.'}}));
        await pagina.locator('#assinatura-atualizar').click();await pagina.waitForFunction(()=>!document.querySelector('#assinatura-periodo').disabled);await pagina.locator('#assinatura-periodo').selectOption('anual');
        await pagina.locator('#assinatura-checkout').click();await pagina.waitForFunction(()=>document.querySelector('#assinatura-erro').textContent.includes('indisponível'));assert.equal(await pagina.locator('#assinatura-checkout').isDisabled(),false);
        await contexto.unroute('**/api/assinatura');
      });
      await verificar(motor,'falha de consulta mostra erro e permite tentar novamente',async()=>{
        await contexto.route('**/api/assinatura',rota=>rota.abort());await pagina.locator('#assinatura-atualizar').click();await pagina.waitForFunction(()=>document.querySelector('#assinatura-estado').textContent.includes('Não foi possível'));
        assert.match(await pagina.locator('#assinatura-erro').textContent(),/conexão/);await contexto.unroute('**/api/assinatura');await pagina.locator('#assinatura-atualizar').click();await pagina.waitForFunction(()=>document.querySelector('#assinatura-estado').textContent.includes('análises utilizadas'));
      });
      await verificar(motor,'telas em320/390/768/1440px, temas claro/escuro e movimento reduzido',async()=>{
        for(const largura of [320,390,768,1440]){await pagina.setViewportSize({width:largura,height:900});for(const tema of ['azul','minimalista']){await pagina.evaluate(tema=>document.documentElement.dataset.theme=tema,tema);for(const tela of ['conta','assinatura','privacidade']){await ir(pagina,tela);assert.equal(await pagina.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,tela+' '+largura+' '+tema);}}}
        await pagina.setViewportSize({width:390,height:844});await pagina.evaluate(()=>document.documentElement.dataset.theme='azul');
      });
      await verificar(motor,'confirmação por fragmento limpa token antes de enviar e trata expiração',async()=>{
        const token='token-ficticio-uma-unica-utilizacao';const chamadas=[];
        // Interceptação de rede do Playwright não alcança pedidos controlados por SW em todos os motores.
        const contextoToken=await navegador.newContext({serviceWorkers:'block'});await contextoToken.addCookies(await contexto.cookies());
        try {
          await contextoToken.route('**/api/conta',rota=>{if(rota.request().method()==='POST'){chamadas.push(rota.request().postDataJSON());return rota.fulfill({status:400,json:{erro:'Link expirado. Solicite um novo cadastro.'}});}return rota.continue();});
          const confirmacao=await abrir(contextoToken,origem+'/?tela=conta#confirmacao='+token);assert(!confirmacao.url().includes(token));assert.equal(await confirmacao.evaluate(()=>Object.values(localStorage).some(valor=>String(valor).includes('token-ficticio'))),false);
          await confirmacao.locator('#conta-confirmar').click();await confirmacao.waitForFunction(()=>document.querySelector('#conta-erro').textContent.includes('expirado'));
          assert.equal(chamadas.length,1);assert.equal(chamadas[0].acao,'confirmar');assert.equal(chamadas[0].token_hash,token);assert.equal(await confirmacao.locator('#conta-confirmar').isEnabled(),true);
        } finally {await contextoToken.close();}
      });
      await verificar(motor,'PWA: instalação técnica, cache estático e API sem cache',async()=>{
        assert.equal((await pagina.request.get(origem+'/manifest.json')).ok(),true);
        await pagina.waitForFunction(async()=>{if(!('serviceWorker' in navigator))return false;const registro=await navigator.serviceWorker.getRegistration();return Boolean(registro?.active);});
        const cachesLocais=await pagina.evaluate(async()=>{const nomes=await caches.keys();return Promise.all(nomes.map(async nome=>({nome,urls:(await(await caches.open(nome)).keys()).map(pedido=>pedido.url)})));});
        assert(cachesLocais.some(cache=>cache.urls.some(url=>url.endsWith('/telas/assinatura.html'))));assert(!cachesLocais.some(cache=>cache.urls.some(url=>url.includes('/api/'))));
      });
      await verificar(motor,'reabrir offline mantém a tela e busca local',async()=>{
        // Aguarda controlador após a primeira instalação, sem depender de install prompt do SO.
        await contexto.unroute('**/*');
        await pagina.reload({waitUntil:'networkidle'});await pagina.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
        // WebKit Windows bloqueia a navegação no protocolo de emulação offline; derrubar o servidor testa a falha real de fetch do SW.
        if(motor==='webkit'){servidor.kill();await new Promise(resolver=>servidor.once('exit',resolver));}else await contexto.setOffline(true);
        await pagina.goto(origem+'/?tela=assinatura');await pagina.locator('#screen-assinatura').waitFor({state:'visible'});assert.match(await pagina.locator('#assinatura-estado').textContent(),/Entre|Não foi possível/);
        const arroz=await pagina.evaluate(async()=>(await(await import('/js/tacoSearch.js')).buscarCorrespondenciaTaco('Arroz, integral, cozido')).alimento);
        assert(arroz);assert.equal(await pagina.evaluate(async()=>Boolean(await caches.match('/data/taco.json'))),true);await contexto.setOffline(false);
      });
      await verificar(motor,'nenhuma falha JavaScript não tratada',async()=>assert.deepEqual(erros,[]));
    } finally {await contexto.close();await navegador.close();}
  }
  assert(resultados.length>0,'Nenhum navegador disponível.');
})().catch(erro=>{console.error(erro);process.exitCode=1;}).finally(()=>{servidor.kill();fs.writeFileSync(path.join(pasta,'resultado.json'),JSON.stringify({resultados,indisponiveis,dispositivosFisicos:false,integracoesReais:false},null,2));fs.writeFileSync(path.join(pasta,'servidor.log'),logs);});
