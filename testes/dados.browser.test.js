import teste,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
let navegador,pagina,servidor;
before(async()=>{
 let biblioteca; try{biblioteca=await import('@playwright/test');}catch{biblioteca=await import(pathToFileURL(resolve(dirname(process.execPath),'../node_modules/playwright/index.mjs')).href);}
 const raiz=resolve('www'); servidor=http.createServer(async(pedido,resposta)=>{
  if(pedido.url==='/'){resposta.end('<!doctype html><title>Teste isolado</title>');return;}
  const arquivo=resolve(raiz,'.'+new URL(pedido.url,'http://localhost').pathname);
  if(!arquivo.startsWith(raiz+sep)){resposta.writeHead(404).end();return;}
  try{resposta.setHeader('Content-Type','text/javascript');resposta.end(await readFile(arquivo));}catch{resposta.writeHead(404).end();}
 });
 await new Promise(resolver=>servidor.listen(0,'127.0.0.1',resolver));
 try{navegador=await biblioteca.chromium.launch({headless:true});}catch{navegador=await biblioteca.chromium.launch({channel:'chrome',headless:true});}
 pagina=await navegador.newPage({timezoneId:'America/Sao_Paulo'});await pagina.goto(`http://127.0.0.1:${servidor.address().port}`);
});
after(async()=>{await navegador?.close();if(servidor)await new Promise(resolver=>servidor.close(resolver));});

