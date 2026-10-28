import teste from 'node:test';
import assert from 'node:assert/strict';
import { gerarHashProprietario, validarCodigoProprietario } from '../servidor/proprietario.js';
import { politicaLicencas, situacaoLicenca } from '../servidor/licenca-politica.js';
teste('código do proprietário: hash salgado, configuração fechada e validade limitada',async()=>{
  const codigo='ficticio-'+crypto.randomUUID(),hash=await gerarHashProprietario(codigo);
  assert(!hash.includes(codigo));assert.notEqual(hash,await gerarHashProprietario(codigo));
  const ambiente={PROPRIETARIO_CODIGO_HASH:hash,PROPRIETARIO_LICENCA_DIAS:'30'};
  assert.equal(await validarCodigoProprietario(codigo,ambiente),30);
  await assert.rejects(()=>validarCodigoProprietario('incorreto-ficticio',ambiente),e=>e.status===403&&!e.message.includes(codigo));
  for(const config of [{},{...ambiente,PROPRIETARIO_CODIGO_HASH:'invalido'},{...ambiente,PROPRIETARIO_LICENCA_DIAS:'0'},{...ambiente,PROPRIETARIO_LICENCA_DIAS:'366'}])await assert.rejects(()=>validarCodigoProprietario(codigo,config),e=>e.status===503);
});
teste('planos preservam preços/franquias e não prometem geração não homologada',()=>{
  const planos=politicaLicencas();assert.deepEqual(planos.map(p=>[p.nome,p.centavos,p.fotos,p.textos,p.meuPlano,p.geracaoPlanoDisponivel]),[
    ['Análise alimentar com IA',2490,50,20,false,false],['Análise alimentar com IA + Meu Plano alimentar',3490,100,50,true,false]
  ]);
  const estado={origem:'proprietario',plano:'completo',validade:new Date(Date.now()+86400000).toISOString()};
  assert.equal(situacaoLicenca({id:'ficticio',estado}).origem,'proprietario');
  assert(!situacaoLicenca({id:'ficticio',estado:{...estado,bloqueada:true}}).ativa);
});
