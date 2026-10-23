import { obterSessaoAtual, requisitarApi } from './servicoHttp.js';

let consultaAtual=0, pagamentoPendente=false;
const nomesPeriodos={mensal:'Mensal',anual:'Anual'};
const numero=valor=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(valor);

export async function atualizarAssinatura() {
  const consulta=++consultaAtual, usuario=obterSessaoAtual()?.usuario?.id;
  const estado=document.querySelector('#assinatura-estado'), erro=document.querySelector('#assinatura-erro');
  const seletor=document.querySelector('#assinatura-periodo'), lista=document.querySelector('#assinatura-beneficios');
  document.querySelector('#assinatura-checkout').disabled=true;document.querySelector('#assinatura-portal').disabled=true;
  seletor.disabled=true;lista.replaceChildren();erro.textContent='';
  estado.textContent=usuario?'Consultando seu plano…':'Entre na sua conta para consultar seu plano.';
  if(!usuario)return;
  try {
    const assinatura=await requisitarApi('/api/assinatura');
    if(consulta!==consultaAtual||obterSessaoAtual()?.usuario?.id!==usuario)return;
    estado.textContent='Plano '+assinatura.plano+' · '+assinatura.status+' · '+numero(assinatura.consumo??0)+' de '+numero(assinatura.limite??0)+' análises utilizadas neste mês.';
    const capacidades=assinatura.capacidades;
    const beneficios=capacidades?[
      'Análises disponíveis no plano: '+numero(capacidades.analises??0)+' por mês.',
      'Análise de texto: '+(capacidades.analiseTexto?'disponível, conforme saldo e orçamento.':'indisponível neste plano.'),
      'Análise de fotos: '+(capacidades.analiseFoto?'disponível, conforme saldo e orçamento.':'indisponível neste plano.'),
      'Limite de fotos: '+numero(capacidades.fotos??0)+'. Armazenamento: '+numero((capacidades.armazenamentoBytes??0)/1000000)+' MB.',
      'Sincronização: '+(capacidades.sincronizacao?'disponível.':'indisponível neste plano.'),
    ]:['Benefícios ainda não informados pelo servidor. Atualize a situação ou tente novamente mais tarde.'];
    for(const texto of beneficios){const item=document.createElement('li');item.textContent=texto;lista.append(item);}
    seletor.replaceChildren();
    for(const periodo of assinatura.periodos||[]){if(!nomesPeriodos[periodo])continue;const opcao=document.createElement('option');opcao.value=periodo;opcao.textContent=nomesPeriodos[periodo];seletor.append(opcao);}
    const disponivel=seletor.options.length>0;
    if(!disponivel){const opcao=document.createElement('option');opcao.value='';opcao.textContent='Nenhuma oferta disponível';seletor.append(opcao);}
    seletor.disabled=!disponivel;
    document.querySelector('#assinatura-checkout').disabled=!disponivel||pagamentoPendente||assinatura.plano==='pago';
    document.querySelector('#assinatura-portal').disabled=pagamentoPendente;
    document.querySelector('#assinatura-oferta').textContent=disponivel?'Oferta em ambiente de teste. Confira o valor, a periodicidade e as condições no checkout antes de confirmar.':'Nenhuma oferta configurada. Você pode continuar usando os recursos disponíveis do seu plano.';
  } catch(falha){if(consulta!==consultaAtual||obterSessaoAtual()?.usuario?.id!==usuario)return;estado.textContent='Não foi possível consultar seu plano.';erro.textContent=falha.message+' Se estiver sem conexão, tente novamente quando a rede voltar.';}
}

export function vincularAssinatura(avisar) {
  document.querySelector('#assinatura-atualizar').onclick=atualizarAssinatura;
  window.addEventListener('nutrifoto:troca-conta',()=>{consultaAtual++;document.querySelector('#assinatura-beneficios').replaceChildren();document.querySelector('#assinatura-estado').textContent='Entre na sua conta para consultar seu plano.';document.querySelector('#assinatura-checkout').disabled=true;document.querySelector('#assinatura-portal').disabled=true;});
  for(const acao of ['checkout','portal'])document.querySelector('#assinatura-'+acao).onclick=async()=>{
    if(pagamentoPendente)return;
    pagamentoPendente=true;
    for(const nome of ['checkout','portal','atualizar'])document.querySelector('#assinatura-'+nome).disabled=true;
    let mensagem='';
    try {
      const resposta=await requisitarApi('/api/assinatura',{method:'POST',body:JSON.stringify({acao,periodo:document.querySelector('#assinatura-periodo').value})});
      const endereco=new URL(resposta.url);
      if(endereco.protocol!=='https:'&&endereco.origin!==location.origin)throw new Error('Não foi possível abrir o endereço de pagamento.');
      location.assign(endereco.href);
    } catch(falha){mensagem=falha.message;avisar(mensagem,true);}
    finally{pagamentoPendente=false;document.querySelector('#assinatura-atualizar').disabled=false;await atualizarAssinatura();if(mensagem)document.querySelector('#assinatura-erro').textContent=mensagem;}
  };
}