teste('backup omite campo opcional undefined legado sem alterar o registro original',async()=>{
 const resultado=await pagina.evaluate(async()=>{
  const banco=await import('/js/db.js'),backup=await import('/js/backup.js');banco.definirContaLocal('opcional-ausente');
  const registrado=await banco.salvarRefeicao({alimentos:[{nome:'Alimento de teste',porcao_estimada_g:100,calorias:100,proteina_g:2,carboidrato_g:20,gordura_g:1,marca_identificada:undefined}],total:{calorias:100,proteina_g:2,carboidrato_g:20,gordura_g:1}});
  const arquivo=await backup.exportarBackupIntegral();const original=await banco.obterRefeicao(registrado.id);await backup.importarBackupIntegral(JSON.parse(JSON.stringify(arquivo)),{modo:'substituir'});
  return{arquivo,originalMantido:Object.hasOwn(original.alimentos[0],'marca_identificada'),restaurados:(await banco.listarTodasRefeicoes()).length};
 });
 assert.equal(resultado.originalMantido,true);assert.equal(Object.hasOwn(resultado.arquivo.dados.meals[0].alimentos[0],'marca_identificada'),false);assert.equal(resultado.restaurados,1);assert.equal(resultado.arquivo.dados.meals[0].total.calorias,100);
});
teste('legado incompleto é arquivado integralmente, sem entrar nos totais nem impedir backup',async()=>{
 const resultado=await pagina.evaluate(async()=>{
  const banco=await import('/js/db.js'),backup=await import('/js/backup.js');banco.definirContaLocal('arquivo-legado');await banco.listarTodasRefeicoes();
  const antigo={id:42,createdAt:new Date().toISOString(),alimentos:[{nome:'Refeição antiga',calorias:100}],total:{calorias:300},imageDataUrl:'data:image/png;base64,AAAA'};
  await new Promise((resolver,rejeitar)=>{const pedido=indexedDB.open('nutrifoto.conta.arquivo-legado');pedido.onsuccess=()=>{const db=pedido.result,transacao=db.transaction('meals','readwrite');transacao.objectStore('meals').put(antigo);transacao.oncomplete=()=>{db.close();resolver();};transacao.onerror=rejeitar;};pedido.onerror=rejeitar;});
  localStorage.setItem('nutrifoto.conta.arquivo-legado.currentPlan',JSON.stringify({tdee:2000,refeicoes:[{nome:'Plano antigo'}]}));
  const arquivo=await backup.exportarBackupIntegral();await backup.importarBackupIntegral(arquivo,{modo:'substituir'});const novamente=await backup.exportarBackupIntegral();return {arquivo,novamente};
 });
 assert.equal(resultado.arquivo.dados.meals.length,0);assert.equal(resultado.arquivo.dados.preferencias.registrosParaRevisao.length,2);assert.equal(resultado.arquivo.dados.preferencias.registrosParaRevisao[0].dados.imageDataUrl,'data:image/png;base64,AAAA');assert.deepEqual(resultado.novamente.dados,resultado.arquivo.dados);
});
teste('migração v1 preserva imagem, infere dia local e cria resumo sem imagem',async()=>{
 const resultado=await pagina.evaluate(async()=>{
  await new Promise((resolver,rejeitar)=>{const pedido=indexedDB.open('nutrifoto',1);pedido.onupgradeneeded=()=>pedido.result.createObjectStore('meals',{keyPath:'id',autoIncrement:true}).add({id:1,createdAt:'2026-10-22T01:30:00.000Z',alimentos:[{nome:'Arroz',porcao_estimada_g:100,calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0}],total:{calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0},imageDataUrl:'data:image/png;base64,AAAA'});pedido.onsuccess=()=>{pedido.result.close();resolver();};pedido.onerror=()=>rejeitar(pedido.error);});
  const banco=await import('/js/db.js');banco.definirContaLocal(null);return {registro:await banco.obterRefeicao(1),dia:await banco.listarRefeicoesDoDia('2026-10-21')};
 });
 assert.equal(resultado.registro.dia,'2026-10-21');assert.equal(resultado.registro.imageDataUrl,'data:image/png;base64,AAAA');assert.equal(resultado.dia.length,1);assert.equal(resultado.dia[0].imageDataUrl,undefined);
});
teste('operações idempotentes, edição central e exclusão consistentes',async()=>{
 const resultado=await pagina.evaluate(async()=>{
  const banco=await import('/js/db.js');banco.definirContaLocal('crud');const refeicao={alimentos:[{nome:'Arroz',porcao_estimada_g:100,calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0}],total:{calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0}};
  const [a,b]=await Promise.all([banco.salvarRefeicao(refeicao),banco.salvarRefeicao(refeicao)]);
  await banco.atualizarRefeicao(a.id,{...a,alimentos:[...a.alimentos,{nome:'Feijão',porcao_estimada_g:100,calorias:50,proteina_g:0,carboidrato_g:12.5,gordura_g:0}],total:{calorias:150,proteina_g:0,carboidrato_g:37.5,gordura_g:0}});
  const editada=await banco.obterRefeicao(a.id),totais=await banco.listarTotaisPorDia(1);await banco.deletarRefeicao(a.id);
  return {iguais:a.id===b.id,editada,totais,restantes:(await banco.listarTodasRefeicoes()).length};
 });
 assert.equal(resultado.iguais,true);assert.equal(resultado.editada.alimentos.length,2);assert.equal(resultado.totais[0].calorias,150);assert.equal(resultado.restantes,0);
});
teste('água concorrente, metas parciais e isolamento entre contas',async()=>{
 const resultado=await pagina.evaluate(async()=>{
  const banco=await import('/js/db.js'),preferencias=await import('/js/storage.js');banco.definirContaLocal('conta-a');preferencias.setGoals({waterGoal:3100});preferencias.setGoals({calories:2400});
  await Promise.all(Array.from({length:10},()=>banco.adicionarCopo(250)));await banco.salvarPeso(80);
  const agua=await banco.obterAguaHoje(),metas=preferencias.getGoals();banco.definirContaLocal('conta-b');const outra=await banco.obterAguaHoje(),pesos=await banco.listarPesos();banco.definirContaLocal('conta-a');return {agua,metas,outra,pesos,recuperado:await banco.obterAguaHoje()};
 });
 assert.equal(resultado.agua.ml_consumidos,2500);assert.equal(resultado.metas.waterGoal,3100);assert.equal(resultado.outra.ml_consumidos,0);assert.equal(resultado.pesos.length,0);assert.equal(resultado.recuperado.ml_consumidos,2500);
});
teste('backup integral, restauração idempotente e rejeição sem perda de dados',async()=>{
 const resultado=await pagina.evaluate(async()=>{
  const banco=await import('/js/db.js'),backup=await import('/js/backup.js'),preferencias=await import('/js/storage.js');banco.definirContaLocal('backup');
  localStorage.setItem('nutrifoto.apiKey','segredo-nao-exportar');localStorage.setItem(preferencias.obterChaveLocal('nutrifoto.theme'),'dark');
  await banco.salvarRefeicao({alimentos:[{nome:'<img src=x onerror=alert(1)>',porcao_estimada_g:100,calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0}],total:{calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0},imageDataUrl:'data:image/png;base64,AAAA'});await banco.salvarPeso(75);await banco.adicionarCopo(300);
  const arquivo=await backup.exportarBackupIntegral();await backup.importarBackupIntegral(arquivo,{modo:'substituir'});await backup.importarBackupIntegral(arquivo,{modo:'mesclar',conflito:'local'});
  const invalido=structuredClone(arquivo);invalido.dados.weights[0].peso_kg=-1;let rejeitado=false;try{await backup.importarBackupIntegral(invalido,{modo:'substituir'});}catch{rejeitado=true;}
  return {arquivo,restaurado:await backup.exportarBackupIntegral(),rejeitado,segredo:JSON.stringify(arquivo).includes('segredo-nao-exportar')};
 });
 assert.equal(resultado.rejeitado,true);assert.equal(resultado.segredo,false);assert.deepEqual(resultado.restaurado.dados,resultado.arquivo.dados);assert.equal(resultado.restaurado.dados.meals.length,1);
});
teste('histórico paginado não repete dias',async()=>{
 const resultado=await pagina.evaluate(async()=>{
  const banco=await import('/js/db.js');banco.definirContaLocal('paginacao');for(let dia=1;dia<=5;dia++)await banco.salvarRefeicao({createdAt:`2026-10-0${dia}T12:00:00.000Z`,alimentos:[{nome:'Arroz',porcao_estimada_g:100,calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0}],total:{calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0}});
  const primeira=await banco.listarHistorico({limiteDias:2}),segunda=await banco.listarHistorico({limiteDias:2,antesDe:primeira.at(-1).day});return [...primeira,...segunda].map(grupo=>grupo.day);
 });
 assert.deepEqual(resultado,['2026-10-05','2026-10-04','2026-10-03','2026-10-02']);
});
teste('sincroniza snapshot, preserva outbox após resposta perdida e resolve conflito explicitamente',async()=>{
 let remoto={revisao:0,dados:{}}, perderResposta=false;const operacoes=new Map();
 await pagina.route('**/api/conta',async rota=>rota.fulfill({json:{usuario:{id:await pagina.evaluate(async()=>(await import('/js/storage.js')).obterContaArmazenamento())},csrf:'teste'}}));
 await pagina.route('**/api/dados',async rota=>{
  const pedido=rota.request();
  if(pedido.method()==='GET'){await rota.fulfill({json:remoto});return;}
  const chave=pedido.headers()['x-idempotency-key'];
  if(operacoes.has(chave)){await rota.fulfill({json:operacoes.get(chave)});return;}
  const corpo=pedido.postDataJSON();
  if(corpo.revisao!==remoto.revisao){await rota.fulfill({status:409,json:{erro:'Conflito'}});return;}
  remoto={revisao:remoto.revisao+1,dados:corpo.dados};operacoes.set(chave,structuredClone(remoto));
  if(perderResposta){perderResposta=false;await rota.abort('connectionfailed');return;}
  await rota.fulfill({json:remoto});
 });
 const inicial=await pagina.evaluate(async()=>{const banco=await import('/js/db.js');banco.definirContaLocal('sync');await banco.salvarPeso(75);return(await import('/js/sincronizacao.js')).sincronizarDados();});
 assert.equal(inicial.enviados,true);assert.equal(remoto.dados.weights[0].peso_kg,75);
 perderResposta=true;
 const falha=await pagina.evaluate(async()=>{await(await import('/js/db.js')).salvarPeso(76);try{await(await import('/js/sincronizacao.js')).sincronizarDados();return false;}catch{return Boolean((await(await import('/js/sincronizacao.js')).obterEstadoSincronizacao()).pendente);}});
 assert.equal(falha,true);
 const recuperada=await pagina.evaluate(async()=>(await import('/js/sincronizacao.js')).sincronizarDados());
 assert.equal(recuperada.repeticaoRecuperada,true);assert.equal(remoto.revisao,2);
 remoto={revisao:3,dados:{...remoto.dados,weights:[{...remoto.dados.weights[0],peso_kg:77}]}};
 const conflito=await pagina.evaluate(async()=>{await(await import('/js/db.js')).salvarPeso(78);try{await(await import('/js/sincronizacao.js')).sincronizarDados();return null;}catch(erro){return erro.status;}});
 assert.equal(conflito,409);assert.equal(remoto.dados.weights[0].peso_kg,77);
 await pagina.evaluate(async()=>(await import('/js/sincronizacao.js')).sincronizarDados({resolverConflito:'local'}));
 assert.equal(remoto.dados.weights[0].peso_kg,78);assert.equal(remoto.revisao,4);
});
teste('migração legado exige consentimento e preserva original',async()=>{
 const resultado=await pagina.evaluate(async()=>{
  const banco=await import('/js/db.js'),sincronizacao=await import('/js/sincronizacao.js');banco.definirContaLocal('migracao');
  let rejeitou=false;try{await sincronizacao.migrarDadosLegados();}catch{rejeitou=true;}
  await sincronizacao.migrarDadosLegados({consentimento:true});const importadas=await banco.listarTodasRefeicoes();banco.definirContaLocal(null);const originais=await banco.listarTodasRefeicoes();banco.definirContaLocal('migracao');return {rejeitou,importadas,originais};
 });
 assert.equal(resultado.rejeitou,true);assert.equal(resultado.importadas.length,1);assert.equal(resultado.originais.length,1);assert.deepEqual(resultado.importadas,resultado.originais);
});
teste('exclusão limpa somente namespace atual e mantém legado e outras contas',async()=>{
 const resultado=await pagina.evaluate(async()=>{
  const banco=await import('/js/db.js'),preferencias=await import('/js/storage.js');banco.definirContaLocal('apagar-a');await banco.salvarPeso(70);preferencias.setGoals({waterGoal:2800});await banco.gravarEstadoRemoto({revisao:4,pendente:{dados:{teste:true}}});
  banco.definirContaLocal('apagar-b');await banco.salvarPeso(85);preferencias.setGoals({waterGoal:3500});banco.definirContaLocal('apagar-a');await banco.apagarDadosLocais();const vazios=await banco.listarPesos(),estado=await banco.lerEstadoRemoto(),metas=preferencias.getGoals();banco.definirContaLocal('apagar-b');const preservados=await banco.listarPesos(),outrasMetas=preferencias.getGoals();banco.definirContaLocal(null);return {vazios,estado,metas,preservados,outrasMetas,legado:await banco.listarTodasRefeicoes()};
 });
 assert.equal(resultado.vazios.length,0);assert.equal(resultado.estado.revisao,0);assert.equal(resultado.metas.waterGoal,2000);assert.equal(resultado.preservados[0].peso_kg,85);assert.equal(resultado.outrasMetas.waterGoal,3500);assert.equal(resultado.legado.length,1);
});
teste('outbox com CAS obsoleto permite resolução explícita posterior',async()=>{
 let remoto={revisao:0,dados:{}},provocar=false;
 await pagina.route('**/api/dados',async rota=>{
  if(rota.request().method()==='GET'){await rota.fulfill({json:remoto});return;}
  const corpo=rota.request().postDataJSON();if(provocar){provocar=false;remoto.revisao++;await rota.fulfill({status:409,json:{erro:'Conflito provocado'}});return;}
  if(corpo.revisao!==remoto.revisao){await rota.fulfill({status:409,json:{erro:'CAS obsoleto'}});return;}
  remoto={revisao:remoto.revisao+1,dados:corpo.dados};await rota.fulfill({json:remoto});
 });
 await pagina.evaluate(async()=>{const banco=await import('/js/db.js');banco.definirContaLocal('cas-pendente');await(await import('/js/servicoHttp.js')).consultarSessao();await banco.salvarPeso(70);await(await import('/js/sincronizacao.js')).sincronizarDados();});
 provocar=true;
 const falha=await pagina.evaluate(async()=>{await(await import('/js/db.js')).salvarPeso(71);try{await(await import('/js/sincronizacao.js')).sincronizarDados();}catch(erro){return erro.status;}});
 assert.equal(falha,409);
 const resolvido=await pagina.evaluate(async()=>{const modulo=await import('/js/sincronizacao.js');const resultado=await modulo.sincronizarDados({resolverConflito:'local'});return {resultado,pendente:(await modulo.obterEstadoSincronizacao()).pendente};});
 assert.equal(resolvido.resultado.enviados,true);assert.equal(resolvido.pendente,undefined);assert.equal(remoto.dados.weights[0].peso_kg,71);
});
teste('fotos são enviadas uma vez, snapshot leva referência e restauração carrega sob demanda',async()=>{
 let remoto={revisao:0,dados:{}},envios=0,leituras=0;const imagens=new Map();
 await pagina.route('**/api/imagens**',async rota=>{
  if(rota.request().method()==='POST'){envios++;const id='imagem-privada-teste.png';imagens.set(id,rota.request().postDataJSON().dataUrl);await rota.fulfill({json:{id}});return;}
  leituras++;const id=new URL(rota.request().url()).searchParams.get('id');await rota.fulfill({json:{id,dataUrl:imagens.get(id)}});
 });
 await pagina.route('**/api/dados',async rota=>{
  if(rota.request().method()==='GET'){await rota.fulfill({json:remoto});return;}
  const corpo=rota.request().postDataJSON();if(corpo.revisao!==remoto.revisao){await rota.fulfill({status:409,json:{erro:'Conflito'}});return;}
  remoto={revisao:remoto.revisao+1,dados:corpo.dados};await rota.fulfill({json:remoto});
 });
 const salvo=await pagina.evaluate(async()=>{
  const banco=await import('/js/db.js'),sincronizacao=await import('/js/sincronizacao.js');banco.definirContaLocal('imagens');await(await import('/js/servicoHttp.js')).consultarSessao();const refeicao=await banco.salvarRefeicao({alimentos:[{nome:'Arroz',porcao_estimada_g:100,calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0}],total:{calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0},imageDataUrl:'data:image/png;base64,AAAA'});await sincronizacao.sincronizarDados();await sincronizacao.sincronizarDados();return refeicao.id;
 });
 assert.equal(envios,1);assert.equal(remoto.dados.meals[0].imageDataUrl,undefined);assert.equal(remoto.dados.meals[0].imagemRemota,'imagem-privada-teste.png');
 await pagina.evaluate(async()=>{await(await import('/js/db.js')).apagarDadosLocais();await(await import('/js/sincronizacao.js')).sincronizarDados();});
 assert.equal(leituras,0);
 const imagem=await pagina.evaluate(async id=>(await(await import('/js/db.js')).obterRefeicao(id)).imageDataUrl,salvo);
 assert.equal(imagem,'data:image/png;base64,AAAA');assert.equal(leituras,1);
 await pagina.evaluate(async()=>{await(await import('/js/db.js')).apagarDadosLocais();await(await import('/js/sincronizacao.js')).sincronizarDados();});
 const backup=await pagina.evaluate(async()=>(await import('/js/backup.js')).exportarBackupIntegral());
 assert.equal(backup.dados.meals[0].imageDataUrl,'data:image/png;base64,AAAA');assert.equal(leituras,2);
});

