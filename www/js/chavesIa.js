// Persiste apenas resumo e intenção: textos, fotos, respostas e tokens não são guardados aqui.
const DURACAO_SEGURA=24*60*60*1000;
export async function reservarChaveIa(usuario,corpo){
 if(!usuario)throw new Error('Entre na sua conta antes de analisar.');
 const resumo=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(corpo||'')))),valor=>valor.toString(16).padStart(2,'0')).join('');
 if(typeof window!=='undefined'&&window.NutriFotoAndroid&&typeof window.NutriFotoKeystore?.intencao==='function'){
  const identificador=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(usuario+':'+resumo))),valor=>valor.toString(16).padStart(2,'0')).join('');
  const intencao=JSON.parse(window.NutriFotoKeystore.intencao(identificador));
  if(intencao.erro)throw new Error(intencao.erro);
  if(!/^[a-f\d-]{36}$/i.test(intencao.chave)||!Number.isFinite(intencao.criadoEm)||Date.now()-intencao.criadoEm>DURACAO_SEGURA)throw new Error('Análise sem confirmação. Solicite a conciliação ao suporte antes de repetir.');
  return{chave:intencao.chave,nativa:identificador};
 }
 const chaveArmazenamento=`nutrifoto.conta.${encodeURIComponent(usuario)}.iaPendente.${resumo}`;
 function reservar(){
  const anterior=localStorage.getItem(chaveArmazenamento);let intencao;
  if(anterior){try{intencao=JSON.parse(anterior);}catch{throw new Error('Intenção de análise inválida. Procure o suporte antes de tentar novamente.');}}
  if(intencao){
   if(!/^[a-f0-9-]{36}$/i.test(intencao.chave)||!Number.isFinite(intencao.criadoEm))throw new Error('Intenção de análise inválida. Procure o suporte antes de tentar novamente.');
   if(Date.now()-intencao.criadoEm>DURACAO_SEGURA)throw new Error('Esta análise ficou sem confirmação há mais de 24 horas. Solicite a conciliação ao suporte antes de repetir o mesmo pedido.');
  }else{
   const prefixo=`nutrifoto.conta.${encodeURIComponent(usuario)}.iaPendente.`;
   if(Object.keys(localStorage).filter(chave=>chave.startsWith(prefixo)).length>=100)throw new Error('Há muitas análises sem confirmação. Solicite a conciliação ao suporte antes de continuar.');
   intencao={chave:crypto.randomUUID(),criadoEm:Date.now()};
   // Falha de armazenamento impede o envio: não há tentativa paga sem intenção persistida.
   localStorage.setItem(chaveArmazenamento,JSON.stringify(intencao));
  }
  return{chave:intencao.chave,chaveArmazenamento};
 }
 return typeof navigator!=='undefined'&&navigator.locks?.request?navigator.locks.request(chaveArmazenamento,reservar):reservar();
}
export function concluirChaveIa(intencao){
 if(!intencao)return;
 if(intencao.nativa){window.NutriFotoKeystore.concluirIntencao(intencao.nativa,intencao.chave);return;}
 const atual=localStorage.getItem(intencao.chaveArmazenamento);
 if(atual&&JSON.parse(atual).chave===intencao.chave)localStorage.removeItem(intencao.chaveArmazenamento);
}
