import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {criarManutencao} from '../servidor/manutencao.js';
test('retenção operacional requer autorização de servidor e não devolve segredos',async()=>{
 let chamadas=0;const segredo='valor-ficticio-exclusivo-teste-com-32-caracteres';
 const servidor=createServer(criarManutencao({ambiente:{CRON_SECRET:segredo},repositorio:{async executar(nome,parametros){assert.equal(nome,'nf_limpar_operacionais_comercial');assert.deepEqual(parametros,{p_resultados_dias:7,p_eventos_dias:90,p_limites_dias:1});chamadas++;}}}));
 await new Promise(resolver=>servidor.listen(0,'127.0.0.1',resolver));
 try{const url='http://127.0.0.1:'+servidor.address().port;assert.equal((await fetch(url)).status,401);const retorno=await fetch(url,{headers:{Authorization:'Bearer '+segredo}});assert.equal(retorno.status,200);assert.equal(chamadas,1);assert(!JSON.stringify(await retorno.json()).includes(segredo));}finally{await new Promise(resolver=>servidor.close(resolver));}
});

test('retenção configurável valida limites antes de excluir e mantém adaptador simulado compatível', async () => {
 const segredo='valor-ficticio-exclusivo-teste-com-32-caracteres';
 for(const [ambiente,esperado] of [
   [{RETENCAO_RESULTADOS_DIAS:'0'},503],
   [{RETENCAO_EVENTOS_DIAS:'3651'},503],
   [{RETENCAO_LIMITES_DIAS:'1.5'},503],
   [{RETENCAO_RESULTADOS_DIAS:'30',RETENCAO_EVENTOS_DIAS:'180',RETENCAO_LIMITES_DIAS:'2'},200],
   [{NUTRIFOTO_SIMULADO:'true'},200],
 ]) {
   const chamadas=[];
   const servidor=createServer(criarManutencao({ambiente:{CRON_SECRET:segredo,...ambiente},repositorio:{async executar(nome,parametros){chamadas.push({nome,parametros});}}}));
   await new Promise(resolver=>servidor.listen(0,'127.0.0.1',resolver));
   try {
     const resposta=await fetch('http://127.0.0.1:'+servidor.address().port,{headers:{Authorization:'Bearer '+segredo}});
     assert.equal(resposta.status,esperado);
     if(esperado===503)assert.equal(chamadas.length,0);
     else if(ambiente.NUTRIFOTO_SIMULADO)assert.equal(chamadas[0].nome,'nf_limpar_operacionais');
     else assert.deepEqual(chamadas[0].parametros,{p_resultados_dias:30,p_eventos_dias:180,p_limites_dias:2});
   } finally {await new Promise(resolver=>servidor.close(resolver));}
 }
});