teste('falha de preferências na restauração reverte banco e configurações',async()=>{
 const resultado=await pagina.evaluate(async()=>{
  const banco=await import('/js/db.js'),backup=await import('/js/backup.js'),preferencias=await import('/js/storage.js');banco.definirContaLocal('rollback');await banco.salvarPeso(72);preferencias.setGoals({waterGoal:3200});const antes=await backup.exportarBackupIntegral(),novo=structuredClone(antes);novo.dados.weights[0].peso_kg=99;novo.dados.metas.waterGoal=4000;
  const original=Storage.prototype.setItem;let provocar=true;Storage.prototype.setItem=function(chave,valor){if(provocar&&chave===preferencias.obterChaveLocal('nutrifoto.goals')){provocar=false;throw new DOMException('Quota simulada','QuotaExceededError');}return original.call(this,chave,valor);};
  let rejeitou=false;try{await backup.importarBackupIntegral(novo,{modo:'substituir'});}catch{rejeitou=true;}finally{Storage.prototype.setItem=original;}
  return {antes:antes.dados,depois:(await backup.exportarBackupIntegral()).dados,rejeitou};
 });
 assert.equal(resultado.rejeitou,true);assert.deepEqual(resultado.depois,resultado.antes);
});

teste('dois dispositivos A → B → A recebem a última revisão ao retornar à janela',async()=>{
 const contextos=await Promise.all([navegador.newContext(),navegador.newContext()]);
 let remoto={revisao:0,dados:{}};
 try{
  for(const contexto of contextos){
   await contexto.route('**/api/conta',rota=>rota.fulfill({json:{usuario:{id:'dois-dispositivos'},csrf:'teste'}}));
   await contexto.route('**/api/dados',async rota=>{
    if(rota.request().method()==='GET'){await rota.fulfill({json:remoto});return;}
    const corpo=rota.request().postDataJSON();
    if(corpo.revisao!==remoto.revisao){await rota.fulfill({status:409,json:{erro:'Conflito'}});return;}
    remoto={revisao:remoto.revisao+1,dados:corpo.dados};await rota.fulfill({json:remoto});
   });
  }
  const [a,b]=await Promise.all(contextos.map(contexto=>contexto.newPage()));
  for(const dispositivo of [a,b]){
   await dispositivo.goto(`http://127.0.0.1:${servidor.address().port}`);
   await dispositivo.evaluate(async()=>{(await import('/js/db.js')).definirContaLocal('dois-dispositivos');await import('/js/sincronizacao.js');});
  }
  await a.evaluate(async()=>{await(await import('/js/db.js')).salvarPeso(70);await(await import('/js/sincronizacao.js')).sincronizarDados();});
  await b.evaluate(async()=>{await(await import('/js/sincronizacao.js')).sincronizarDados();await(await import('/js/db.js')).salvarPeso(71);await(await import('/js/sincronizacao.js')).sincronizarDados();});
  const recebido=await a.evaluate(()=>new Promise((resolver,rejeitar)=>{
   const limite=setTimeout(()=>rejeitar(new Error('Sincronização ao retornar não ocorreu.')),5000);
   window.addEventListener('nutrifoto:sincronizacao',async evento=>{clearTimeout(limite);if(evento.detail.erro){rejeitar(new Error(evento.detail.erro));return;}resolver({estado:evento.detail.estado,pesos:await(await import('/js/db.js')).listarPesos()});},{once:true});
   window.dispatchEvent(new Event('focus'));
  }));
  assert.equal(recebido.estado.recebidos,true);assert.equal(recebido.pesos[0].peso_kg,71);assert.equal(remoto.revisao,2);
 }finally{for(const contexto of contextos)await contexto.close();}
});

