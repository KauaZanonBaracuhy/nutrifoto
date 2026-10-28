import teste from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarDemonstracao } from '../servidor/demonstracao.js';
teste('demonstração local: CSRF, bloqueio clínico, reserva durável, cache e limite sem IA externa',async()=>{
 const pasta=mkdtempSync(join(tmpdir(),'nutrifoto-demo-teste-'));let atender,chamadas=0;
 const servidor=createServer((req,res)=>atender(req,res));await new Promise(r=>servidor.listen(0,'127.0.0.1',r));
 const origem='http://127.0.0.1:'+servidor.address().port,ambiente={OPENROUTER_API_KEY:'ficticia-nao-usar',NUTRIFOTO_IA_AUTORIZADA:'2026-10-28-2-USD0.01'};
 const transporte=async(url,opcoes)=>{chamadas++;const corpo=JSON.parse(opcoes.body);assert.equal(corpo.provider.max_price.prompt,0.15);assert.equal(corpo.max_tokens,1500);assert.match(corpo.messages[1].content,/Analise a descrição textual/);return {ok:true,dados:{choices:[{message:{content:JSON.stringify({alimentos:[{nome:'Fictício',porcao_estimada_g:100,calorias:100,proteina_g:5,carboidrato_g:15,gordura_g:2}],total:{calorias:100,proteina_g:5,carboidrato_g:15,gordura_g:2}})}}],usage:{cost:0.0001,total_tokens:100}}};};
 try{
  assert.throws(()=>criarDemonstracao({origem:'https://publico.test',ambiente,pasta}));
  atender=criarDemonstracao({origem,ambiente,pasta,transporte});
  async function sessao(){const r=await fetch(origem+'/api/conta');return {cookie:r.headers.get('set-cookie').split(';')[0],dados:await r.json()};}
  let atual=await sessao();assert.equal(atual.dados.usuario,null);assert.equal(atual.dados.iaLocal,true);
  async function enviar(pedido,chave=crypto.randomUUID(),extra={}){return fetch(origem+'/api/ia',{method:'POST',headers:{Origin:origem,Cookie:atual.cookie,'content-type':'application/json','x-csrf-token':atual.dados.csrf,'x-ciencia-ia':'1','x-idempotency-key':chave,...extra},body:JSON.stringify(pedido)});}
  assert.equal((await enviar({tipo:'texto',texto:'teste'},undefined,{'x-csrf-token':'errado'})).status,403);
  assert.equal((await enviar({tipo:'plano'})).status,403);
  const pedido={tipo:'texto',texto:'Primeiro fictício'},chave=crypto.randomUUID();assert.equal((await enviar(pedido,chave)).status,200);assert.equal((await enviar(pedido,chave)).status,200);assert.equal(chamadas,1);
  assert.equal((await enviar({...pedido,texto:'alterado'},chave)).status,409);
  assert.equal((await enviar(pedido)).status,200);assert.equal(chamadas,1);
  assert.equal((await enviar({tipo:'texto',texto:'Segundo fictício'})).status,200);
  assert.equal((await enviar({tipo:'texto',texto:'Terceiro fictício'})).status,429);assert.equal(chamadas,2);
  atender=criarDemonstracao({origem,ambiente,pasta,transporte});atual=await sessao();assert.equal((await enviar(pedido,chave)).status,200);assert.equal(chamadas,2);
 }finally{await new Promise(r=>servidor.close(r));}
});

import { prepararPremium } from '../servidor/premium-local.js';
import { criarApiWorker } from '../cloudflare/adaptador.js';
teste('Premium local: elegibilidade, dados registrados e impossibilidade de concessão no Worker',async()=>{
 const perfil={idade:30,sexo:'masculino',pesoAtual:75,altura:175,nivelAtividade:'leve',objetivo:'manter_peso',refeicoesPorDia:3,restricoes:[]};
 assert.equal(prepararPremium({tipo:'plano',perfil}).perfil.idade,30);
 for(const p of [{...perfil,gestante:true},{...perfil,condicoesSaude:'Diabetes'},{...perfil,idade:17},{...perfil,restricoes:['sem_gluten']}])assert.throws(()=>prepararPremium({tipo:'plano',perfil:p}));
 assert.throws(()=>prepararPremium({tipo:'resumo',perfil,registros:[]}));
 const resposta=await criarApiWorker({NUTRIFOTO_PREMIUM_LOCAL:'true'})(new Request('https://nutrifoto.test/api/licenca'));const corpo=await resposta.json();assert.equal(corpo.licencaLocal,undefined);assert.equal(corpo.premiumLocal,undefined);
});
