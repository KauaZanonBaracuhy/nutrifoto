import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarPacoteDados } from '../servidor/repositorio.js';
const refeicao={id:1,dia:'2026-10-21',createdAt:'2026-10-21T12:00:00Z',alimentos:[{nome:'Arroz',porcao_estimada_g:100,calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0}],total:{calorias:100,proteina_g:0,carboidrato_g:25,gordura_g:0}};
test('servidor valida novamente nutrientes, totais, planos e perfil sem confiar no cliente',()=>{
  const valido={meals:[refeicao],weights:[],water:[]};assert.equal(validarPacoteDados(structuredClone(valido)).meals.length,1);
  const inconsistentes=structuredClone(valido);inconsistentes.meals[0].total.calorias=500;assert.throws(()=>validarPacoteDados(inconsistentes));
  const negativos=structuredClone(valido);negativos.meals[0].alimentos[0].porcao_estimada_g=-1;assert.throws(()=>validarPacoteDados(negativos));
  assert.throws(()=>validarPacoteDados({...valido,plano:{refeicoes:[{kcalEstimada:'<img onerror=teste>'}]}}));
  assert.throws(()=>validarPacoteDados({...valido,perfil:{idade:-20}}));
  const identificadorHtml=structuredClone(valido);identificadorHtml.meals[0].id='1"><img src=x onerror=teste>';assert.throws(()=>validarPacoteDados(identificadorHtml));
});