teste('offline e upload interrompido preservam foto e dados; retomada não reenvia foto já registrada',async()=>{
 const contexto=await navegador.newContext();let semRede=true,interromper=true,envios=0,gravacoes=0,remoto={revisao:0,dados:{}};
 try{
  await contexto.route('**/api/conta',rota=>rota.fulfill({json:{usuario:{id:'upload-interrompido'},csrf:'teste'}}));
  await contexto.route('**/api/dados',async rota=>{
   if(semRede){await rota.abort('internetdisconnected');return;}
   if(rota.request().method()==='GET'){await rota.fulfill({json:remoto});return;}
   gravacoes++;remoto={revisao:remoto.revisao+1,dados:rota.request().postDataJSON().dados};await rota.fulfill({json:remoto});
  });
  await contexto.route('**/api/imagens',async rota=>{envios++;if(interromper){interromper=false;await rota.abort('connectionfailed');return;}await rota.fulfill({json:{id:'foto-restaurada.png'}});});
  const dispositivo=await contexto.newPage();await dispositivo.goto(`http://127.0.0.1:${servidor.address().port}`);
  const salvo=await dispositivo.evaluate(async()=>{const banco=await import('/js/db.js');banco.definirContaLocal('upload-interrompido');return banco.salvarRefeicao({alimentos:[{nome:'Arroz',porcao_estimada_g:100,calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0}],total:{calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0},imageDataUrl:'data:image/png;base64,AAAA'});});
  async function tentar(){return dispositivo.evaluate(async id=>{let falhou=false;try{await(await import('/js/sincronizacao.js')).sincronizarDados();}catch{falhou=true;}return{falhou,refeicao:await(await import('/js/db.js')).obterRefeicao(id)};},salvo.id);}
  const offline=await tentar();assert.equal(offline.falhou,true);assert.equal(offline.refeicao.imageDataUrl,'data:image/png;base64,AAAA');assert.equal(envios,0);
  semRede=false;const interrompido=await tentar();assert.equal(interrompido.falhou,true);assert.equal(interrompido.refeicao.imagemRemota,undefined);assert.equal(gravacoes,0);
  const retomado=await tentar();assert.equal(retomado.falhou,false);assert.equal(retomado.refeicao.imagemRemota,'foto-restaurada.png');await tentar();
  assert.equal(envios,2);assert.equal(gravacoes,1);assert.equal(remoto.dados.meals[0].imageDataUrl,undefined);
 }finally{await contexto.close();}
});

