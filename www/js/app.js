import { adicionarCopo } from "./db.js";
import { iniciarLicenca } from './licenca.js';
import { captureFromCamera, pickFromGallery } from "./camera.js";
import { montarTelas } from "./navegacao.js";
import { iniciarConta, vincularConta } from "./conta.js";
import { atualizarAssinatura, vincularAssinatura } from "./assinatura.js";
import { iniciarAtualizacoes } from "./atualizacao.js";
import { iniciarAmbienteNativo } from "./ambienteNativo.js";
import { agendarSincronizacao } from "./sincronizacao.js";
import { $, $$, estado, obterTema, definirTema, alternarTema, mostrarTela, avisar } from "./base.js";
import { renderizarPainel, renderizarAgua, registrarCopo, removerAgua, alternarMenuRapido, fecharMenuRapido, abrirRegistroPeso, abrirDialogoAgua, fecharDialogoAgua, confirmarAgua, selecionarPeriodoPeso, renderizarGraficoPeso, confirmarPeso, alternarGraficos } from "./painel.js";
import { definirModoCaptura, definirImagemCaptura, selecionarImagem, analisarCaptura, cancelarAnalise } from "./captura.js";
import { salvarRefeicaoAtual } from "./resultados.js";
import { renderizarHistorico } from "./historico.js";
import { renderizarConfiguracoes, salvarConfiguracoes, exportarJson, exportarCsv, importarArquivoBackup } from "./configuracoes.js";
import { renderizarTelaPlano, editarPerfil, cancelarPlano } from "./plano.js";
import { agendarLembretes } from "./lembretes.js";
import { tutorialConcluido, concluirTutorial, mostrarTutorial, definirPassoTutorial, avancarTutorial, reabrirTutorial, vincularGestosTutorial } from "./tutorial.js";
function vincularEventos() {
  $('#cancelar-analise').onclick = cancelarAnalise;
  $('#cancelar-plano').onclick = cancelarPlano;
  $$('.nav-btn').forEach(b => {
    b.addEventListener('click', () => mostrarTela(b.dataset.screen));
  });
  $('#btn-add-meal').addEventListener('click', (e) => {
    e.stopPropagation();
    alternarMenuRapido();
  });

  // Water glass chips
  $$('.water-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const sizeMl = Number(chip.dataset.ml);
      await registrarCopo(sizeMl);
    });
  });

  // Quick add meal button (below daily cards)
  const quickAddMeal = $('#quick-add-meal');
  if (quickAddMeal) {
    quickAddMeal.addEventListener('click', () => {
      definirModoCaptura('photo');
      definirImagemCaptura(null);
      mostrarTela('capture');
    });
  }

  // Quick action menu items
  $('#quick-action-menu').addEventListener('click', (e) => {
    const item = e.target.closest('.quick-action-item');
    if (!item) return;
    const action = item.dataset.action;
    fecharMenuRapido();
    if (action === 'meal') {
      definirModoCaptura('photo');
      definirImagemCaptura(null);
      mostrarTela('capture');
    } else if (action === 'weight') {
      abrirRegistroPeso();
    } else if (action === 'water') {
      abrirDialogoAgua();
    }
  });

  // Close quick action menu on outside click
  $('#quick-action-overlay').addEventListener('click', fecharMenuRapido);

  // Water modal
  $('#water-modal-confirm').addEventListener('click', confirmarAgua);
  $('#water-modal-close').addEventListener('click', fecharDialogoAgua);
  $('#water-modal-overlay').addEventListener('click', (e) => {
    if (e.target === $('#water-modal-overlay')) fecharDialogoAgua();
  });
  $('#water-modal-ml').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmarAgua();
  });
  $$('.water-modal-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const ml = Number(chip.dataset.ml);
      await adicionarCopo(ml);
      renderizarAgua();
      fecharDialogoAgua();
    });
  });
  $$('.capture-tab').forEach(tab => {
    tab.addEventListener('click', () => definirModoCaptura(tab.dataset.mode));
  });
  $('#text-food-name').addEventListener('input', () => {
    if (estado.captureMode === 'text') $('#btn-analyze').disabled = false;
  });
  $('#btn-camera').addEventListener('click', () => selecionarImagem(captureFromCamera));
  $('#btn-gallery').addEventListener('click', () => selecionarImagem(pickFromGallery));
  $('#btn-analyze').addEventListener('click', analisarCaptura);
  $('#btn-back-analyze').addEventListener('click', () => mostrarTela('capture'));
  $('#btn-save-meal').addEventListener('click', salvarRefeicaoAtual);
  $('#btn-save-settings').addEventListener('click', salvarConfiguracoes);
  $('#btn-export-json').addEventListener('click', exportarJson);
  $('#btn-export-csv').addEventListener('click', exportarCsv);
  $('#importar-backup').addEventListener('change', importarArquivoBackup);
  document.querySelectorAll('[data-ir-tela]').forEach(botao=>botao.onclick=()=>mostrarTela(botao.dataset.irTela));
  vincularConta(mostrarTela,avisar);
  vincularAssinatura(avisar);
  $('#btn-cancel-capture').addEventListener('click', () => mostrarTela('dashboard'));
  $('#btn-toggle-theme').addEventListener('click', alternarTema);
  $('#btn-expand-charts').addEventListener('click', alternarGraficos);
  $('#mini-chart-bar').addEventListener('click', alternarGraficos);
  $('#btn-edit-profile').addEventListener('click', editarPerfil);

  // Water buttons
  $('#btn-water-minus').addEventListener('click', removerAgua);

  // Onboarding navigation
  $$('.onboarding-close').forEach(btn => {
    btn.addEventListener('click', concluirTutorial);
  });
  $$('.onboarding-start-btn').forEach(btn => {
    btn.addEventListener('click', concluirTutorial);
  });
  // Also add click handlers for dots to navigate
  $$('.onboarding-dot').forEach(dot => {
    dot.addEventListener('click', () => definirPassoTutorial(Number(dot.dataset.step)));
  });
  const restartBtn = $('#btn-restart-onboarding');
  if (restartBtn) restartBtn.addEventListener('click', reabrirTutorial);

  // Onboarding nav buttons (Próximo / Pular)
  $$('.onboarding-next-btn').forEach(btn => {
    btn.addEventListener('click', avancarTutorial);
  });
  $$('.onboarding-skip-btn').forEach(btn => {
    btn.addEventListener('click', concluirTutorial);
  });

  // Weight card
  const weightDisplay = $('#weight-card-display');
  if (weightDisplay) {
    weightDisplay.addEventListener('click', abrirRegistroPeso);
  }
  const weightConfirm = $('#weight-confirm');
  if (weightConfirm) weightConfirm.addEventListener('click', confirmarPeso);
  const weightCancel = $('#weight-cancel');
  if (weightCancel) {
    weightCancel.addEventListener('click', () => {
      $('#weight-card-input').style.display = 'none';
      $('#weight-card-display').style.display = 'flex';
    });
  }
  // Weight input enter key
  const weightInput = $('#weight-input');
  if (weightInput) {
    weightInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmarPeso();
    });
  }
  // Weight chart filters
  $$('.weight-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.weight-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selecionarPeriodoPeso(Number(btn.dataset.days));
      renderizarGraficoPeso();
    });
  });
}

