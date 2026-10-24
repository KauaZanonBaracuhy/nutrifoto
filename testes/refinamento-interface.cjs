const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const raiz=path.resolve(__dirname,'..'),pasta=path.join(raiz,'evidencias/refinamento');
fs.mkdirSync(path.join(pasta,'depois'),{recursive:true});
const temporario=fs.mkdtempSync(path.join(os.tmpdir(),'nutrifoto-refinamento-'));
const origem='http://127.0.0.1:4196';
const servidor=spawn(process.execPath,['servidor/local.js','--simulado','--porta','4196'],{cwd:raiz,env:{...process.env,NUTRIFOTO_FIXTURES:path.join(temporario,'fixtures.json')},stdio:'ignore'});
const resultados=[],erros=[];let navegador,pagina;
async function verificar(nome,executar){await executar();resultados.push({nome,resultado:'APROVADO'});console.log('APROVADO '+nome);}
async function navegar(tela){await pagina.evaluate(async t=>(await import('/js/base.js')).mostrarTela(t),tela);}
async function abrirCampo(seletor){const campo=pagina.locator(seletor);const secao=campo.locator('xpath=ancestor::details[1]');if(await secao.count()&&await secao.getAttribute('open')===null)await secao.locator('summary').click();return campo;}
async function preencher(seletor,valor){await(await abrirCampo(seletor)).fill(valor);}
async function capturar(nome){await pagina.evaluate(()=>{document.querySelector('.screen.active .main')?.scrollTo({top:0,behavior:'instant'});document.querySelector('#toast')?.classList.remove('show');});await pagina.screenshot({path:path.join(pasta,'depois',nome+'.png'),animations:'disabled'});}
(async()=>{try{
  for(let i=0;i<60;i++){try{if((await fetch(origem)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  try{navegador=await chromium.launch({headless:true});}catch{navegador=await chromium.launch({headless:true,channel:'chrome'});}
  const contexto=await navegador.newContext({viewport:{width:390,height:844},timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  await contexto.route('**/*',rota=>rota.request().url().startsWith(origem)?rota.continue():rota.abort());
  pagina=await contexto.newPage();pagina.on('pageerror',e=>erros.push(e.message));pagina.setDefaultTimeout(15000);
  await pagina.goto(origem);await pagina.locator('.onboarding-skip-btn').click();
  await verificar('perfil vazio tem caminho local, validacao acessivel e secoes compactas',async()=>{
    await navegar('diet');assert(await pagina.locator('#btn-save-profile').isVisible());assert.equal(await pagina.locator('.perfil-secao[open]').count(),1);
    await pagina.locator('#btn-save-profile').click();assert.equal(await pagina.locator('#dp-idade').getAttribute('aria-invalid'),'true');assert.equal(await pagina.locator(':focus').getAttribute('id'),'dp-idade');await capturar('perfil-validacao');
  });
  await verificar('estilo alimentar nao contamina restricoes e perfil clinico pode ser salvo',async()=>{
    await preencher('#dp-idade','32');await preencher('#dp-peso','75');await preencher('#dp-altura','175');
    await(await abrirCampo('#dp-chips-tipo [data-value=equilibrado]')).click();
    await(await abrirCampo('#dp-chips [data-value=vegetariano]')).click();
    await preencher('#dp-condicoes','Condição fictícia para teste');await pagina.locator('#dp-gestante').check();await pagina.locator('#dp-acompanhamento').check();
    await pagina.locator('#btn-save-profile').click();const perfil=await pagina.evaluate(async()=>(await import('/js/dietPlan.js')).getUserProfile());
    assert.deepEqual(perfil.restricoes,['vegetariano']);assert.equal(perfil.tipoDieta,'equilibrado');assert.equal(perfil.gestante,true);assert.equal(perfil.acompanhamentoProfissional,true);
    await navegar('dashboard');await navegar('diet');assert(await pagina.locator('#dp-gestante').isChecked());assert(await pagina.locator('#dp-acompanhamento').isChecked());assert(await pagina.locator('#btn-generate-plan').isDisabled());
  });
  await verificar('rascunho do perfil sobrevive navegacao e salvar persiste apos reload',async()=>{
    await preencher('#dp-favoritos','Aveia de teste');await navegar('settings');await navegar('diet');assert.equal(await pagina.locator('#dp-favoritos').inputValue(),'Aveia de teste');
    await pagina.locator('#btn-save-profile').click();await pagina.reload();await pagina.locator('#screen-diet').waitFor({state:'visible'});assert.equal(await pagina.locator('#dp-favoritos').inputValue(),'Aveia de teste');
  });
  await verificar('simulacao autorizada gera rascunho; perfis clinicos continuam bloqueados',async()=>{
    await navegar('conta');await pagina.locator('#conta-email').fill('ana@exemplo.test');await pagina.locator('#conta-senha').fill('Teste-local-2026!');await pagina.locator('#formulario-conta button[type=submit]').click();await pagina.locator('#screen-dashboard').waitFor({state:'visible'});
    await navegar('privacidade');await pagina.locator('#privacidade-ia').check();await navegar('diet');
    await preencher('#dp-idade','30');await preencher('#dp-peso','70');await preencher('#dp-altura','170');
    await preencher('#dp-condicoes','Teste clínico');assert(await pagina.locator('#btn-generate-plan').isDisabled());
    await preencher('#dp-condicoes','');await pagina.locator('#btn-generate-plan').click();await pagina.locator('#diet-plan-view').waitFor({state:'visible'});
    assert.match(await pagina.locator('#plan-aviso').textContent(),/fictício/);assert.equal(await pagina.locator('#plan-macro-bars .plano-macro').count(),3);assert.equal(await pagina.locator('#btn-apply-goals').count(),0);
    const metas=await pagina.evaluate(async()=>JSON.stringify((await import('/js/storage.js')).getGoals()));await pagina.evaluate(async()=>(await import('/js/plano.js')).aplicarMetasPlano());assert.equal(await pagina.evaluate(async()=>JSON.stringify((await import('/js/storage.js')).getGoals())),metas);await capturar('plano-salvo');
  });
  await verificar('falha de substituicao preserva plano e nova tentativa recalcula com TACO',async()=>{
    const antes=await pagina.evaluate(async()=>JSON.stringify((await import('/js/dietPlan.js')).getCurrentPlan()));
    await contexto.route('**/data/taco.json',rota=>rota.abort());await pagina.locator('.plan-meal-swap-btn:enabled').first().click();await pagina.locator('.swap-modal-option').first().click();await pagina.waitForFunction(()=>/Não|fetch/i.test(document.querySelector('#substituicao-feedback')?.textContent||''));
    assert.equal(await pagina.evaluate(async()=>JSON.stringify((await import('/js/dietPlan.js')).getCurrentPlan())),antes);await pagina.keyboard.press('Escape');await contexto.unroute('**/data/taco.json');
    await pagina.locator('.plan-meal-swap-btn:enabled').first().click();await pagina.locator('.swap-modal-option').first().click();await pagina.locator('.swap-overlay').waitFor({state:'detached'});
    const depois=await pagina.evaluate(async()=>{const p=(await import('/js/dietPlan.js')).getCurrentPlan();(await import('/js/nutricao.js')).validarPlano(p);return JSON.stringify(p);});assert.notEqual(depois,antes);
  });
  await verificar('editar e voltar ao rascunho funciona sem gerar novamente',async()=>{
    await pagina.locator('#btn-edit-profile').click();assert(await pagina.locator('#diet-form-container').isVisible());assert.equal(await pagina.locator('#dp-idade').inputValue(),'30');await pagina.locator('#btn-edit-profile').click();assert(await pagina.locator('#diet-plan-view').isVisible());
  });
  await verificar('restricoes sem alternativa mostram explicacao e nao oferecem troca insegura',async()=>{
    await pagina.locator('#btn-edit-profile').click();await preencher('#dp-alergias','Amendoim');await pagina.locator('#btn-save-profile').click();await pagina.locator('#btn-edit-profile').click();assert.equal(await pagina.locator('.plan-meal-swap-btn:enabled').count(),0);assert.match(await pagina.locator('.plano-troca-ajuda').textContent(),/não têm substituição/);await capturar('plano-restricoes');
  });
  await verificar('captura por texto calcula TACO e apresenta o resultado revisavel',async()=>{
    await navegar('dashboard');await pagina.locator('#quick-add-meal').click();await pagina.locator('[data-mode=text]').click();await pagina.locator('#text-food-name').fill('Banana, nanica, crua');await pagina.locator('#text-food-grams').fill('100');await pagina.locator('#btn-analyze').click();await pagina.locator('#screen-results').waitFor({state:'visible'});assert.equal(await pagina.locator('.food-receipt').count(),1);
  });
  await verificar('todas as telas, temas e larguras preservam hierarquia e limites',async()=>{
    for(const largura of [320,390,1280]){
      await pagina.setViewportSize({width:largura,height:900});
      for(const tema of ['azul','minimalista']){
        await pagina.evaluate(async t=>(await import('/js/base.js')).definirTema(t),tema);
        for(const tela of ['dashboard','diet','capture','results','history','settings','conta','privacidade','assinatura']){
          await navegar(tela);await capturar(`${largura}-${tema}-${tela}`);
          const extravasamento=await pagina.evaluate(()=>{const a=document.querySelector('.screen.active .main');return a.scrollWidth>a.clientWidth+2;});assert(!extravasamento,`${tela} ${largura}`);
        }
        await navegar('diet');await pagina.locator('#btn-edit-profile').click();await capturar(`${largura}-${tema}-perfil`);await pagina.locator('#btn-edit-profile').click();
      }
    }
    await pagina.emulateMedia({reducedMotion:'reduce'});await navegar('diet');await pagina.locator('#btn-edit-profile').click();await(await abrirCampo('#dp-atividade')).focus();await pagina.keyboard.press('ArrowDown');await pagina.keyboard.press('Enter');
    await pagina.setViewportSize({width:320,height:750});await pagina.locator('.perfil-secao').evaluateAll(secoes=>secoes.forEach(secao=>secao.open=true));assert(await pagina.evaluate(()=>{const m=document.querySelector('#diet-main');return m.scrollWidth<=m.clientWidth+2;}));
  });
  assert.deepEqual(erros,[]);
}catch(e){resultados.push({resultado:'REPROVADO',erro:e.stack});await pagina?.screenshot({path:path.join(pasta,'falha.png'),timeout:5000}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(pasta,'resultados.json'),JSON.stringify({resultados,erros},null,2));await navegador?.close();servidor.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
