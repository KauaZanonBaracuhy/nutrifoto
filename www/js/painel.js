import { getGoals, obterContaArmazenamento } from "./storage.js";
import { listarRefeicoesDoDia, deletarRefeicao, listarTotaisPorDia, salvarPeso, listarPesos, obterPesoMaisRecente, obterPesoAnterior, obterAguaHoje, adicionarCopo, removerCopo, obterStreak } from "./db.js";
import { updateHeroDonut, updateMacroBars, renderMiniBar, renderBarChart, renderLineChart, renderWeightChart } from "./charts.js";
import { getUserProfile, saveUserProfile } from "./dietPlan.js";
import { prepararDialogo, confirmarAcao } from "./elementos.js";
import { agendarSincronizacao } from "./sincronizacao.js";
import { $, estado, avisar, formatarHorario, escaparHtml } from "./base.js";
import { abrirEdicaoRefeicao } from "./edicao.js";
// ============ DASHBOARD ============
export async function renderizarPainel() {
  const contaInicial=obterContaArmazenamento();
  if(typeof Chart === 'undefined' && !document.querySelector('#aviso-graficos')){const aviso=document.createElement('p');aviso.id='aviso-graficos';aviso.setAttribute('role','status');aviso.className='api-key-help';aviso.textContent='Os gráficos estão indisponíveis. Seus registros e metas continuam acessíveis.';document.querySelector('#screen-dashboard .main').prepend(aviso);}
  const meals = await listarRefeicoesDoDia();
  const sequencia=await obterStreak();if(contaInicial!==obterContaArmazenamento())return;
  $('#streak-num').textContent = sequencia;
  const goals = getGoals();
  const totals = meals.reduce((acc, m) => {
    if(m.legadoIncompleto)return acc;
    acc.calorias += m.total?.calorias || 0;
    acc.proteina_g += m.total?.proteina_g || 0;
    acc.carboidrato_g += m.total?.carboidrato_g || 0;
    acc.gordura_g += m.total?.gordura_g || 0;
    return acc;
  }, { calorias: 0, proteina_g: 0, carboidrato_g: 0, gordura_g: 0 });

  // Hero donut
  $('#hero-cal-value').textContent = totals.calorias;
  $('#hero-cal-goal').textContent = goals.calories;
  updateHeroDonut(totals.calorias, goals.calories);

  // Macro bars
  updateMacroBars(totals, goals);

  // Mini chart + full charts
  const dailyData = await listarTotaisPorDia(7);
  if(contaInicial!==obterContaArmazenamento())return;
  renderMiniBar(dailyData, goals.calories);
  renderBarChart(dailyData, goals.calories);
  renderLineChart(dailyData, goals.protein);

  // Weight card + chart
  renderizarPeso();
  renderizarGraficoPeso();

  // Water card
  renderizarAgua();

  // Meals list
  const list = $('#meals-list');
  if (meals.length === 0) {
    list.innerHTML = '<p class="empty">Nenhuma refeição registrada hoje.<br/>Toque no + para começar!</p>';
  } else {
    list.innerHTML = meals.map(m => `
      <div class="meal-item" data-id="${escaparHtml(m.id)}">
        ${/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(m.imageDataUrl||'') ? `<img class="meal-thumb" src="${escaparHtml(m.imageDataUrl)}" alt="" />` : '<div class="meal-thumb"></div>'}
        <div class="meal-info">
          <div class="meal-time">${formatarHorario(m.createdAt)}${m.legadoIncompleto?' · Registro antigo: revise os nutrientes (fora dos totais)':''}</div>
          <div class="meal-title">${m.alimentos.length > 0 ? escaparHtml(m.alimentos[0].nome) + (m.alimentos.length > 1 ? ` +${m.alimentos.length - 1}` : '') : 'Sem alimentos'}</div>
          <div class="meal-macros">
            <span>${escaparHtml(m.total?.calorias || 0)} kcal</span>
            <span>P ${escaparHtml(m.total?.proteina_g || 0)}g</span>
            <span>C ${escaparHtml(m.total?.carboidrato_g || 0)}g</span>
            <span>G ${escaparHtml(m.total?.gordura_g || 0)}g</span>
          </div>
        </div>
        <button class="btn-danger" aria-label="Excluir refeição" style="width:auto;padding:6px 10px;font-size:12px" data-del="${escaparHtml(m.id)}">✕</button>
      </div>
    `).join('');
  }

  list.querySelectorAll('.meal-item').forEach(card => {
    const acaoEdicao=card.querySelector('.meal-info');
    acaoEdicao.setAttribute('role','button');acaoEdicao.tabIndex=0;acaoEdicao.setAttribute('aria-label','Editar refeição '+card.querySelector('.meal-title').textContent);
    acaoEdicao.onkeydown=evento=>{if(evento.key==='Enter'||evento.key===' '){evento.preventDefault();abrirEdicaoRefeicao(Number(card.dataset.id));}};
    card.style.cursor = 'pointer';
    card.onclick = (e) => {
      if (e.target.closest('[data-del]')) return;
      abrirEdicaoRefeicao(Number(card.dataset.id));
    };
  });

  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.del);
      if (await confirmarAcao('Excluir esta refeição?')) {
        await deletarRefeicao(id);
        renderizarPainel();agendarSincronizacao();
      }
    };
  });
}