async function iniciarAplicativo() {
  if(location.hash.includes('access_token'))history.replaceState({},'',location.pathname+location.search);
  await montarTelas();
  window.addEventListener('nutrifoto:troca-conta',()=>{estado.currentImage=null;estado.currentAnalysis=null;estado.imagemDaAnalise=null;document.querySelectorAll('.edit-overlay,.swap-overlay').forEach(elemento=>elemento.remove());for(const identificador of ['foods-list','result-hero','totals-summary','meals-list','history-list'])document.getElementById(identificador)?.replaceChildren();cancelarAnalise();cancelarPlano();});
  await iniciarConta();
  definirTema(obterTema());
  document.addEventListener('nutrifoto:tela',evento=>{
    fecharMenuRapido();
    const renderizadores={dashboard:renderizarPainel,history:renderizarHistorico,settings:renderizarConfiguracoes,diet:renderizarTelaPlano,assinatura:atualizarAssinatura};
    Promise.resolve(renderizadores[evento.detail]?.()).catch(erro=>avisar(erro.message,true));
  });
  document.addEventListener('nutrifoto:atualizar',()=>{const nome=document.querySelector('.screen.active')?.id.replace('screen-',''); if(nome)mostrarTela(nome);});
  vincularEventos();
  renderizarPainel();
  agendarLembretes();
  if (window.lucide) lucide.createIcons();
  vincularGestosTutorial();
  if (!tutorialConcluido() && !window.NutriFotoAndroid) {
    mostrarTutorial();
  }
  const telaInicial=new URL(location.href).searchParams.get('tela');
  if(telaInicial && $('#screen-'+telaInicial)) mostrarTela(telaInicial);
  window.addEventListener('popstate',()=>mostrarTela(new URL(location.href).searchParams.get('tela')||'dashboard'));
  window.addEventListener('unhandledrejection',evento=>{evento.preventDefault();avisar(evento.reason?.message||'Não foi possível concluir. Tente novamente.',true);});
  document.addEventListener('change',evento=>{if(evento.target.matches('input,select,textarea'))agendarSincronizacao();});
  if(!window.NutriFotoAndroid&&!window.NutriFotoDesktop)iniciarAtualizacoes(avisar);
  iniciarAmbienteNativo({mostrarTela,definirImagem:definirImagemCaptura,definirModo:definirModoCaptura,avisar});
  await iniciarLicenca();
  if (window.NutriFotoAndroid) mostrarTela('ativacao');
}
iniciarAplicativo().catch(erro=>{document.querySelector('#erro-inicial').textContent=erro.message+' Recarregue para tentar novamente.';});
