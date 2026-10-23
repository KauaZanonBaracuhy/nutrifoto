import { confirmarAcao } from './elementos.js';

export async function iniciarAtualizacoes(avisar) {
  if(!('serviceWorker' in navigator))return;
  try {
    const registro=await navigator.serviceWorker.register('/sw.js');
    const aviso=document.querySelector('#atualizacao-app'), botao=document.querySelector('#atualizar-app');
    function apresentar(){aviso.hidden=!registro.waiting;if(registro.waiting)avisar('Atualização disponível. Abra Configurações para atualizar.');}
    apresentar();
    registro.addEventListener('updatefound',()=>{const worker=registro.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')apresentar();});});
    botao.onclick=async()=>{
      if(!registro.waiting||!await confirmarAcao('Atualizar o aplicativo agora? Salve seus rascunhos e sincronize ou exporte os registros antes.'))return;
      botao.disabled=true;
      const worker=registro.waiting;
      worker.addEventListener('statechange',()=>{if(worker.state==='activated')location.reload();});
      worker.postMessage('ATUALIZAR');
    };
  } catch {avisar('O modo offline não está disponível neste navegador.',true);}
}
