const {_electron:electron}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const raiz=path.resolve(__dirname,'..'),versao=require('../package.json').version,nome='NutriFoto-Teste-'+versao+'-Windows-x64.exe';
const pasta=path.join(raiz,'evidencias/refinamento/exe-limpo');fs.mkdirSync(pasta,{recursive:true});
const distribuicao=fs.mkdtempSync(path.join(os.homedir(),'NutriFoto-Validacao-'+versao+'-'));
fs.copyFileSync(path.join(raiz,'builds/windows-release',nome),path.join(distribuicao,nome));
const pastaAplicativo=path.join(distribuicao,'aplicativo');fs.cpSync(path.join(raiz,'builds/windows-release/win-unpacked'),pastaAplicativo,{recursive:true});
const perfil=fs.mkdtempSync(path.join(os.tmpdir(),'nutrifoto-windows-teste-limpo-'));
const ambiente={...process.env,NUTRIFOTO_PERFIL_TESTE:perfil};delete ambiente.ELECTRON_RUN_AS_NODE;
let aplicativo,pagina;const resultados=[],erros=[];
const hash=arquivo=>createHash('sha256').update(fs.readFileSync(arquivo)).digest('hex');
async function verificar(nome,executar){await executar();resultados.push({nome,resultado:'APROVADO'});console.log('APROVADO '+nome);}
async function abrir(){
  aplicativo=await electron.launch({executablePath:path.join(pastaAplicativo,'NutriFotoTeste.exe'),args:['--teste-interface'],cwd:pastaAplicativo,env:ambiente,timeout:60000});
  pagina=await aplicativo.firstWindow();pagina.setDefaultTimeout(15000);pagina.on('pageerror',e=>erros.push(e.message));
  await aplicativo.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
  await pagina.locator('#screen-settings').waitFor({state:'attached'});if(await pagina.locator('.onboarding-skip-btn').isVisible())await pagina.locator('.onboarding-skip-btn').click();
}
async function fechar(){await aplicativo?.close().catch(()=>{});}
async function navegar(tela){await pagina.evaluate(async t=>(await import('/js/base.js')).mostrarTela(t),tela);}
async function abrirCampo(seletor){const campo=pagina.locator(seletor),secao=campo.locator('xpath=ancestor::details[1]');if(await secao.count()&&await secao.getAttribute('open')===null)await secao.locator('summary').click();return campo;}
async function foto(nome){await pagina.evaluate(()=>{document.querySelector('.screen.active .main')?.scrollTo({top:0,behavior:'instant'});document.querySelector('#toast').classList.remove('show');});await pagina.screenshot({path:path.join(pasta,nome+'.png'),animations:'disabled'});}
(async()=>{try{
  await abrir();
  await verificar('distribuicao Windows inicia de pasta limpa externa e corresponde a fonte atual',async()=>{
    assert.equal(hash(path.join(distribuicao,nome)),hash(path.join(raiz,'builds/windows-release',nome)));
    assert((await aplicativo.evaluate(({app})=>app.getAppPath())).startsWith(pastaAplicativo));
    for(const arquivo of ['js/plano.js','css/style.css']){const texto=await pagina.evaluate(async a=>(await fetch('/'+a)).text(),arquivo);assert.equal(createHash('sha256').update(texto).digest('hex'),hash(path.join(raiz,'www',arquivo)));}
    assert.equal(await pagina.evaluate(()=>typeof window.require),'undefined');assert.equal(await pagina.locator('#erro-inicial').textContent(),'');
    assert(await pagina.evaluate(async()=>{await document.fonts.ready;return document.fonts.check('14px "Space Grotesk"')}));assert(await pagina.locator('.header svg').count());
  });
  await verificar('Meu Plano salva perfil sem backend e restaura todas as declaracoes',async()=>{
    await navegar('diet');await pagina.locator('#dp-idade').fill('34');await pagina.locator('#dp-peso').fill('72');await pagina.locator('#dp-altura').fill('170');
    await(await abrirCampo('#dp-chips-tipo [data-value=performance]')).click();await(await abrirCampo('#dp-chips [data-value=vegetariano]')).click();await pagina.locator('#dp-gestante').check();await pagina.locator('#dp-acompanhamento').check();await pagina.locator('#btn-save-profile').click();
    const p=await pagina.evaluate(async()=>(await import('/js/dietPlan.js')).getUserProfile());assert.deepEqual(p.restricoes,['vegetariano']);assert.equal(p.tipoDieta,'performance');assert(await pagina.locator('#btn-generate-plan').isDisabled());
    await fechar();await abrir();await navegar('diet');assert.equal(await pagina.locator('#dp-idade').inputValue(),'34');assert(await pagina.locator('#dp-gestante').isChecked());assert(await pagina.locator('#dp-acompanhamento').isChecked());await foto('perfil-windows');
    await pagina.locator('#dp-gestante').uncheck();await(await abrirCampo('#dp-chips [data-value=nenhuma]')).click();await pagina.locator('#btn-save-profile').click();
  });
  await verificar('importacao permite consultar rascunho e trocar alimento validado sem IA',async()=>{
    const p=await pagina.evaluate(async()=>(await import('/js/dietPlan.js')).getUserProfile());const arroz=JSON.parse(fs.readFileSync(path.join(raiz,'www/data/taco.json')))[0];
    const item={...arroz,alimento:arroz.nome,porcao_estimada_g:100,quantidade:'100 g',categoria:'carboidrato'};
    const plano={tdee:2000,metaCalorica:item.calorias,macros:{proteina:item.proteina_g,carboidrato:item.carboidrato_g,gordura:item.gordura_g},refeicoes:[{nome:'Exemplo fictício — não é plano alimentar',horario:'12:00',kcalEstimada:item.calorias,itens:[item]}],simulado:true};
    const backup={formato:'nutrifoto.backup',versao:1,criadoEm:new Date().toISOString(),dados:{meals:[],weights:[],water:[],perfil:p,plano,metas:null,preferencias:null,tema:'azul',notificacoes:null,tutorial:1}};
    const arquivo=path.join(pasta,'backup-ficticio.json');fs.writeFileSync(arquivo,JSON.stringify(backup));await navegar('settings');await pagina.locator('#importar-backup').setInputFiles(arquivo);await pagina.getByRole('button',{name:'Confirmar',exact:true}).click();await pagina.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Backup restaurado'));
    await navegar('diet');await pagina.locator('#diet-plan-view').waitFor({state:'visible'});assert.match(await pagina.locator('#plan-aviso').textContent(),/fictício/);
    await pagina.locator('.plan-meal-swap-btn:enabled').first().click();await pagina.locator('.swap-modal-option').first().click();await pagina.locator('.swap-overlay').waitFor({state:'detached'});await foto('rascunho-windows');
    await pagina.locator('#btn-edit-profile').click();assert.equal(await pagina.locator('#dp-idade').inputValue(),'34');await pagina.locator('#btn-edit-profile').click();assert(await pagina.locator('#diet-plan-view').isVisible());
  });
  await verificar('telas, CSS, fontes, icones e imagens funcionam fora do repositorio',async()=>{
    await navegar('dashboard');await pagina.locator('#quick-add-meal').click();await pagina.locator('[data-mode=text]').click();await pagina.locator('#text-food-name').fill('Banana, nanica, crua');await pagina.locator('#text-food-grams').fill('100');await pagina.locator('#btn-analyze').click();await pagina.locator('#screen-results').waitFor({state:'visible'});
    for(const largura of [390,1100]){await pagina.setViewportSize({width:largura,height:900});for(const tema of ['azul','minimalista']){await pagina.evaluate(async t=>(await import('/js/base.js')).definirTema(t),tema);for(const tela of ['dashboard','diet','capture','results','history','settings','conta','assinatura']){await navegar(tela);await foto(`${largura}-${tema}-${tela}`);assert(await pagina.evaluate(()=>{const m=document.querySelector('.screen.active .main');return m.scrollWidth<=m.clientWidth+2;}));}}}
    assert.equal(await pagina.evaluate(async()=>{try{await fetch('https://example.com');return 'acesso';}catch{return 'bloqueado';}}),'bloqueado');
  });
  assert.deepEqual(erros,[]);
}catch(e){resultados.push({resultado:'REPROVADO',erro:e.stack});await pagina?.screenshot({path:path.join(pasta,'falha.png'),timeout:5000}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(pasta,'resultados.json'),JSON.stringify({distribuicao,executavel:path.join(distribuicao,nome),sha256:hash(path.join(distribuicao,nome)),perfil,resultados,erros},null,2));await fechar();}})().catch(e=>{console.error(e);process.exitCode=1;});