teste('IA: resposta perdida e recarga reutilizam a intenção persistida sem nova execução',async()=>{
 const contexto=await navegador.newContext();const operacoes=new Map(),chaves=[];let execucoes=0,perder=true;
 try{
  await contexto.route('**/api/conta',rota=>rota.fulfill({json:{usuario:{id:'ia-retomada'},csrf:'teste'}}));
  await contexto.route('**/api/ia',async rota=>{
   const chave=rota.request().headers()['x-idempotency-key'];chaves.push(chave);
   if(!operacoes.has(chave)){execucoes++;operacoes.set(chave,{ok:true});}
   if(perder){perder=false;await rota.abort('connectionfailed');return;}
   await rota.fulfill({json:operacoes.get(chave)});
  });
  const dispositivo=await contexto.newPage();await dispositivo.goto(`http://127.0.0.1:${servidor.address().port}`);
  async function analisar(){return dispositivo.evaluate(async()=>{sessionStorage.setItem('nutrifoto.cienciaIa','1');try{return await(await import('/js/servicoHttp.js')).requisitarApi('/api/ia',{method:'POST',body:JSON.stringify({tipo:'texto',texto:'texto privado de teste'})});}catch{return{falhou:true};}});}
  assert.equal((await analisar()).falhou,true);
  const pendencias=await dispositivo.evaluate(()=>Object.keys(localStorage).filter(chave=>chave.includes('.iaPendente.')).map(chave=>localStorage.getItem(chave)));
  assert.equal(pendencias.length,1);assert.equal(JSON.stringify(pendencias).includes('texto privado'),false);
  await dispositivo.reload();assert.equal((await analisar()).ok,true);
  assert.equal(chaves.length,2);assert.equal(chaves[0],chaves[1]);assert.equal(execucoes,1);
  assert.equal(await dispositivo.evaluate(()=>Object.keys(localStorage).filter(chave=>chave.includes('.iaPendente.')).length),0);
 }finally{await contexto.close();}
});

