import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { criarAplicacao } from '../servidor/aplicacao.js';
import { criarSimulador } from '../servidor/simulador.js';
import { executarIA, validarPedidoIA } from '../servidor/ia.js';
import { prepararDiagnostico, carregarAmbientePrivado, enviarChamadaControlada, lerControle, pastaEvidencias } from './apoio/controle-ia-real.js';

const raiz=resolve(import.meta.dirname,'..'),resultados=[],errosPagina=[],respostasBackend=[];
const ambientePrivado=carregarAmbientePrivado();
const configuracaoReal={simulado:false,origem:'http://127.0.0.1:4387',ambiente:{...ambientePrivado,PLANOS_HOMOLOGADOS:'false',IA_MAX_TOKENS_ANALISE:'700'}};
let navegador,servidor,paginaAtual;
async function verificar(nome,funcao){try{await funcao();resultados.push({nome,resultado:'APROVADO'});console.log('APROVADO '+nome);}catch(erro){resultados.push({nome,resultado:'REPROVADO',erro:erro.message});console.log('REPROVADO '+nome+': '+erro.message);if(paginaAtual){const estado=await paginaAtual.evaluate(()=>({tela:document.querySelector('.screen.active')?.id,aviso:document.querySelector('#toast')?.textContent,erro:document.querySelector('#erro-inicial')?.textContent}));console.log(JSON.stringify(estado));gravarEstado('falha-'+resultados.length,estado);}}}
async function executarModeloControlado(pedido){
  validarPedidoIA(pedido,configuracaoReal);
  // Uma resposta real já obtida pode ser revalidada sem cobrar novamente.
  const anterior=lerControle().chamadas.find(item=>item.tipo===pedido.tipo&&item.estado==='respondida');
  const arquivo=anterior&&resolve(pastaEvidencias,`resposta-${anterior.numero}.json`);
  const consultar=arquivo&&existsSync(arquivo)?async()=>({ok:true,status:200,dados:JSON.parse(readFileSync(arquivo,'utf8'))}):async(_url,opcoes)=>enviarChamadaControlada('chat/completions',opcoes,pedido.tipo);
  const resultado=await executarIA(pedido,configuracaoReal,consultar);
  writeFileSync(resolve(pastaEvidencias,`interpretado-${pedido.tipo}.json`),JSON.stringify({origem:anterior?'resposta-real-reutilizada':'chamada-real-nesta-execucao',resultado},null,2));
  return resultado;
}
async function iniciarServidor(){
  const temporario=await mkdtemp(resolve(tmpdir(),'nutrifoto-real-'));
  const ambiente={NUTRIFOTO_SIMULADO:'true',APP_ORIGIN:configuracaoReal.origem,IA_QUOTA_GRATIS:'50'};
  const atender=criarAplicacao({ambiente,repositorio:criarSimulador(resolve(temporario,'fixtures.json')),executarModelo:executarModeloControlado,registrar:()=>{}});
  const publica=resolve(raiz,'www');
  const tipos={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.svg':'image/svg+xml','.txt':'text/plain'};
  servidor=createServer(async(req,res)=>{
    if(req.url.startsWith('/api/'))return atender(req,res);
    try{const caminho=decodeURIComponent(new URL(req.url,configuracaoReal.origem).pathname);const arquivo=resolve(publica,'.'+(caminho==='/'?'/index.html':caminho));if(!arquivo.startsWith(publica+sep)||!tipos[extname(arquivo)]||/(?:^|[\\/])\.|config\.local/.test(caminho)){res.writeHead(404);res.end();return;}
      res.setHeader('Content-Type',tipos[extname(arquivo)]+'; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");res.end(await readFile(arquivo));
    }catch{res.writeHead(404);res.end();}
  });await new Promise(resolver=>servidor.listen(4387,'127.0.0.1',resolver));
}
async function abrirPagina(contexto){const p=await contexto.newPage();p.setDefaultTimeout(15000);p.on('pageerror',erro=>errosPagina.push(erro.message));p.on('response',async r=>{if(r.url().endsWith('/api/ia'))try{respostasBackend.push({status:r.status(),corpo:await r.json()});gravarEstado('respostas-backend',respostasBackend);}catch{}});await p.goto(configuracaoReal.origem,{waitUntil:'networkidle'});if(await p.locator('.onboarding-skip-btn').isVisible())await p.locator('.onboarding-skip-btn').click();return p;}
async function navegar(p,tela){if(await p.locator('#screen-results').isVisible())await p.locator('#btn-back-analyze').click();if(await p.locator('#screen-capture').isVisible())await p.locator('#btn-cancel-capture').click();if(['dashboard','history','diet','settings'].includes(tela))await p.locator('.nav-btn[data-screen="'+tela+'"]').click();else{await navegar(p,'settings');await p.locator('[data-ir-tela="'+tela+'"]').first().click();}await p.waitForTimeout(100);}
async function recarregarPagina(p){await p.reload({waitUntil:'networkidle'});if(await p.locator('.onboarding-skip-btn').isVisible())await p.locator('.onboarding-skip-btn').click();}
async function entrar(p){await navegar(p,'conta');await p.locator('#conta-email').fill('ana@exemplo.test');await p.locator('#conta-senha').fill('Teste-local-2026!');await p.locator('#formulario-conta button[type=submit]').click();await p.waitForFunction(()=>document.querySelector('#screen-dashboard').classList.contains('active'));await navegar(p,'privacidade');await p.locator('#privacidade-ia').check();}
async function abrirTexto(p,texto,gramas='200'){await navegar(p,'dashboard');await p.locator('#quick-add-meal').click();await p.locator('[data-mode=text]').click();await p.locator('#text-food-name').fill(texto);await p.locator('#text-food-grams').fill(gramas);await p.locator('#btn-analyze').click();}
function gravarEstado(nome,dados){mkdirSync(pastaEvidencias,{recursive:true});writeFileSync(resolve(pastaEvidencias,nome+'.json'),JSON.stringify(dados,null,2));}

try{
  const diagnostico=await prepararDiagnostico();
  if(diagnostico.bloqueado)throw new Error('Diagnóstico não aprovado. Chamadas de geração interrompidas.');
  await iniciarServidor();try{navegador=await chromium.launch({headless:true});}catch{navegador=await chromium.launch({channel:'chrome',headless:true});}
  const contexto=await navegador.newContext({viewport:{width:390,height:844},timezoneId:'America/Sao_Paulo'});
  await contexto.route('**/*',rota=>rota.request().url().startsWith(configuracaoReal.origem)?rota.continue():rota.abort());
  const p=await abrirPagina(contexto);paginaAtual=p;await entrar(p);
  await verificar('texto externo real: interpretar, mostrar e salvar sem duplicar',async()=>{
    await abrirTexto(p,'Vitamina preparada com 100 g de banana nanica crua e 100 g de leite de vaca integral, sem açúcar.');
    await p.locator('#screen-results').waitFor({state:'visible',timeout:30000});
    const analise=await p.evaluate(async()=>structuredClone((await import('/js/base.js')).estado.currentAnalysis));assert(analise.alimentos.length>0);assert(!analise.simulado);gravarEstado('texto-interface',analise);
    await p.screenshot({path:resolve(pastaEvidencias,'texto-real.png')});await p.locator('#btn-save-meal').evaluate(b=>{b.click();b.click();});await p.waitForFunction(()=>document.querySelectorAll('.meal-item').length===1);
  });
  await verificar('foto licenciada: reconhecer banana, editar porção e salvar',async()=>{
    await navegar(p,'dashboard');await p.locator('#quick-add-meal').click();await p.locator('[data-mode=photo]').click();const seletor=p.waitForEvent('filechooser');await p.locator('#btn-gallery').click();await(await seletor).setFiles(resolve(raiz,'testes/fixtures/banana-evan-amos.jpg'));
    await p.locator('#btn-analyze').click();await p.locator('#screen-results').waitFor({state:'visible',timeout:30000});
    const antes=await p.evaluate(async()=>structuredClone((await import('/js/base.js')).estado.currentAnalysis));assert(antes.alimentos.some(a=>/banana/i.test(a.nome)));assert(!antes.simulado);gravarEstado('foto-interface',antes);
    await p.screenshot({path:resolve(pastaEvidencias,'foto-real.png')});const alimento=antes.alimentos[0];const gramas=alimento.porcao_estimada_g*1.5;await p.locator('.food-receipt-grams').first().fill(String(gramas));
    const depois=await p.evaluate(async()=>structuredClone((await import('/js/base.js')).estado.currentAnalysis));assert(Math.abs(depois.alimentos[0].calorias-alimento.calorias*1.5)<0.02);gravarEstado('foto-porcao-editada',depois);
    await p.locator('#btn-save-meal').click();await p.waitForFunction(()=>document.querySelectorAll('.meal-item').length===2);
  });
  await verificar('reload, histórico, edição e gráficos conservam refeições reais',async()=>{
    await recarregarPagina(p);await p.waitForFunction(()=>document.querySelectorAll('.meal-item').length===2);assert.equal(await p.locator('#macro-bars .macro-bar-value').count(),3);
    await navegar(p,'history');await p.locator('.timeline-day-header').first().click();assert.equal(await p.locator('.timeline-meal').count(),2);await p.locator('.timeline-meal').first().click();await p.getByRole('dialog').waitFor();const original=Number(await p.locator('.edit-overlay .food-receipt-grams').first().inputValue());await p.locator('.edit-overlay .food-receipt-grams').first().fill(String(original+10));await p.locator('#edit-save-btn').click();await recarregarPagina(p);await navegar(p,'history');assert.equal(await p.locator('.timeline-meal').count(),2);await p.screenshot({path:resolve(pastaEvidencias,'historico-real.png')});
  });
  await verificar('TACO local não consome chamada externa',async()=>{const quantidade=lerControle().chamadas.length;await abrirTexto(p,'arroz integral cozido','200');await p.locator('#screen-results').waitFor({state:'visible'});assert.equal(lerControle().chamadas.length,quantidade);assert.equal(Number(await p.locator('#totals-summary strong').first().textContent()),247);});
  await verificar('plano externo permanece bloqueado sem alterar metas',async()=>{await navegar(p,'diet');await p.locator('#dp-idade').fill('32');await p.locator('#dp-peso').fill('75');await p.locator('#dp-altura').fill('175');const quantidade=lerControle().chamadas.length;const retorno=p.waitForResponse(r=>r.url().endsWith('/api/ia'));await p.locator('#btn-generate-plan').click();assert.equal((await retorno).status(),403);assert.equal(lerControle().chamadas.length,quantidade);assert(await p.locator('#diet-form-container').isVisible());});
  await verificar('backup integral restaura refeições derivadas das respostas reais',async()=>{
    const dados=await p.evaluate(async()=>{const b=await import('/js/backup.js');const antes=await b.exportarBackupIntegral();await b.restaurarDadosIntegrais(antes.dados);const depois=await b.exportarBackupIntegral();return{antes,depois};});
    assert.equal(dados.antes.dados.meals.length,2);assert(dados.antes.dados.meals.some(m=>m.imageDataUrl));assert.deepEqual(dados.depois.dados.meals,dados.antes.dados.meals);gravarEstado('backup-com-respostas-reais',dados.depois);
  });
  for(const status of [503,429,401])await verificar('erro HTTP '+status+' simulado sem consumo',async()=>{
    await contexto.route('**/api/ia',rota=>rota.fulfill({status,contentType:'application/json',body:JSON.stringify({erro:'Falha controlada '+status})}));await abrirTexto(p,'bebida fictícia para teste','200');
    if(status===401){await p.locator('#screen-conta').waitFor({state:'visible'});assert(await p.locator('#formulario-conta').isVisible());}else{await p.waitForFunction(()=>!document.querySelector('#btn-analyze').disabled);assert(await p.locator('#screen-capture').isVisible());assert.match(await p.locator('#toast').textContent(),new RegExp(String(status)));}
    await contexto.unroute('**/api/ia');
  });
  await entrar(p);
  await verificar('JSON nutricional inválido é recusado sem consumo',async()=>{await contexto.route('**/api/ia',rota=>rota.fulfill({status:200,contentType:'application/json',body:'{"alimentos":[{"nome":"Falso","porcao_estimada_g":-1}],"total":{}}'}));await abrirTexto(p,'bebida fictícia para teste','200');await p.waitForFunction(()=>!document.querySelector('#btn-analyze').disabled);assert(await p.locator('#screen-capture').isVisible());await contexto.unroute('**/api/ia');});
  await verificar('timeout simulado libera a interface sem consumo',async()=>{let retida;await contexto.route('**/api/ia',rota=>{retida=rota;});await p.clock.install();await abrirTexto(p,'bebida fictícia para teste','200');await p.waitForFunction(()=>document.querySelector('#btn-analyze').disabled);await p.clock.fastForward(31000);await p.waitForFunction(()=>!document.querySelector('#btn-analyze').disabled);assert.match(await p.locator('#toast').textContent(),/esgotado|cancelada/i);await retida?.abort().catch(()=>{});await contexto.unroute('**/api/ia');});
  await verificar('nenhuma credencial no navegador, respostas ou ativos atuais',async()=>{const segredo=ambientePrivado.OPENROUTER_API_KEY;const dados=await p.evaluate(()=>({html:document.documentElement.outerHTML,local:{...localStorage},sessao:{...sessionStorage},cookies:document.cookie}));assert(!JSON.stringify(dados).includes(segredo));assert(!JSON.stringify(respostasBackend).includes(segredo));assert.equal((await fetch(configuracaoReal.origem+'/js/config.local.js')).status,404);assert.deepEqual(errosPagina,[]);});
  await contexto.close();
}catch(erro){resultados.push({nome:'preparação/infraestrutura',resultado:'REPROVADO',erro:erro.message});console.error(erro.message);}
finally{
  if(navegador)await navegador.close();if(servidor)await new Promise(resolver=>servidor.close(resolver));
  gravarEstado('resultado-interface',{resultados,errosPagina,contas:'ficticias-locais',armazenamento:'temporario-local',ia:'real-ou-resposta-real-reutilizada',controle:lerControle()});
  gravarEstado('respostas-backend',respostasBackend);
  if(resultados.some(item=>item.resultado==='REPROVADO'))process.exitCode=1;
}
