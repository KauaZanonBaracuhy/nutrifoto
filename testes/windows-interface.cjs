const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const raiz = path.resolve(__dirname,'..');
const pasta = path.join(raiz,'evidencias/windows');
fs.mkdirSync(pasta,{recursive:true});
const perfil = fs.mkdtempSync(path.join(os.tmpdir(),'nutrifoto-windows-teste-'));
const ambiente = {...process.env,NUTRIFOTO_PERFIL_TESTE:perfil};
delete ambiente.ELECTRON_RUN_AS_NODE;
let aplicativo, pagina;
const resultados=[], erros=[];
async function verificar(nome,funcao){await funcao();resultados.push({nome,resultado:'APROVADO'});console.log('APROVADO '+nome);}
async function abrir(){
  aplicativo=await electron.launch({executablePath:path.join(raiz,'builds/windows-release/win-unpacked/NutriFotoTeste.exe'),args:['--teste-interface'],env:ambiente,timeout:60000});
  pagina=await aplicativo.firstWindow();pagina.setDefaultTimeout(15000);pagina.on('pageerror',erro=>erros.push(erro.message));
  await pagina.locator('#screen-settings').waitFor({state:'attached'});
  if(await pagina.locator('.onboarding-skip-btn').isVisible())await pagina.locator('.onboarding-skip-btn').click();
}
async function navegar(tela){await pagina.locator('.nav-btn[data-screen="'+tela+'"]').click();}
(async()=>{
try {
  await abrir();
  await verificar('EXE abre frontend completo com isolamento do processo e sem Node na pagina',async()=>{
    assert.equal(await pagina.locator('#erro-inicial').textContent(),'');assert.equal(await pagina.locator('.screen').count(),10);
    assert.equal(await pagina.evaluate(()=>typeof window.require),'undefined');assert.equal(await pagina.evaluate(()=>window.NutriFotoDesktop),true);
    const preferencias=await aplicativo.evaluate(({BrowserWindow})=>{const p=BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();return {node:p.nodeIntegration,isolamento:p.contextIsolation,sandbox:p.sandbox};});
    assert.deepEqual(preferencias,{node:false,isolamento:true,sandbox:true});
  });
  await verificar('navegacao, TACO local, revisao de porcao e salvar refeicao',async()=>{
    for(const tela of ['history','diet','settings','dashboard']){await navegar(tela);assert(await pagina.locator('#screen-'+tela).isVisible());}
    await pagina.locator('#quick-add-meal').click();await pagina.locator('[data-mode="text"]').click();
    await pagina.locator('#text-food-name').fill('Banana, nanica, crua');await pagina.locator('#text-food-grams').fill('100');await pagina.locator('#btn-analyze').click();
    await pagina.locator('#screen-results').waitFor({state:'visible'});
    await pagina.locator('[data-field="porcao_estimada_g"]').fill('150');await pagina.locator('[data-field="porcao_estimada_g"]').dispatchEvent('change');
    await pagina.locator('#btn-save-meal').click();await pagina.locator('.meal-item').waitFor();assert.equal(await pagina.locator('.meal-item').count(),1);
  });
  await verificar('agua, peso e persistencia apos fechar e reabrir o EXE',async()=>{
    await pagina.locator('.water-chip[data-ml="300"]').click();await pagina.locator('#btn-register-weight').click();
    await pagina.locator('#weight-input').fill('75.2');await pagina.locator('#weight-confirm').click();
    await pagina.waitForFunction(()=>document.querySelector('#weight-current').textContent.includes('75.2'));
    await pagina.screenshot({path:path.join(pasta,'01-diario.png')});await aplicativo.close();await abrir();
    await pagina.locator('.meal-item').waitFor();await pagina.waitForFunction(()=>document.querySelector('#weight-current').textContent.includes('75.2'));
    assert.equal(await pagina.locator('.meal-item').count(),1);assert.match(await pagina.locator('#water-ml-display').textContent(),/^300/);assert.match(await pagina.locator('#weight-current').textContent(),/75.2/);
  });
  await verificar('seletor de foto do computador retorna imagem sem chamar IA',async()=>{
    await pagina.locator('#quick-add-meal').click();
    const escolha=pagina.waitForEvent('filechooser');await pagina.locator('#btn-gallery').click();
    await (await escolha).setFiles(path.join(raiz,'www/icons/icon-512.png'));await pagina.locator('#image-preview img').waitFor({state:'visible'});
    assert((await pagina.locator('#image-preview img').getAttribute('src')).startsWith('data:image/'));
    await pagina.screenshot({path:path.join(pasta,'02-imagem.png')});await pagina.locator('#btn-cancel-capture').click();
  });
  await verificar('backend ausente informa indisponibilidade e trafego externo fica bloqueado',async()=>{
    await navegar('settings');await pagina.locator('[data-ir-tela="conta"]').first().click();
    await pagina.locator('#conta-email').fill('windows@exemplo.test');await pagina.locator('#conta-senha').fill('Teste-Windows-2026!');
    await pagina.locator('#formulario-conta button[type=submit]').click();await pagina.waitForFunction(()=>document.body.textContent.includes('A conexao com contas e IA ainda nao esta configurada'));
    assert.equal(await pagina.evaluate(async()=>{try{await fetch('https://example.com/');return 'acesso';}catch{return 'bloqueado';}}),'bloqueado');
    assert.equal(await pagina.evaluate(async()=> (await fetch('/.env')).status),404);
  });
  await verificar('backup exportado, importacao idempotente e historico',async()=>{
    await navegar('settings');await pagina.locator('.settings-section[data-section="export"] .settings-section-header').click();
    await aplicativo.evaluate(({session},destino)=>{session.defaultSession.removeAllListeners('will-download');globalThis.downloadNutrifotoTeste=new Promise(resolver=>session.defaultSession.once('will-download',(_evento,item)=>{item.setSavePath(destino);item.once('done',(_fim,estado)=>resolver(estado));}));},path.join(pasta,'backup.json'));
    await pagina.locator('#btn-export-json').click();assert.equal(await aplicativo.evaluate(()=>globalThis.downloadNutrifotoTeste),'completed');
    const backup=JSON.parse(fs.readFileSync(path.join(pasta,'backup.json'),'utf8'));assert.equal(backup.dados.meals.length,1);assert.equal(backup.dados.weights[0].peso_kg,75.2);
    await pagina.locator('#importar-backup').setInputFiles(path.join(pasta,'backup.json'));await pagina.getByRole('button',{name:'Confirmar',exact:true}).click();
    await pagina.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Backup restaurado'));await navegar('history');await pagina.locator('.timeline-day-header').waitFor();assert.equal(await pagina.locator('.timeline-day-header').count(),1);
    await pagina.screenshot({path:path.join(pasta,'03-historico.png')});
  });
  assert.deepEqual(erros,[]);
} catch(erro){resultados.push({resultado:'REPROVADO',erro:erro.stack});if(pagina)await pagina.screenshot({path:path.join(pasta,'falha.png')}).catch(()=>{});throw erro;}
finally{fs.writeFileSync(path.join(pasta,'resultados.json'),JSON.stringify({perfil,resultados,erros},null,2));await aplicativo?.close().catch(()=>{});}
})().catch(erro=>{console.error(erro);process.exitCode=1;});
