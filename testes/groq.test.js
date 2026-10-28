import teste from 'node:test';
import assert from 'node:assert/strict';
import { criarGroq, segundosEspera } from '../servidor/groq.js';
const ambiente=()=>({GROQ_API_KEY:'gsk_ficticia_nao_utilizar',GROQ_PLANO:'free',GROQ_FREE_CONFIRMADO_EM:new Date().toISOString()});
const pedido=(schema=false)=>({body:JSON.stringify({model:'openai/gpt-4o-mini',messages:[{role:'user',content:'alimento fictício'}],max_tokens:1500,response_format:schema?{type:'json_schema',json_schema:{strict:true}}:{type:'json_object'},provider:{},usage:{include:true}})});
const json=(dados,status=200,headers={})=>new Response(JSON.stringify(dados),{status,headers});
teste('Groq falha fechado sem chave, sem Free confirmado ou com confirmação expirada',async()=>{
 let chamadas=0;for(const a of [{},{...ambiente(),GROQ_PLANO:'developer'},{...ambiente(),GROQ_FREE_CONFIRMADO_EM:'2000-01-01'}])await assert.rejects(()=>criarGroq(a,{enviar:async()=>{chamadas++;}}).preparar());assert.equal(chamadas,0);
});
teste('Groq consulta modelos, traduz payload e nunca transmite chave OpenRouter',async()=>{
 const urls=[];const g=criarGroq(ambiente(),{enviar:async(url,opcoes)=>{urls.push(url);if(url.endsWith('/models'))return json({data:[{id:'qwen/qwen3.8-27b',active:true}]});const b=JSON.parse(opcoes.body);assert.equal(b.model,'qwen/qwen3.8-27b');assert.equal(b.provider,undefined);assert.equal(b.usage,undefined);assert.equal(b.reasoning_effort,'none');assert.equal(b.max_completion_tokens,1500);assert.equal(b.service_tier,'on_demand');assert.equal(opcoes.headers.Authorization,'Bearer gsk_ficticia_nao_utilizar');return json({choices:[{message:{content:'{}'},finish_reason:'stop'}],usage:{total_tokens:10}});}});
 const r=await g.transporte('https://openrouter.ai/irrelevante',pedido(true));assert.equal(r.dados.usage.cost,0);await g.preparar();assert.equal(urls.length,2);assert(urls.every(u=>u.startsWith('https://api.groq.com/openai/v1/')));
});
teste('Groq diferencia chave inválida, modelo indisponível e resposta incompleta',async()=>{
 for(const status of [401,403,404]){const g=criarGroq(ambiente(),{enviar:async()=>json({},status)});await assert.rejects(()=>g.preparar(),e=>e.status===(status===404?503:status));}
 await assert.rejects(()=>criarGroq(ambiente(),{enviar:async()=>json({data:[]})}).preparar(),e=>e.status===503);
 const g=criarGroq(ambiente(),{enviar:async url=>url.endsWith('/models')?json({data:[{id:'qwen/qwen3.8-27b'}]}):json({choices:[{message:{content:'{'},finish_reason:'length'}]})});await assert.rejects(()=>g.transporte('',pedido()),e=>e.status===502);
});
teste('Groq respeita Retry-After e não repete chamadas durante pausa',async()=>{
 let pausa=0,chamadas=0;const g=criarGroq(ambiente(),{lerPausa:()=>pausa,gravarPausa:p=>pausa=p,enviar:async url=>{chamadas++;return url.endsWith('/models')?json({data:[{id:'qwen/qwen3.8-27b'}]}):json({},429,{'retry-after':'40','x-ratelimit-limit-tokens':'8000'});}});
 await assert.rejects(()=>g.transporte('',pedido()),e=>e.status===429&&e.retryAfter===40);await assert.rejects(()=>g.transporte('',pedido()),e=>e.status===429);assert.equal(chamadas,2);assert.equal(segundosEspera('1m2.5s'),63);
});
teste('Groq trata falha de rede e JSON inválido sem expor credenciais',async()=>{
 await assert.rejects(()=>criarGroq(ambiente(),{enviar:async()=>{throw Error('segredo fictício');}}).preparar(),e=>e.status===503&&!e.message.includes('segredo'));
 await assert.rejects(()=>criarGroq(ambiente(),{enviar:async()=>new Response('invalido')}).preparar(),e=>e.status===502);
});