// ============ WATER CARD ============
export async function renderizarAgua() {
  const contaInicial=obterContaArmazenamento();
  const data = await obterAguaHoje();
  if(contaInicial!==obterContaArmazenamento())return;
  const goals = getGoals();
  const metaMl = goals.waterGoal || 2000;
  const mlPorCopo = 250;
  const ml = data.ml_consumidos || 0;
  const copos = Math.round(ml / mlPorCopo);
  const totalCopos = Math.round(metaMl / mlPorCopo);
  const pct = metaMl > 0 ? Math.min((ml / metaMl) * 100, 100) : 0;

  const valueEl = $('#water-value');
  const mlEl = $('#water-ml-display');
  const barEl = $('#water-progress-bar');
  if (!valueEl) return;

  valueEl.textContent = `${copos}/${totalCopos} copos`;
  mlEl.textContent = `${ml} / ${metaMl} ml`;
  barEl.style.width = `${pct}%`;

  if (pct >= 100) {
    barEl.style.background = 'var(--jade)';
  } else if (pct >= 60) {
    barEl.style.background = 'var(--jade)';
  } else {
    barEl.style.background = 'var(--jade)';
  }
}

export async function registrarCopo(sizeMl) {
  await adicionarCopo(sizeMl);
  renderizarAgua();
  agendarSincronizacao();
}

export async function removerAgua() {
  await removerCopo(200);
  renderizarAgua();
  agendarSincronizacao();
}

// ============ QUICK ACTION MENU (FAB) ============
export let quickActionOpen = false;

export function alternarMenuRapido() {
  const menu = $('#quick-action-menu');
  const overlay = $('#quick-action-overlay');
  if (!menu) return;
  quickActionOpen = !quickActionOpen;
  menu.style.display = quickActionOpen ? 'flex' : 'none';
  overlay.style.display = quickActionOpen ? 'block' : 'none';
}

export function fecharMenuRapido() {
  quickActionOpen = false;
  const menu = $('#quick-action-menu');
  const overlay = $('#quick-action-overlay');
  if (menu) menu.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
}

export function abrirRegistroPeso() {
  const display = $('#weight-card-display');
  const input = $('#weight-card-input');
  const field = $('#weight-input');
  if (!display || !input || !field) return;
  display.style.display = 'none';
  input.style.display = 'flex';
  field.value='';field.focus();
  const contaInicial=obterContaArmazenamento();
  let editado=false;
  const marcarEdicao=()=>{editado=true;};
  field.addEventListener('input',marcarEdicao,{once:true});
  obterPesoMaisRecente().then(recent => {
    if(editado||contaInicial!==obterContaArmazenamento()||input.style.display!=='flex')return;
    field.value = recent ? recent.peso_kg : '';
  }).catch(erro=>avisar(erro.message,true)).finally(()=>field.removeEventListener('input',marcarEdicao));
}

