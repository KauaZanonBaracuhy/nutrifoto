export function escaparTexto(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caractere => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[caractere]));
}
export function prepararDialogo(elemento, aoFechar) {
  vincularRotulos(elemento);
  const focoAnterior = document.activeElement;
  const painel = elemento.querySelector('.edit-modal,.swap-modal,.water-modal') || elemento;
  painel.setAttribute('role', 'dialog'); painel.setAttribute('aria-modal', 'true');
  painel.setAttribute('aria-label', painel.querySelector('h3')?.textContent || 'Confirmar ação');
  const fechar = () => { aoFechar(); focoAnterior?.focus(); };
  elemento.onkeydown = evento => {
    if (evento.key === 'Escape') { evento.preventDefault(); fechar(); }
    if (evento.key !== 'Tab') return;
    const controles = [...painel.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(controle => !controle.disabled && controle.getClientRects().length);
    if (!controles.length) { evento.preventDefault(); return; }
    const primeiro = controles[0], ultimo = controles.at(-1);
    if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
    else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
  };
  queueMicrotask(() => painel.querySelector('button,input,select,textarea')?.focus()); return fechar;
}
export function vincularRotulos(recipiente){
  recipiente.querySelectorAll('label').forEach(rotulo=>{const entrada=rotulo.parentElement.querySelector('input,select,textarea');if(entrada?.id&&!rotulo.querySelector('input'))rotulo.htmlFor=entrada.id;});
  const nomes={nome:'Nome do alimento',porcao_estimada_g:'Quantidade em gramas'};
  recipiente.querySelectorAll('input,select,textarea').forEach(entrada=>{if(!entrada.labels?.length&&!entrada.getAttribute('aria-label'))entrada.setAttribute('aria-label',nomes[entrada.dataset.field]||entrada.placeholder||'Informação do formulário');});
}
export function confirmarAcao(mensagem) {
  return new Promise(resolver => {
    const focoAnterior=document.activeElement;
    const sobreposicao = document.createElement('div'); sobreposicao.className = 'swap-overlay';
    const painel = document.createElement('div'); painel.className = 'swap-modal';
    const texto = document.createElement('p'); texto.textContent = mensagem;
    const cancelar = document.createElement('button'); cancelar.className = 'btn-secondary'; cancelar.textContent = 'Cancelar';
    const confirmar = document.createElement('button'); confirmar.className = 'btn-danger'; confirmar.textContent = 'Confirmar';
    painel.append(texto, cancelar, confirmar); sobreposicao.append(painel); document.body.append(sobreposicao);
    const fechar = prepararDialogo(sobreposicao, () => { sobreposicao.remove(); resolver(false); });
    cancelar.onclick = fechar; confirmar.onclick = () => { sobreposicao.remove(); focoAnterior?.focus(); resolver(true); };
  });
}