teste('IA: intenção antiga bloqueia reenvio e contas diferentes têm chaves próprias',async()=>{
 const resultado=await pagina.evaluate(async()=>{
  const modulo=await import('/js/chavesIa.js'),corpo=JSON.stringify({tipo:'texto',texto:'pedido fictício'});
  const a=await modulo.reservarChaveIa('chave-conta-a',corpo),b=await modulo.reservarChaveIa('chave-conta-b',corpo);
  const antiga=JSON.parse(localStorage.getItem(a.chaveArmazenamento));antiga.criadoEm=Date.now()-25*60*60*1000;localStorage.setItem(a.chaveArmazenamento,JSON.stringify(antiga));
  let bloqueou=false;try{await modulo.reservarChaveIa('chave-conta-a',corpo);}catch(erro){bloqueou=erro.message.includes('conciliação');}
  modulo.concluirChaveIa(b);return{bloqueou,distintas:a.chave!==b.chave,antigaPreservada:localStorage.getItem(a.chaveArmazenamento)!==null};
 });assert.equal(resultado.bloqueou,true);assert.equal(resultado.distintas,true);assert.equal(resultado.antigaPreservada,true);
});

teste('IA: HTTP 200 com JSON truncado preserva UUID após recarga',async()=>{
 const contexto=await navegador.newContext();const chaves=[];let truncar=true;
 try{
  await contexto.route('**/api/conta',rota=>rota.fulfill({json:{usuario:{id:'ia-json-truncado'},csrf:'teste'}}));
  await contexto.route('**/api/ia',async rota=>{chaves.push(rota.request().headers()['x-idempotency-key']);if(truncar){truncar=false;await rota.fulfill({status:200,contentType:'application/json',body:'{"alimentos":['});return;}await rota.fulfill({json:{ok:true}});});
  const dispositivo=await contexto.newPage();await dispositivo.goto(`http://127.0.0.1:${servidor.address().port}`);
  async function analisar(){return dispositivo.evaluate(async()=>{sessionStorage.setItem('nutrifoto.cienciaIa','1');try{return await(await import('/js/servicoHttp.js')).requisitarApi('/api/ia',{method:'POST',body:'{"tipo":"texto","texto":"pedido de teste"}'});}catch(erro){return{erro:erro.message};}});}
  assert.match((await analisar()).erro,/Resposta interrompida/);await dispositivo.reload();assert.equal((await analisar()).ok,true);assert.equal(chaves.length,2);assert.equal(chaves[0],chaves[1]);
 }finally{await contexto.close();}
});