export function abrirDialogoAgua() {
  const overlay = $('#water-modal-overlay');
  if (overlay) { overlay.style.display = 'flex'; prepararDialogo(overlay,fecharDialogoAgua); }
  const field = $('#water-modal-ml');
  if (field) field.value = '';
  if (field) field.focus();
}

export function fecharDialogoAgua() {
  const overlay = $('#water-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

export async function confirmarAgua() {
  const field = $('#water-modal-ml');
  const val = parseFloat(field.value);
  if (isNaN(val) || val < 10 || val > 2000) {
    avisar('Digite um valor entre 10 e 2000 ml', true);
    return;
  }
  await adicionarCopo(val);
  renderizarAgua();
  fecharDialogoAgua();
  avisar('Água registrada');
}

// ============ WEIGHT CARD ============
export const filtroPeso = { dias:7 };

export async function renderizarPeso() {
  const contaInicial=obterContaArmazenamento();
  const recent = await obterPesoMaisRecente();
  const previous = await obterPesoAnterior();
  if(contaInicial!==obterContaArmazenamento())return;
  const valueEl = $('#weight-current');
  const deltaEl = $('#weight-delta');
  if (!valueEl) return;

  if (recent) {
    valueEl.textContent = `${recent.peso_kg.toFixed(1)} kg`;
    if (previous) {
      const diff = recent.peso_kg - previous.peso_kg;
      const sign = diff > 0 ? '+' : '';
      deltaEl.textContent = `${sign}${diff.toFixed(1)} kg desde a última`;
      deltaEl.className = 'weight-card-delta ' + (diff < 0 ? 'down' : diff > 0 ? 'up' : 'flat');
    } else {
      deltaEl.textContent = 'Primeiro registro';
      deltaEl.className = 'weight-card-delta flat';
    }
  } else {
    valueEl.textContent = '—';
    deltaEl.textContent = 'Toque + para registrar';
    deltaEl.className = 'weight-card-delta flat';
  }

  if (window.lucide) lucide.createIcons();
}

export function selecionarPeriodoPeso(dias){ filtroPeso.dias=dias; }
export async function renderizarGraficoPeso() {
  const contaInicial=obterContaArmazenamento();
  const dias = filtroPeso.dias || 0;
  const pesos = await listarPesos(dias || 0);
  if(contaInicial!==obterContaArmazenamento())return;
  renderWeightChart(pesos);
}

export async function confirmarPeso() {
  const input = $('#weight-input');
  const val = parseFloat(input.value);
  if (isNaN(val) || val < 20 || val > 400) {
    avisar('Digite um peso válido (20-400 kg)', true);
    return;
  }
  await salvarPeso(val);
  // Update profile pesoAtual
  const profile = getUserProfile();
  if (profile) {
    profile.pesoAtual = val;
    saveUserProfile(profile);
  }
  agendarSincronizacao();
  input.value = '';
  $('#weight-card-input').style.display = 'none';
  $('#weight-card-display').style.display = 'flex';
  renderizarPeso();
  renderizarGraficoPeso();
  avisar('Peso registrado');
}
export async function alternarGraficos() {
  if (!estado.chartsExpanded && window.NutriFotoAndroid) await (await import('./licenca.js')).autorizarAcompanhamento();
  estado.chartsExpanded = !estado.chartsExpanded;
  const el = $('#charts-expanded');
  const section = $('#mini-chart-section');
  if (estado.chartsExpanded) {
    el.style.display = 'block';
    section.classList.add('expanded');
  } else {
    el.style.display = 'none';
    section.classList.remove('expanded');
  }
}

