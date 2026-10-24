import teste from 'node:test';
import assert from 'node:assert/strict';
import { criarAsaas } from '../servidor/asaas.js';
import { validarAtestadoAndroid } from '../servidor/atestado-android.js';
import { politicaLicencas, situacaoLicenca } from '../servidor/licenca-politica.js';
import { reservarChaveIa, concluirChaveIa } from '../www/js/chavesIa.js';
teste('ofertas pré-pagas mantêm valores, duração e franquias aprovados', () => {
  const planos = politicaLicencas();assert.deepEqual(planos.map(p => [p.centavos,p.dias,p.fotos]),[[2490,30,50],[3490,30,100]]);
  assert.throws(() => politicaLicencas({ LICENCA_TEXTOS_IA_DIA: '5000' }));
  assert.throws(() => politicaLicencas({ LICENCA_TEXTOS_IA_DIA: '100', LICENCA_TEXTOS_COMPLETO_DIA: '10' }));
});
teste('licença expirada ou revertida nunca informa benefício ativo', () => {
  const registro = { id:'ficticio', estado:{plano:'completo',validade:new Date(Date.now()+86400000).toISOString()} };
  assert(situacaoLicenca(registro).acompanhamento);assert(!situacaoLicenca({...registro,estado:{...registro.estado,bloqueada:true}}).ativa);
  assert(!situacaoLicenca(registro,{},Date.now()+2*86400000).ativa);
});
teste('adaptador Asaas aceita exclusivamente sandbox e mantém segredo no cabeçalho do servidor', async () => {
  assert.throws(() => criarAsaas({ASAAS_AMBIENTE:'production',ASAAS_API_KEY:'ficticia'}));
  assert.throws(() => criarAsaas({ASAAS_AMBIENTE:'sandbox',ASAAS_API_KEY:'$aact_prod_ficticia'}));
  const chamadas=[];const asaas=criarAsaas({ASAAS_AMBIENTE:'sandbox',ASAAS_API_KEY:'credencial-ficticia'},async(url,opcoes)=>{chamadas.push({url,opcoes});return{ok:true,dados:{id:'pay_teste'}};});
  await asaas.criar({billingType:'PIX',value:24.9});await asaas.qr('pay_teste');await asaas.consultar('pay_teste');
  assert(chamadas.every(c=>c.url.startsWith('https://api-sandbox.asaas.com/v3/')));assert.equal(chamadas[0].opcoes.headers.access_token,'credencial-ficticia');
  assert.equal(chamadas[1].url,'https://api-sandbox.asaas.com/v3/payments/pay_teste/pixQrCode');
});
teste('Android sem raízes confiáveis ou com atestado falso não pode se registrar', async () => {
  await assert.rejects(()=>validarAtestadoAndroid({certificados:[],publica:''},{}),erro=>erro.status===503);
  await assert.rejects(()=>validarAtestadoAndroid({certificados:['falso','falso'],publica:''},{ANDROID_ATTESTATION_ROOTS_PEM:'falso'}),erro=>erro.status===403);
});
teste('intenção Android usa persistência nativa antes do envio e conserva a chave em retry', async () => {
  const anterior=globalThis.window,pendentes=new Map();let falhar=false;
  globalThis.window={NutriFotoAndroid:{},NutriFotoKeystore:{intencao(resumo){if(falhar)return JSON.stringify({erro:'Gravação recusada'});if(!pendentes.has(resumo))pendentes.set(resumo,{chave:crypto.randomUUID(),criadoEm:Date.now()});return JSON.stringify(pendentes.get(resumo));},concluirIntencao(resumo,chave){if(pendentes.get(resumo)?.chave===chave)pendentes.delete(resumo);}}};
  try{const a=await reservarChaveIa('licenca-ficticia','conteudo'),b=await reservarChaveIa('licenca-ficticia','conteudo');assert.equal(a.chave,b.chave);assert.equal(pendentes.size,1);concluirChaveIa(a);assert.equal(pendentes.size,0);falhar=true;await assert.rejects(()=>reservarChaveIa('licenca-ficticia','conteudo'),/Gravação recusada/);}
  finally{if(anterior===undefined)delete globalThis.window;else globalThis.window=anterior;}
});
