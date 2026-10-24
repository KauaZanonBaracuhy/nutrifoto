const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{chromium}=require('@playwright/test');
const raiz=path.resolve(__dirname,'..'),pasta=path.join(raiz,'evidencias/licencas');fs.mkdirSync(pasta,{recursive:true});
const origem='http://127.0.0.1:4198',temporario=fs.mkdtempSync(path.join(os.tmpdir(),'nutrifoto-licenca-ui-'));
const servidor=spawn(process.execPath,['servidor/local.js','--simulado','--porta','4198'],{cwd:raiz,env:{...process.env,NUTRIFOTO_FIXTURES:path.join(temporario,'fixtures.json')},stdio:'ignore'});
let navegador;const resultados=[];const erros=[];
async function verificar(nome,acao){await acao();resultados.push({nome,resultado:'APROVADO'});console.log('APROVADO '+nome);}
(async()=>{try{
 for(let i=0;i<100;i++){try{if((await fetch(origem)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 try{navegador=await chromium.launch({headless:true});}catch{navegador=await chromium.launch({channel:'chrome',headless:true});}const contexto=await navegador.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await contexto.route('**/*',rota=>rota.request().url().startsWith(origem)?rota.continue():rota.abort());
 const pagina=await contexto.newPage();pagina.on('pageerror',e=>erros.push(e.message));pagina.setDefaultTimeout(12000);
 await pagina.goto(origem+'/?tela=ativacao');await pagina.waitForFunction(()=>document.querySelector('#licenca-status')?.textContent.includes('Demonstração'));if(await pagina.locator('.onboarding-skip-btn').isVisible())await pagina.locator('.onboarding-skip-btn').click();
 await verificar('Web mostra ofertas como demonstração sem prometer vínculo Android',async()=>{
  await pagina.locator('#screen-ativacao.active').waitFor();await pagina.getByText('R$ 24,90 / 30 dias',{exact:true}).waitFor();
  assert.match(await pagina.locator('#licenca-status').textContent(),/Demonstração Web/);assert.equal(await pagina.locator('#licenca-pagador').isVisible(),true);
  await pagina.locator('#licenca-pagar').click();await pagina.getByText(/nenhum Pix será criado aqui/).waitFor();
  await pagina.locator('#licenca-atualizar').click();await pagina.getByText(/ativação segura está disponível/).waitFor();
  await pagina.locator('summary').filter({hasText:'Recuperar uma compra'}).click();await pagina.locator('#licenca-guardar').click();await pagina.getByText(/ativação segura está disponível/).waitFor();
  await pagina.locator('#licenca-transferir').click();await pagina.getByText(/ativação segura está disponível/).waitFor();
  for(const destino of ['conta','assinatura']){await pagina.evaluate(async d=>(await import('/js/base.js')).mostrarTela(d),destino);assert(await pagina.locator('#screen-ativacao.active').isVisible());}
  await pagina.evaluate(()=>document.querySelector('#toast').classList.remove('show'));await pagina.screenshot({path:path.join(pasta,'web-planos.png')});
 });
 await verificar('diário, TACO, porções e backup continuam funcionando na demonstração',async()=>{
  await pagina.locator('[data-ir-tela=dashboard]').filter({hasText:'Continuar'}).click();
  await pagina.evaluate(async()=>{const banco=await import('/js/db.js');await banco.salvarRefeicao({alimentos:[{nome:'Banana fictícia',porcao_estimada_g:100,calorias:91.5,proteina_g:1.4,carboidrato_g:23.8,gordura_g:0.1}],total:{calorias:91.5,proteina_g:1.4,carboidrato_g:23.8,gordura_g:0.1},createdAt:new Date().toISOString()});await banco.salvarPeso(72);await banco.adicionarCopo(200);});
  const copia=await pagina.evaluate(async()=>{const backup=await(await import('/js/backup.js')).exportarBackupIntegral();return backup;});assert.equal(copia.dados.meals.length,1);assert.equal(copia.dados.weights[0].peso_kg,72);
  await pagina.reload();const guardados=await pagina.evaluate(async()=>{const db=await import('/js/db.js');return{refeicoes:await db.listarTodasRefeicoes(),agua:await db.obterAguaHoje()};});assert.equal(guardados.refeicoes.length,1);assert.equal(guardados.agua.ml_consumidos,200);
  const base=await pagina.evaluate(async()=>{const resposta=await fetch('/data/taco.json');return(await resposta.json()).length;});assert(base>100);
 });
 // Exercita UI Android com respostas explícitas: não comprova hardware nem Asaas real.
 const nativo=await navegador.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await nativo.addInitScript(()=>{window.NutriFotoAndroid={aoVoltar(){},recuperarImagem(){return null;},selecionarFoto:async()=>({dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1kAAAAASUVORK5CYII='})};window.NutriFotoKeystore={identidade:()=>JSON.stringify({chave:'a'.repeat(64),publica:'PUBLICA_FICTICIA',certificados:[]}),assinar:()=> 'ASSINATURA_FICTICIA'};});
 await verificar('captura vazia e perfil gestante respondem sem executar IA',async()=>{
  await pagina.evaluate(async()=> (await import('/js/base.js')).mostrarTela('capture'));
  await pagina.locator('#btn-analyze').click();await pagina.locator('#captura-feedback').filter({hasText:'Tire uma foto ou escolha uma imagem da galeria antes de analisar.'}).waitFor();
  await pagina.locator('[data-mode=text]').click();await pagina.locator('#btn-analyze').click();await pagina.locator('#captura-feedback').filter({hasText:'Digite o nome do alimento.'}).waitFor();
  await pagina.locator('#text-food-name').fill('xyz alimento fictício');await pagina.evaluate(()=>sessionStorage.setItem('nutrifoto.cienciaIa','1'));await pagina.locator('#btn-analyze').click();
  await pagina.locator('#toast').filter({hasText:'demonstração Web'}).waitFor();
  await pagina.evaluate(async()=> (await import('/js/base.js')).mostrarTela('diet'));
  await pagina.locator('#btn-generate-plan').waitFor({state:'visible'});
  await pagina.locator('#dp-gestante').check();
  await pagina.locator('#btn-generate-plan').click();await pagina.locator('#perfil-feedback').filter({hasText:'ainda não foi homologada'}).waitFor();
 });
 await verificar('perfil salvo, edição e rascunho gravado com substituição persistem após reabrir',async()=>{
  await pagina.locator('#dp-gestante').uncheck();
  for(const [campo,valor] of [['#dp-idade','30'],['#dp-peso','65'],['#dp-altura','165']]){await pagina.locator(campo).evaluate(e=>{const secao=e.closest('details');if(secao)secao.open=true;});await pagina.locator(campo).fill(valor);}
  await pagina.locator('#btn-save-profile').click();await pagina.locator('#perfil-feedback').filter({hasText:'Perfil salvo'}).waitFor();await pagina.reload();await pagina.locator('#dp-idade').waitFor();assert.equal(await pagina.locator('#dp-idade').inputValue(),'30');
  // Rascunho gravado fictício; não é geração clínica liberada nem chamada de IA.
  await pagina.evaluate(async()=>{const dominio=await import('/js/dietPlan.js');dominio.saveCurrentPlan({tdee:100,metaCalorica:100,macros:{proteina:5,carboidrato:15,gordura:2},refeicoes:[{nome:'Rascunho fictício de teste',horario:'12:00',kcalEstimada:100,itens:[{alimento:'Teste fictício',nome:'Teste fictício',quantidade:'100g',categoria:'carboidrato',porcao_estimada_g:100,calorias:100,proteina_g:5,carboidrato_g:15,gordura_g:2}]}]});});
  await pagina.locator('.nav-btn[data-screen=diet]').click();await pagina.locator('#diet-plan-view').waitFor({state:'visible'});
  await pagina.locator('#btn-edit-profile').click();await pagina.locator('#dp-idade').waitFor({state:'visible'});await pagina.locator('#dp-idade').fill('31');await pagina.locator('#btn-save-profile').click();await pagina.locator('#btn-edit-profile').click();
  await pagina.locator('.plan-meal-swap-btn').first().click();await pagina.locator('.swap-modal-option').first().click();await pagina.locator('.swap-overlay').waitFor({state:'detached'});
  const salvo=await pagina.evaluate(async()=>(await import('/js/dietPlan.js')).getCurrentPlan());assert.notEqual(salvo.refeicoes[0].itens[0].alimento,'Teste fictício');assert(salvo.metaCalorica>0);
  await pagina.reload();await pagina.locator('#diet-plan-view').waitFor({state:'visible'});assert.equal(await pagina.evaluate(async()=>(await import('/js/dietPlan.js')).getUserProfile().idade),31);
  await pagina.screenshot({path:path.join(pasta,'web-plano-persistido.png')});
 });
 const planos=JSON.parse(fs.readFileSync(path.join(raiz,'www/data/licencas.json'),'utf8'));let ativa=false,plano='ia',compra,analises=0,transferiu=false,vencida=false,foraDoAr=false,chamadasIa=0;
 await nativo.route('**/*',async rota=>{
  const req=rota.request();if(!req.url().startsWith(origem))return rota.abort();if(!req.url().includes('/api/licenca'))return rota.continue();if(foraDoAr)return rota.abort();
  const envelope=req.postDataJSON()||{},p=envelope.pedido||{};let corpo,status=200;
  if(envelope.acao==='desafio')corpo={nonce:'n'.repeat(43)};
  else if(p.acao==='situacao')corpo={id:'33333333-3333-4333-8333-333333333333',ativa,plano,validade:vencida?new Date(Date.now()-86400000).toISOString():ativa?new Date(Date.now()+30*86400000).toISOString():null,diasRestantes:ativa?30:0,planos,sandbox:true,compraPendente:compra||null,compraStatus:compra?ativa?'RECEIVED':'PENDING':null,acompanhamento:ativa&&plano==='completo',uso:{fotos:analises,textos:0}};
  else if(p.acao==='pix'){compra=p.intencao;plano=p.plano;corpo={compra,status:'PENDING',qr:{encodedImage:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1kAAAAASUVORK5CYII=',payload:'PIX_FICTICIO_NAO_PAGAR'}};}
  else if(p.acao==='recuperacao')corpo={codigo:'r'.repeat(43)};
  else if(p.acao==='transferir'){transferiu=true;ativa=true;corpo={ativa:true};}
  else if(p.acao==='autorizar'){status=ativa&&plano==='completo'?200:403;corpo=status===200?{autorizado:true}:{erro:'Este recurso exige NutriFoto Completo vigente.'};}
  else if(p.acao==='analise'){chamadasIa++;corpo={simulado:true,alimentos:[{nome:'Prato fictício gravado',porcao_estimada_g:100,calorias:100,proteina_g:5,carboidrato_g:15,gordura_g:2}],total:{calorias:100,proteina_g:5,carboidrato_g:15,gordura_g:2}};}
  else{status=403;corpo={erro:'Operação não autorizada no fixture.'};}
  return rota.fulfill({status,contentType:'application/json',body:JSON.stringify(corpo)});
 });
 const android=await nativo.newPage();android.on('pageerror',e=>erros.push(e.message));await android.goto(origem);await android.locator('#screen-ativacao.active').waitFor();
 await verificar('UI Android prepara ativação e apresenta Pix, situação e consumo',async()=>{
  await android.locator('#licenca-nome').fill('Pessoa Fictícia');await android.locator('#licenca-documento').fill('11144477735');await android.locator('#licenca-pagar').click();await android.locator('#licenca-pix:visible').waitFor();assert.equal(await android.locator('#licenca-copia').inputValue(),'PIX_FICTICIO_NAO_PAGAR');assert(compra);
  ativa=true;analises=2;await android.locator('#licenca-atualizar').click();await android.getByText('Sua licença está ativa neste dispositivo.',{exact:true}).waitFor();assert.match(await android.locator('#licenca-uso').textContent(),/48 fotos/);
  await android.reload();await android.getByText('Sua licença está ativa neste dispositivo.',{exact:true}).waitFor();
 });
 await verificar('recuperação e transferência têm ação e feedback; vencimento não apaga dados',async()=>{
  await android.locator('summary').filter({hasText:'Recuperar uma compra'}).click();await android.locator('#licenca-guardar').click();await android.waitForFunction(()=>document.querySelector('#licenca-codigo').textContent.includes('rrrr'));
  const codigo=await android.locator('#licenca-codigo').textContent();assert.equal(codigo,'r'.repeat(43));await android.locator('#licenca-recuperacao').fill(codigo);await android.locator('#licenca-transferir').click();await android.waitForFunction(()=>document.querySelector('#licenca-recuperacao').value==='');assert(transferiu);
  ativa=false;await android.locator('#licenca-atualizar').click();await android.waitForFunction(()=>document.querySelector('#licenca-status').textContent.includes('Sem licença'));
  const recusado=await android.evaluate(async()=>{try{await(await import('/js/db.js')).salvarPeso(80);return false;}catch{return true;}});assert(recusado);
 });
 await verificar('ativação funciona em 320/390/1280 px, temas claro/escuro e teclado',async()=>{
  for(const largura of [320,390,1280])for(const tema of ['azul','minimalista']){
   await android.setViewportSize({width:largura,height:900});await android.evaluate(async t=>{document.activeElement?.blur();(await import('/js/base.js')).definirTema(t);document.querySelector('#screen-ativacao .main').scrollTo({top:0,behavior:'instant'});document.querySelector('#toast').classList.remove('show');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},tema);
   assert.equal(await android.locator('.licenca-ciencia').evaluate(e=>getComputedStyle(e).display),'flex');
   assert(await android.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await android.screenshot({path:path.join(pasta,`ativacao-${largura}-${tema}.png`)});
  }
  await android.locator('#licenca-nome').focus();await android.keyboard.press('Tab');assert.equal(await android.evaluate(()=>document.activeElement.id),'licenca-documento');
 });
 await verificar('foto e texto com respostas gravadas permitem revisar e salvar refeições',async()=>{
  ativa=true;vencida=false;analises=0;await android.evaluate(()=>sessionStorage.setItem('nutrifoto.cienciaIa','1'));
  await android.locator('.nav-btn[data-screen=dashboard]').click();await android.locator('#quick-add-meal').click();await android.locator('#btn-gallery').click();await android.locator('#image-preview img').waitFor();await android.locator('#btn-analyze').click();await android.locator('#screen-results.active').waitFor();await android.locator('#btn-save-meal').click();await android.locator('#screen-dashboard.active').waitFor();
  await android.locator('#quick-add-meal').click();await android.locator('[data-mode=text]').click();await android.locator('#text-food-name').fill('xyz prato fictício');await android.locator('#btn-analyze').click();await android.locator('#screen-results.active').waitFor();await android.locator('#btn-save-meal').click();await android.locator('#screen-dashboard.active').waitFor();assert.equal(chamadasIa,2);
  await android.reload();await android.locator('#screen-ativacao.active').waitFor();assert.equal(await android.evaluate(async()=>(await import('/js/db.js')).listarTodasRefeicoes().then(itens=>itens.length)),2);
 });
 await verificar('sem licença, vencimento, limite e servidor indisponível explicam a causa sem chamar IA',async()=>{
  const anteriores=chamadasIa;
  await android.evaluate(async()=>{sessionStorage.setItem('nutrifoto.cienciaIa','1');(await import('/js/base.js')).mostrarTela('capture');(await import('/js/captura.js')).definirModoCaptura('photo');(await import('/js/captura.js')).definirImagemCaptura({dataUrl:'data:image/png;base64,iVBORw0KGgo=',base64:'aGVsbG8=',mediaType:'image/png'});});
  for(const caso of [{ativa:false,vencida:false,uso:0,texto:'ative um plano de 30 dias'},{ativa:false,vencida:true,uso:0,texto:'Seu acesso à IA terminou'},{ativa:true,vencida:false,uso:50,texto:'limite de análises de hoje'}]){
   ativa=caso.ativa;vencida=caso.vencida;analises=caso.uso;await android.locator('#btn-analyze').click();await android.locator('#toast').filter({hasText:caso.texto}).waitFor();
  }
  assert.equal(chamadasIa,anteriores);foraDoAr=true;await android.evaluate(async()=> (await import('/js/base.js')).mostrarTela('ativacao'));await android.locator('#licenca-erro').filter({hasText:'Não conseguimos conectar ao serviço'}).waitFor();
  await android.locator('#licenca-atualizar').click();await android.locator('#licenca-erro').filter({hasText:'Não conseguimos conectar ao serviço'}).waitFor();foraDoAr=false;
 });assert.deepEqual(erros,[]);console.log(`${resultados.length} grupos de interface aprovados; UI Android usa fixtures explícitos.`);
}catch(erro){console.error(erro);process.exitCode=1;resultados.push({resultado:'REPROVADO',erro:erro.stack});}
finally{await navegador?.close();servidor.kill();fs.writeFileSync(path.join(pasta,'interface.json'),JSON.stringify({ambiente:'Web real local e UI Android emulada com fixtures; não é APK',resultados,erros},null,2));}})();
