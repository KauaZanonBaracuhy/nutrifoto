import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function criarPlataforma(origem='',requisitar=async()=>({status:200,data:{ok:true},headers:{}})){
  const codigo=readFileSync(new URL('../scripts/runtime-android.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  const chamadas=[];
  const janela={fetch:async(url)=>({local:url}),dispatchEvent(){}};
  runInNewContext(codigo,{
    window:janela,location:{href:'https://localhost/',origin:'https://localhost'},
    Capacitor:{isNativePlatform:()=>true},CapacitorHttp:{request:async(opcoes)=>{chamadas.push(opcoes);return requisitar(opcoes);}},
    App:{addListener(){}},NUTRIFOTO_BACKEND_ORIGIN:origem,URL,Headers,Response,DOMException,Event,
  });
  return {janela,chamadas};
}
test('Android sem backend bloqueia APIs e mantém leitura dos assets locais',async()=>{
  const {janela,chamadas}=criarPlataforma();
  await assert.rejects(janela.fetch('/api/sessao'),/ainda não está configurada/);
  assert.equal((await janela.fetch('/telas/history.html')).local,'/telas/history.html');
  assert.equal(chamadas.length,0);
});
test('Android envia CSRF, conta esperada e idempotência ao BFF HTTPS e filtra cookies da resposta',async()=>{
  const {janela,chamadas}=criarPlataforma('https://backend.exemplo.test',async()=>({status:409,data:{erro:'Conta mudou'},headers:{'Set-Cookie':'privado','X-Correlacao':'teste'}}));
  const resposta=await janela.fetch('/api/ia?modo=texto',{method:'POST',headers:{'X-CSRF-Token':'csrf','X-Conta-Esperada':'conta-a','Idempotency-Key':'intencao'},body:JSON.stringify({texto:'banana'})});
  assert.equal(chamadas[0].url,'https://backend.exemplo.test/api/ia?modo=texto');
  assert.equal(chamadas[0].headers.Origin,'https://backend.exemplo.test');
  assert.equal(chamadas[0].headers['x-csrf-token'],'csrf');
  assert.equal(chamadas[0].headers['x-conta-esperada'],'conta-a');
  assert.equal(chamadas[0].headers['idempotency-key'],'intencao');
  assert.equal(chamadas[0].data.texto,'banana');
  assert.equal(chamadas[0].disableRedirects,true);
  assert.equal(resposta.status,409);assert.equal((await resposta.json()).erro,'Conta mudou');
  assert.equal(resposta.headers.has('set-cookie'),false);
});
test('Android respeita cancelamento anterior sem chamar o backend',async()=>{
  const {janela,chamadas}=criarPlataforma('https://backend.exemplo.test');
  const controle=new AbortController();controle.abort();
  await assert.rejects(janela.fetch('/api/ia',{signal:controle.signal}),{name:'AbortError'});
  assert.equal(chamadas.length,0);
});
test('Android libera a interface ao cancelar chamada pendente sem repetir intenção',async()=>{
  const {janela,chamadas}=criarPlataforma('https://backend.exemplo.test',()=>new Promise(()=>{}));
  const controle=new AbortController();const pedido=janela.fetch('/api/ia',{signal:controle.signal});controle.abort();
  await assert.rejects(pedido,{name:'AbortError'});assert.equal(chamadas.length,1);
});
