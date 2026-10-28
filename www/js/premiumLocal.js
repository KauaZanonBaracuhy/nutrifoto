import { obterSessaoAtual } from './servicoHttp.js';
import { requisitarIa } from './visionApi.js';
import { getUserProfile } from './dietPlan.js';
import { validarPerfil } from './nutricao.js';
import { listarTotaisPorDia } from './db.js';
import { setGoals, getChaveLocal } from './storage.js';
import { confirmarAcao } from './elementos.js';
import { avisar } from './base.js';

export function iniciarPremiumLocal() {
  if (!obterSessaoAtual()?.premiumLocal) return;
  const nome='Plano Premium';
  const etiqueta=document.createElement('p');etiqueta.className='api-key-help';etiqueta.id='premium-local-estado';etiqueta.textContent=nome;
  document.querySelector('#dashboard-main').prepend(etiqueta);
  document.querySelector('#screen-capture .api-key-help').textContent='A foto e o peso são estimativas. Revise os resultados. A busca TACO funciona neste dispositivo. Autorize o envio à IA antes de analisar.';
  const painel=document.createElement('details');painel.className='diet-section';painel.id='premium-local-modulos';
  painel.innerHTML='<summary>Metas e resumo com IA</summary><p class="api-key-help">Sugestões gerais para adultos elegíveis. Revise antes de confirmar.</p><button type="button" class="btn-secondary" id="premium-metas">Sugerir metas com IA</button><form id="premium-revisao" hidden><p id="premium-explicacao"></p><div id="premium-campos"></div><button class="btn-primary" type="submit">Confirmar metas revisadas</button></form><button type="button" class="btn-secondary" id="premium-resumo">Analisar meus registros</button><p id="premium-feedback" role="status" aria-live="polite"></p><p id="premium-resumo-texto"></p>';
  document.querySelector('#screen-settings .main').prepend(painel);
  const campos=[['calories','Calorias (kcal)',1000,4000],['protein','Proteína (g)',20,250],['carb','Carboidratos (g)',50,600],['fat','Gorduras (g)',20,150],['waterGoal','Água (ml)',1000,4000]];
  for(const [id,label,min,max]of campos){const linha=document.createElement('div');linha.className='diet-field';const rotulo=document.createElement('label');rotulo.htmlFor='premium-'+id;rotulo.textContent=label;const input=document.createElement('input');Object.assign(input,{id:'premium-'+id,type:'number',min:String(min),max:String(max),step:'0.1',required:true});linha.append(rotulo,input);painel.querySelector('#premium-campos').append(linha);}
  const perfilElegivel=()=>{const perfil=validarPerfil(getUserProfile());if(perfil.restricoes.length||perfil.restricoesTexto?.trim())throw Error('Este perfil exige revisão profissional dos ingredientes.');return perfil;};
  let ocupado=false;
  const executar=async(acao)=>{if(ocupado)return;ocupado=true;const feedback=painel.querySelector('#premium-feedback');feedback.textContent='Consultando IA…';try{await acao();}catch(e){feedback.textContent=e.message;avisar(e.message,true);}finally{ocupado=false;}};
  function mostrarMetas(dados){for(const [id]of campos)painel.querySelector('#premium-'+id).value=dados[id];painel.querySelector('#premium-explicacao').textContent=dados.explicacao;painel.querySelector('#premium-revisao').hidden=false;}
  painel.querySelector('#premium-metas').onclick=()=>executar(async()=>{const r=await requisitarIa({tipo:'metas',perfil:perfilElegivel()},{prazoMs:55000});mostrarMetas(r);localStorage.setItem(getChaveLocal('nutrifoto.premiumMetas'),JSON.stringify(r));painel.querySelector('#premium-feedback').textContent=r.recuperadoLocal?'Sugestão real anterior recuperada sem nova chamada.':'Sugestão pronta para revisão. Nenhuma meta foi alterada.';});
  painel.querySelector('#premium-revisao').onsubmit=evento=>{evento.preventDefault();executar(async()=>{perfilElegivel();const metas={};for(const [id,,min,max]of campos){const v=Number(painel.querySelector('#premium-'+id).value);if(!Number.isFinite(v)||v<min||v>max)throw Error('Revise as metas informadas.');metas[id]=v;}if(!await confirmarAcao('Aplicar as metas gerais revisadas? Você pode editá-las depois em Configurações.')){painel.querySelector('#premium-feedback').textContent='Alteração cancelada. Metas anteriores preservadas.';return;}setGoals(metas);document.dispatchEvent(new Event('nutrifoto:atualizar'));painel.querySelector('#premium-feedback').textContent='Metas revisadas salvas neste dispositivo.';avisar('Metas revisadas salvas');});};
  painel.querySelector('#premium-resumo').onclick=()=>executar(async()=>{const registros=(await listarTotaisPorDia(7)).filter(r=>r.calorias>0);if(!registros.length)throw Error('Registre refeições antes de solicitar o resumo.');const r=await requisitarIa({tipo:'resumo',perfil:perfilElegivel(),registros},{prazoMs:55000});const texto=r.resumo+' '+r.observacoes.join(' ');painel.querySelector('#premium-resumo-texto').textContent=texto;localStorage.setItem(getChaveLocal('nutrifoto.premiumResumo'),JSON.stringify({texto,registros}));painel.querySelector('#premium-feedback').textContent=(r.recuperadoLocal?'Resumo real anterior recuperado sem nova chamada. ':'')+'Resumo dos registros enviados. Refaça a análise se seus registros mudarem.';});
  try{const metas=JSON.parse(localStorage.getItem(getChaveLocal('nutrifoto.premiumMetas')));if(metas)mostrarMetas(metas);const resumo=JSON.parse(localStorage.getItem(getChaveLocal('nutrifoto.premiumResumo')));if(resumo)painel.querySelector('#premium-resumo-texto').textContent='Resumo anterior dos registros: '+resumo.texto;}catch{painel.querySelector('#premium-feedback').textContent='Não foi possível recuperar a sugestão anterior. Seus registros alimentares estão preservados.';}
}
