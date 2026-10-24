const telasAdicionais = ['capture','results','history','settings','diet','onboarding','conta','privacidade','assinatura','ativacao'];
export async function montarTelas() {
  const recipiente = document.querySelector('.app');
  const respostas = await Promise.all(telasAdicionais.map(async nome => {
    const resposta = await fetch('/telas/'+nome+'.html');
    if(!resposta.ok) throw new Error('Não foi possível carregar uma tela.');
    return resposta.text();
  }));
  for(const texto of respostas){const modelo=document.createElement('template');modelo.innerHTML=texto;recipiente.insertBefore(modelo.content,recipiente.querySelector('.nav'));}
  document.querySelectorAll('.screen').forEach(tela=>{
    tela.setAttribute('aria-label',tela.querySelector('h2')?.textContent||'NutriFoto');
    tela.querySelectorAll('label').forEach(rotulo=>{const campo=rotulo.parentElement.querySelector('input,select,textarea');if(campo?.id&&!rotulo.querySelector('input'))rotulo.htmlFor=campo.id;});
  });
}
export function atualizarRota(nome) {
  const endereco = new URL(location.href);
  if(endereco.searchParams.get('tela')!==nome){endereco.searchParams.set('tela',nome);history.pushState({tela:nome},'',endereco.pathname+endereco.search);}
}
