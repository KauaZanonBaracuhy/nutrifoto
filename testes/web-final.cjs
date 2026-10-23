// Confere a Web final servida ao proprietário; dados locais deste contexto são fictícios.
const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 let navegador;const erros=[];
 try{
  try{navegador=await chromium.launch({headless:true,channel:'chrome'});}catch{navegador=await chromium.launch({headless:true});}
  const contexto=await navegador.newContext({viewport:{width:390,height:844}}),pagina=await contexto.newPage();
  pagina.on('pageerror',erro=>erros.push(erro.message));
  await pagina.goto('http://127.0.0.1:4173/?tela=ativacao');await pagina.locator('#licenca-versao').filter({hasText:'0.3.2'}).waitFor();
  if(await pagina.locator('.onboarding-skip-btn').isVisible())await pagina.locator('.onboarding-skip-btn').click();
  await pagina.locator('#licenca-pagar').click();await pagina.locator('#licenca-erro').filter({hasText:'nenhum Pix será criado aqui'}).waitFor();
  await pagina.screenshot({path:'evidencias/licencas/web-ativacao-final-0.3.2.png'});
  await pagina.locator('.nav-btn[data-screen=dashboard]').click();await pagina.locator('#quick-add-meal').click();await pagina.locator('#btn-analyze').click();
  await pagina.locator('#captura-feedback').filter({hasText:'Tire uma foto'}).waitFor();await pagina.screenshot({path:'evidencias/licencas/web-captura-final-0.3.2.png'});
  const seletor=pagina.waitForEvent('filechooser');await pagina.locator('#btn-gallery').click();await(await seletor).setFiles('evidencias/licencas/foto-sintetica.png');await pagina.locator('#image-preview img').waitFor();
  await pagina.locator('[data-mode=text]').click();
  const base=JSON.parse(fs.readFileSync('www/data/taco.json','utf8')),banana=base.find(item=>/banana/i.test(item.nome)&&Number.isFinite(item.calorias)&&item.calorias>0);
  assert(banana);await pagina.locator('#text-food-name').fill(banana.nome);await pagina.locator('#text-food-grams').fill('150');await pagina.locator('#btn-analyze').click();await pagina.locator('#screen-results.active').waitFor();
  assert.equal(await pagina.locator('#result-hero img').count(),0,'Texto não pode herdar a foto da captura anterior');
  await pagina.screenshot({path:'evidencias/licencas/web-taco-final-0.3.2.png'});
  await pagina.locator('#btn-save-meal').click();await pagina.locator('#screen-dashboard.active').waitFor();
  assert.equal(await pagina.evaluate(async()=>(await import('/js/db.js')).listarTodasRefeicoes().then(itens=>itens[0].imageDataUrl)),null);
  await pagina.reload();await pagina.locator('#screen-dashboard.active').waitFor();await pagina.getByText(banana.nome,{exact:true}).first().waitFor();
  await pagina.locator('.nav-btn[data-screen=history]').click();await pagina.locator('#screen-history.active').waitFor();assert.deepEqual(erros,[]);
  fs.writeFileSync('evidencias/licencas/web-final-0.3.2.json',JSON.stringify({origem:'http://127.0.0.1:4173',versao:'0.3.2',verificados:['assets atuais','Pix indisponível explicado','captura vazia com erro persistente','TACO 150g por clique','salvar refeição','reabertura','histórico'],erros},null,2));
  console.log('Web final 4173 aprovada: versão, Pix bloqueado, captura, TACO, salvamento, reabertura e histórico.');
 }finally{await navegador?.close();}
})().catch(erro=>{console.error(erro);process.exitCode=1;});
