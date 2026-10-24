export function iniciarAmbienteNativo({mostrarTela,definirImagem,definirModo,avisar}){
  const plataforma=window.NutriFotoAndroid;if(!plataforma)return;
  function recuperarFoto(){const imagem=plataforma.recuperarImagem();if(imagem){definirModo('photo');definirImagem(imagem);mostrarTela('capture');avisar('Foto recuperada após retornar ao aplicativo.');}}
  plataforma.aoVoltar(()=>{
    const dialogo=[...document.querySelectorAll('[role="dialog"]')].find(elemento=>elemento.getClientRects().length);
    if(dialogo){dialogo.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return;}
    if(document.querySelector('.screen.active')?.id!=='screen-dashboard'){
      if(history.state?.tela)history.back();else mostrarTela('dashboard');
    }else plataforma.minimizar();
  });
  window.addEventListener('nutrifoto:imagem-restaurada',recuperarFoto);recuperarFoto();
}
