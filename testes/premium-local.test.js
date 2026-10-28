import teste from 'node:test';
import assert from 'node:assert/strict';
import { executarPremium } from '../servidor/premium-local.js';
import { getAlternatives } from '../www/js/foodAlternatives.js';
teste('categorias retornadas pela IA conservam alternativas e filtros clínicos',()=>{
 assert.deepEqual(getAlternatives('cereal'),getAlternatives('carboidrato'));
 assert.deepEqual(getAlternatives('proteína'),getAlternatives('proteina'));
 assert.deepEqual(getAlternatives('laticínio'),getAlternatives('laticinio'));
 assert.deepEqual(getAlternatives('cereal',{restricoes:['sem_gluten']}),[]);
});
teste('metas/resumo exigem schema estrito, unidades válidas e não aceitam formatos ambíguos', async()=>{
 const perfil={idade:30};let tipo='metas',resposta={calories:2200,protein:110,carb:305,fat:60,waterGoal:2500,explicacao:'Sugestão educativa.'};
 const transporte=async(url,opcoes)=>{const corpo=JSON.parse(opcoes.body);assert.equal(corpo.max_tokens,tipo==='metas'?700:1200);assert.equal(corpo.response_format.type,'json_schema');assert.equal(corpo.response_format.json_schema.strict,true);assert.equal(corpo.response_format.json_schema.schema.additionalProperties,false);return{ok:true,dados:{choices:[{message:{content:JSON.stringify(resposta)}}],usage:{cost:0.0001,total_tokens:100}}};};
 const config={ambiente:{OPENROUTER_API_KEY:'ficticia'}};
 assert.equal((await executarPremium({tipo,perfil},config,transporte)).waterGoal,2500);
 resposta={...resposta,waterGoal:2.5};await assert.rejects(()=>executarPremium({tipo,perfil},config,transporte),e=>e.status===502);
 tipo='resumo';resposta={resumo:'Há um dia registrado.',observacoes:['Sem dados suficientes para tendência.']};assert.match((await executarPremium({tipo,perfil,registros:[]},config,transporte)).resumo,/um dia/);
 resposta={resumo:'Texto',observacoes:[{texto:'formato incorreto'}]};await assert.rejects(()=>executarPremium({tipo,perfil,registros:[]},config,transporte),e=>e.status===502);
});

