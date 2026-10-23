import { consultarSessao, requisitarApi, obterSessaoAtual } from './servicoHttp.js';
import { definirContaLocal, apagarDadosLocais } from './db.js';
import { sincronizarDados, migrarDadosLegados } from './sincronizacao.js';
import { exportarBackupIntegral } from './backup.js';
import { confirmarAcao } from './elementos.js';
import { getChaveLocal } from './storage.js';
import { lembrarContaVerificada,restaurarContaOffline,obterContaOffline,esquecerContinuidadeConta } from './continuidadeConta.js';
let navegar, avisar, operacaoAtual=false;
let tokenRecuperacao='';
let tokenConfirmacao='';
function recolherTokenRecuperacao(){
  const endereco=new URL(location.href);
  const confirmacao=new URLSearchParams(endereco.hash.slice(1)).get('confirmacao');
  const token=new URLSearchParams(endereco.hash.slice(1)).get('recuperacao')||endereco.searchParams.get('token_hash');
  if(!token&&!confirmacao)return;
  tokenRecuperacao=token||'';tokenConfirmacao=confirmacao||'';endereco.searchParams.delete('token_hash');endereco.hash='';history.replaceState({},'',endereco.pathname+endereco.search);
  navegar?.('conta');
}
recolherTokenRecuperacao();
window.addEventListener('hashchange',recolherTokenRecuperacao);
export async function iniciarConta() {
  if (window.NutriFotoAndroid) { await definirContaLocal(restaurarContaOffline());return; }
  try { const sessao=await consultarSessao();lembrarContaVerificada(sessao.usuario?.id||null);await definirContaLocal(sessao.usuario?.id||null); }
  catch(erro) {if(erro.status===401||erro.status===403){esquecerContinuidadeConta();await definirContaLocal(null);}else await definirContaLocal(restaurarContaOffline());}
}
export async function atualizarConta() {
  try{const preferencias=JSON.parse(localStorage.getItem(getChaveLocal('nutrifoto.preferences'))||'{}');const quantidade=preferencias.registrosParaRevisao?.length||0;document.querySelector('#privacidade-legado').textContent=quantidade?quantidade+' registros antigos foram preservados no backup como arquivo de revisão. Eles não são aplicados a metas ou totais. Consulte o backup para revisão manual.':'';}catch{}
  document.querySelector('#privacidade-ia').checked=sessionStorage.getItem('nutrifoto.cienciaIa')==='1';
  const sessao=obterSessaoAtual(); const usuario=sessao?.usuario;
  document.querySelector('#estado-conta').textContent=obterContaOffline()?'Sem conexão com a conta. Seus registros continuam disponíveis neste dispositivo; sincronização, IA e pagamentos exigem validar a sessão ao reconectar.':usuario?'Conectado como '+usuario.email:'Você está usando o espaço local. Entre para sincronizar e usar IA.';
  document.querySelector('#formulario-conta').hidden=Boolean(usuario)&&!tokenConfirmacao&&!tokenRecuperacao;
  document.querySelector('#conta-conectada').hidden=!usuario;
  document.querySelector('#aviso-simulacao').hidden=!sessao?.simulado;
  document.querySelector('#conta-confirmar').hidden=!tokenConfirmacao;
  document.querySelector('#conta-redefinir').hidden=!tokenRecuperacao;
  document.querySelector('#conta-link-status').textContent=tokenConfirmacao?'Confirme seu e-mail para concluir o cadastro.':tokenRecuperacao?'Link de recuperação recebido. Digite sua nova senha e selecione Salvar nova senha.':'';
  document.querySelector('#conta-senha').autocomplete=tokenRecuperacao?'new-password':'current-password';
  if(usuario){try{const assinatura=await requisitarApi('/api/assinatura');document.querySelector('#estado-assinatura').textContent='Plano: '+assinatura.plano+' · '+assinatura.status+' · consumo '+(assinatura.consumo??0)+' / '+(assinatura.limite??0);}catch{document.querySelector('#estado-assinatura').textContent='Assinatura indisponível. Tente novamente.';}}
}
async function executarConta(acao) {
  if(operacaoAtual)return;
  const formulario=document.querySelector('#formulario-conta'), email=document.querySelector('#conta-email'), senha=document.querySelector('#conta-senha'), erro=document.querySelector('#conta-erro');
  erro.textContent='';
  email.removeAttribute('aria-invalid');senha.removeAttribute('aria-invalid');
  if(['entrar','cadastrar','recuperar'].includes(acao)&&!email.validity.valid){email.setAttribute('aria-invalid','true');erro.textContent='Informe um e-mail válido.';email.focus();return;}
  if(['entrar','cadastrar','redefinir'].includes(acao)&&senha.value.length<12){senha.setAttribute('aria-invalid','true');erro.textContent='Use uma senha de pelo menos 12 caracteres.';senha.focus();return;}
  operacaoAtual=true;formulario.setAttribute('aria-busy','true');formulario.querySelectorAll('button').forEach(botao=>botao.disabled=true);
  try {
    const parametros=new URL(location.href).searchParams;
    const resposta=await requisitarApi('/api/conta',{method:'POST',body:JSON.stringify({acao,email:email.value,senha:senha.value,token_hash:(acao==='confirmar'?tokenConfirmacao:tokenRecuperacao)||undefined})});
    if(acao==='redefinir')esquecerContinuidadeConta();
    if(acao==='confirmar')tokenConfirmacao='';
    senha.value='';await iniciarConta();await atualizarConta();
    if(acao==='redefinir')tokenRecuperacao='';
    if(['entrar','cadastrar','confirmar'].includes(acao)&&obterSessaoAtual()?.usuario){await sincronizarComFeedback();navegar('dashboard');}
    else avisar(resposta.simulado?'Ambiente simulado: nenhuma mensagem enviada. Confira a caixa de recuperação nos testes locais.':'Se o endereço estiver cadastrado, confira as instruções de acesso.');
    if(parametros.has('token_hash')){parametros.delete('token_hash');history.replaceState({},'',location.pathname+'?'+parametros);}
  }catch(falha){erro.textContent=falha.message;}
  finally{operacaoAtual=false;formulario.removeAttribute('aria-busy');formulario.querySelectorAll('button').forEach(botao=>botao.disabled=false);}
}
async function sincronizarComFeedback(resolverConflito) {
  const estado=document.querySelector('#estado-sincronizacao');estado.textContent='Sincronizando…';
  try{await sincronizarDados({resolverConflito});estado.textContent='Dados sincronizados';document.querySelector('#conflito-sincronizacao').hidden=true;}
  catch(erro){estado.textContent=erro.message;document.querySelector('#conflito-sincronizacao').hidden=erro.status!==409;throw erro;}
}
export function vincularConta(mudarTela,mostrarAviso) {
  navegar=mudarTela;avisar=mostrarAviso;
  window.addEventListener('nutrifoto:sessao-expirada',async()=>{esquecerContinuidadeConta();await definirContaLocal(null);sessionStorage.removeItem('nutrifoto.cienciaIa');await atualizarConta();navegar('conta');avisar('Sua sessão terminou ou a conta mudou em outra aba. Entre novamente para acessar os dados da conta.',true);});
  window.addEventListener('nutrifoto:conta-revalidada',()=>atualizarConta());
  if(obterContaOffline())avisar('Modo offline: registros deste dispositivo disponíveis. Reconecte para validar a conta e sincronizar.');
  document.querySelector('#formulario-conta').onsubmit=evento=>{evento.preventDefault();executarConta('entrar');};
  for(const acao of ['cadastrar','recuperar','redefinir','confirmar'])document.querySelector('#conta-'+acao).onclick=()=>executarConta(acao);
  document.querySelector('#conta-mostrar-senha').onclick=evento=>{const entrada=document.querySelector('#conta-senha');const mostrar=entrada.type==='password';entrada.type=mostrar?'text':'password';evento.target.textContent=mostrar?'Ocultar senha':'Mostrar senha';evento.target.setAttribute('aria-pressed',String(mostrar));};
  document.querySelector('#conta-sair').onclick=async()=>{await requisitarApi('/api/conta',{method:'POST',body:JSON.stringify({acao:'sair'})});esquecerContinuidadeConta();sessionStorage.removeItem('nutrifoto.cienciaIa');await iniciarConta();await atualizarConta();navegar('dashboard');};
  document.querySelector('#conta-sincronizar').onclick=()=>sincronizarComFeedback().then(()=>navegar('dashboard')).catch(erro=>avisar(erro.message,true));
  document.querySelectorAll('[data-conflito]').forEach(botao=>botao.onclick=async()=>{if(await confirmarAcao('Confirmar resolução do conflito? Faça um backup antes de substituir dados.'))await sincronizarComFeedback(botao.dataset.conflito);});
  document.querySelector('#conta-migrar').onclick=async()=>{if(!await confirmarAcao('Copiar os registros locais anteriores para esta conta, mantendo o original?'))return;await migrarDadosLegados({consentimento:true});await sincronizarComFeedback();navegar('dashboard');};
  document.querySelector('#privacidade-ia').onchange=evento=>{sessionStorage.setItem('nutrifoto.cienciaIa',evento.target.checked?'1':'0');};
  document.querySelector('#privacidade-exportar').onclick=async()=>{const dados=await exportarBackupIntegral();const arquivo=new Blob([JSON.stringify(dados)],{type:'application/json'});if(window.NutriFotoAndroid){await window.NutriFotoAndroid.exportarArquivo(arquivo,'nutrifoto-backup.json');return;}const url=URL.createObjectURL(arquivo);const link=document.createElement('a');link.href=url;link.download='nutrifoto-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  document.querySelector('#privacidade-apagar-local').onclick=async()=>{if(await confirmarAcao('Apagar dados locais desta conta? Exporte um backup antes.')){await apagarDadosLocais();avisar('Dados locais apagados. Dados remotos não foram alterados.');navegar('dashboard');}};
  document.querySelector('#privacidade-excluir').onclick=async()=>{if(!await confirmarAcao('Excluir definitivamente sua conta e os dados remotos controlados pelo aplicativo?'))return;await requisitarApi('/api/conta',{method:'POST',body:JSON.stringify({acao:'excluir',confirmacao:'EXCLUIR'})});esquecerContinuidadeConta();await apagarDadosLocais();await iniciarConta();await atualizarConta();avisar('Conta excluída');navegar('dashboard');};
  window.addEventListener('nutrifoto:sincronizacao',evento=>{document.querySelector('#estado-sincronizacao').textContent=evento.detail.erro||'Dados sincronizados';if(evento.detail.erro)avisar(evento.detail.erro,true);});
  if(obterSessaoAtual()?.usuario)sincronizarComFeedback().then(()=>navegar(new URL(location.href).searchParams.get('tela')||'dashboard')).catch(erro=>avisar(erro.message,true));
}