teste('Groq interpreta milissegundos e respeita o maior prazo do provedor',async()=>{
 assert.equal(segundosEspera('1ms'),1);assert.equal(segundosEspera('1m2.5s'),63);
 let pausa=0;const g=criarGroq(ambiente(),{gravarPausa:p=>pausa=p,enviar:async()=>json({},429,{'retry-after':'2','x-ratelimit-reset-tokens':'20s','x-ratelimit-remaining-requests':'0','x-ratelimit-reset-requests':'1h'})});
 await assert.rejects(()=>g.preparar(),e=>e.retryAfter===3600);assert(pausa>Date.now()+3599000);
});
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { criarDemonstracao } from '../servidor/demonstracao.js';

teste('Groq local: ledger independente, reserva única, cota e cache após reinício',async()=>{
 const pasta=mkdtempSync(join(tmpdir(),'nutrifoto-groq-teste-')),legado=join(pasta,'operacoes.sqlite');writeFileSync(legado,'histórico preservado');
 const a={...ambiente(),IA_PROVEDOR:'groq',GROQ_LIMITE_LOCAL_DIA:'1',NUTRIFOTO_PREMIUM_LOCAL:'true'};let atender,chamadas=0;
 const servidor=createServer((req,res)=>atender(req,res));await new Promise(r=>servidor.listen(0,'127.0.0.1',r));const origem='http://127.0.0.1:'+servidor.address().port;
 const enviarGroq=async url=>{if(url.endsWith('/models'))return json({data:[{id:'qwen/qwen3.8-27b'}]});chamadas++;return json({choices:[{message:{content:JSON.stringify({alimentos:[{nome:'Fictício',porcao_estimada_g:100,calorias:100,proteina_g:5,carboidrato_g:15,gordura_g:2}],total:{calorias:100,proteina_g:5,carboidrato_g:15,gordura_g:2}})},finish_reason:'stop'}],usage:{total_tokens:100}});};
 let atual;
 async function iniciar(){atender=criarDemonstracao({origem,ambiente:a,pasta,enviarGroq,transporte:()=>{throw Error('OpenRouter não autorizado');}});const r=await fetch(origem+'/api/conta');atual={cookie:r.headers.get('set-cookie').split(';')[0],dados:await r.json()};}
 const pedido={tipo:'texto',texto:'Alimento fictício de teste'},chave=crypto.randomUUID();
 const enviar=(texto=pedido.texto,id=chave,ciencia='1')=>fetch(origem+'/api/ia',{method:'POST',headers:{Origin:origem,Cookie:atual.cookie,'content-type':'application/json','x-csrf-token':atual.dados.csrf,'x-ciencia-ia':ciencia,'x-idempotency-key':id},body:JSON.stringify({...pedido,texto})});
 try{await iniciar();assert.equal((await enviar(undefined,undefined,'0')).status,403);assert.equal(chamadas,0);
 const respostas=await Promise.all([enviar(),enviar()]);assert(respostas.every(r=>r.status===200));assert.equal(chamadas,1);
 const r=await enviar();assert.equal((await r.json()).recuperadoLocal,true);assert.equal((await enviar('Outro alimento',crypto.randomUUID())).status,429);assert.equal(chamadas,1);
 await iniciar();assert.equal((await enviar()).status,200);assert.equal(chamadas,1);assert.equal(readFileSync(legado,'utf8'),'histórico preservado');
 }finally{await new Promise(r=>servidor.close(r));}
});
