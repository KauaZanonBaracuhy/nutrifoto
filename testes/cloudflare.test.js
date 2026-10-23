import teste from 'node:test';
import assert from 'node:assert/strict';
import { adaptarRequisicao, criarApiWorker } from '../cloudflare/adaptador.js';
import worker from '../cloudflare/worker.js';
import { lerCorpo, definirCookie } from '../servidor/seguranca.js';

teste('Worker preserva corpo bruto, IP confiável, status e cookies separados',async()=>{
  const corpo='{"mensagem":"alimentação"}';
  const resposta=await adaptarRequisicao(new Request('https://exemplo.test/api/webhook?teste=1',{method:'POST',body:corpo,headers:{'cf-connecting-ip':'192.0.2.9','content-type':'application/json'}}),async(entrada,saida)=>{
    assert.equal(entrada.url,'/api/webhook?teste=1');assert.equal(entrada.socket.remoteAddress,'192.0.2.9');assert.equal(await lerCorpo(entrada,1000,true),corpo);
    definirCookie(saida,'nf_acesso','ficticio',{simulado:false});definirCookie(saida,'nf_csrf','outro',{simulado:false});saida.statusCode=202;saida.end('recebido');
  });
  assert.equal(resposta.status,202);assert.equal(await resposta.text(),'recebido');assert.equal(resposta.headers.getSetCookie().length,2);assert(resposta.headers.getSetCookie().every(valor=>valor.includes('Secure')&&valor.includes('HttpOnly')));
});
teste('Worker mantém limite de corpo e não transforma falha em sucesso',async()=>{
  await assert.rejects(adaptarRequisicao(new Request('https://exemplo.test/api/teste',{method:'POST',body:'123456'}),async(entrada)=>lerCorpo(entrada,3)),erro=>erro.status===413);
});
teste('Worker recusa modo simulado e recursos pagos sem configuração',async()=>{
  const atender=criarApiWorker({APP_ORIGIN:'https://exemplo.test',NUTRIFOTO_SIMULADO:'true'});
  const resposta=await atender(new Request('https://exemplo.test/api/conta'));assert.equal(resposta.status,503);assert.match((await resposta.json()).erro,/não configurado/);
});
teste('Worker separa APIs de assets e aplica cabeçalhos de segurança',async()=>{
  const ambiente={ASSETS:{fetch:async()=>new Response('<html>teste</html>',{headers:{'content-type':'text/html'}})}};
  const resposta=await worker.fetch(new Request('https://exemplo.test/'),ambiente);assert.equal(resposta.status,200);assert.match(resposta.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);assert.equal(resposta.headers.get('Cache-Control'),'no-cache');
  assert.equal((await worker.fetch(new Request('https://exemplo.test/api/inexistente'),ambiente)).status,404);
  assert.equal((await worker.fetch(new Request('https://exemplo.test/api/asaas-webhook'),ambiente)).status,405);
  assert.equal((await worker.fetch(new Request('https://exemplo.test/api/versao',{method:'POST'}),ambiente)).status,405);
  assert.equal((await worker.fetch(new Request('https://exemplo.test/api/versao',{method:'HEAD'}),ambiente)).body,null);
});
