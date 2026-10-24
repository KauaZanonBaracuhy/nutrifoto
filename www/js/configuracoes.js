import { getGoals, setGoals } from "./storage.js";
import { autorizarAcompanhamento } from './licenca.js';
import { atualizarMetaAgua, localDate, listarTodasRefeicoes } from "./db.js";
import { getCurrentPlan } from "./dietPlan.js";
import { confirmarAcao } from "./elementos.js";
import { atualizarConta } from "./conta.js";
import { exportarBackupIntegral, importarBackupIntegral } from "./backup.js";
import { agendarSincronizacao } from "./sincronizacao.js";
import { $, CREDITO_DESENVOLVEDOR, TEMAS, obterTema, definirTema, mostrarTela, avisar, escaparHtml, VERSAO_APLICATIVO, LEMBRETES_PADRAO, lerLembretes, salvarLembretes } from "./base.js";
import { renderizarPainel } from "./painel.js";
import { agendarLembretes } from "./lembretes.js";
// ============ SETTINGS ============
export function definirAlternancia(btn, on) {
  btn.dataset.on = on ? '1' : '0';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

export function renderizarTemas() {
  const grid = $('#set-theme-grid');
  if (!grid) return;
  const current = obterTema();
  grid.innerHTML = TEMAS.map(t => `
    <button type="button" class="theme-card${t.id === current ? ' active' : ''}" data-theme-id="${t.id}" aria-pressed="${t.id === current}">
      <span class="theme-card-swatches">
        ${t.swatch.map(c => `<span class="theme-card-swatch" style="background:${c}"></span>`).join('')}
      </span>
      <span class="theme-card-label">${t.label}</span>
    </button>
  `).join('');
  grid.querySelectorAll('.theme-card').forEach(btn => {
    btn.onclick = () => {
      aplicarTema(btn.dataset.themeId, grid);
    };
  });
}

export function aplicarTema(id, grid) {
  definirTema(id);
  if (grid) {
    grid.querySelectorAll('.theme-card').forEach(c => {
      const on = c.dataset.themeId === id;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  // Re-render dashboard so charts (donut/bar/line) pick up the new palette
  if (typeof renderizarPainel === 'function') renderizarPainel();
}

export function vincularSecoesConfiguracao() {
  document.querySelectorAll('.settings-section-header').forEach(btn => {
    btn.onclick = () => {
      btn.closest('.settings-section').classList.toggle('open');
      btn.setAttribute('aria-expanded',String(btn.closest('.settings-section').classList.contains('open')));
    };
  });
}

export function renderizarConfiguracoes() {
  // Meta calórica + macros
  const g = getGoals();
  $('#set-calories').value = g.calories;
  $('#set-protein').value = g.protein;
  $('#set-carb').value = g.carb;
  $('#set-fat').value = g.fat;
  $('#set-water-goal').value = g.waterGoal || 2000;

  // Notificações — lembretes por refeição
  renderizarLembretes();

  // Streak toggle
  const n = lerLembretes();
  definirAlternancia($('#set-toggle-streak'), n.streakEnabled);
  $('#set-streak-time').value = n.streakTime;

  // Tema (grade de 10 opções)
  renderizarTemas();

  // Chave da API
  atualizarConta();

  // Sobre
  $('#about-version').textContent = VERSAO_APLICATIVO;
  $('#about-developer').textContent = CREDITO_DESENVOLVEDOR;

  vincularAlternancias();
  vincularCalculoMetas();

  vincularSecoesConfiguracao();

  // Link "Perfil e plano alimentar" → Meu Plano
  document.querySelectorAll('[data-screen-link="diet"]').forEach(a => {
    a.onclick = (e) => {
      e.preventDefault();
      mostrarTela('diet');
    };
  });

  if (window.lucide) lucide.createIcons();
}

export function vincularAlternancias() {
  $('#set-toggle-streak').onclick = (e) => {
    const btn = e.currentTarget;
    definirAlternancia(btn, btn.dataset.on === '0');
  };
}

// ============ PER-MEAL NOTIFICATIONS ============
export function renderizarLembretes() {
  const container = $('#meal-notifications-container');
  const hint = $('#notif-hint');
  if (!container) return;
  const plan = getCurrentPlan();
  const saved = lerLembretes();
  if (!plan || !Array.isArray(plan.refeicoes) || plan.refeicoes.length === 0) {
    container.innerHTML = '';
    if (hint) hint.style.display = '';
    return;
  }
  if (hint) hint.style.display = 'none';

  const savedMeals = saved.meals || [];
  const mealDefaults = {
    'Café da manhã': '07:30', 'Cafe da manha': '07:30',
    'Lanche da manhã': '10:00', 'Lanche da manha': '10:00',
    'Almoço': '12:30', 'Almoco': '12:30',
    'Lanche da tarde': '15:30',
    'Jantar': '19:30', 'Ceia': '22:00',
  };

  container.innerHTML = '<p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);margin-bottom:10px;">Lembretes por refeição</p>';

  plan.refeicoes.forEach((r, i) => {
    const existing = savedMeals.find(m => m.name === r.nome);
    const time = existing ? existing.time : (mealDefaults[r.nome] || r.horario || '12:00');
    const enabled = existing ? existing.enabled : false;

    const row = document.createElement('div');
    row.innerHTML = `
      <div class="toggle-row">
        <div class="toggle-label">
          <span class="toggle-title">${escaparHtml(r.nome)}</span>
          <span class="toggle-sub">~${escaparHtml(r.kcalEstimada || 0)} kcal</span>
        </div>
        <button class="toggle-switch" data-meal-toggle="${i}" data-on="${enabled ? '1' : '0'}" aria-pressed="${enabled ? 'true' : 'false'}" aria-label="Ativar lembrete ${escaparHtml(r.nome)}">
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="diet-field" style="margin-bottom:12px;">
        <label>${escaparHtml(r.nome)}</label>
        <input type="time" id="set-meal-time-${i}" value="${escaparHtml(time)}" />
      </div>
    `;
    container.appendChild(row);

    const toggleBtn = row.querySelector(`[data-meal-toggle="${i}"]`);
    toggleBtn.onclick = () => {
      definirAlternancia(toggleBtn, toggleBtn.dataset.on === '0');
    };
  });
}

// ============ MACRO ↔ CALORIE BIDIRECTIONAL CALCULATION ============
export const ENERGIA_MACROS = { protein: 4, carb: 4, fat: 9 };

export function calcularCaloriasMacros() {
  const p = Number($('#set-protein').value) || 0;
  const c = Number($('#set-carb').value) || 0;
  const f = Number($('#set-fat').value) || 0;
  return Math.round(p * ENERGIA_MACROS.protein + c * ENERGIA_MACROS.carb + f * ENERGIA_MACROS.fat);
}

export function calcularMacrosCalorias(totalCal) {
  const p = Number($('#set-protein').value) || 0;
  const c = Number($('#set-carb').value) || 0;
  const f = Number($('#set-fat').value) || 0;
  const macroCalSum = p * ENERGIA_MACROS.protein + c * ENERGIA_MACROS.carb + f * ENERGIA_MACROS.fat;
  let rp, rc, rf;
  if (macroCalSum > 0) {
    rp = (p * ENERGIA_MACROS.protein) / macroCalSum;
    rc = (c * ENERGIA_MACROS.carb) / macroCalSum;
    rf = (f * ENERGIA_MACROS.fat) / macroCalSum;
  } else {
    rp = 0.30; rc = 0.40; rf = 0.30;
  }
  return {
    protein: Math.round((totalCal * rp) / ENERGIA_MACROS.protein),
    carb: Math.round((totalCal * rc) / ENERGIA_MACROS.carb),
    fat: Math.round((totalCal * rf) / ENERGIA_MACROS.fat),
  };
}

export function vincularCalculoMetas() {
  const calInput = $('#set-calories');
  const pInput = $('#set-protein');
  const cInput = $('#set-carb');
  const fInput = $('#set-fat');
  if (!calInput || !pInput || !cInput || !fInput) return;

  let lock = false;

  [pInput, cInput, fInput].forEach(inp => {
    inp.addEventListener('input', () => {
      if (lock) return;
      lock = true;
      calInput.value = calcularCaloriasMacros();
      lock = false;
    });
  });

  calInput.addEventListener('input', () => {
    if (lock) return;
    lock = true;
    const total = Number(calInput.value) || 0;
    const m = calcularMacrosCalorias(total);
    pInput.value = m.protein;
    cInput.value = m.carb;
    fInput.value = m.fat;
    lock = false;
  });
}

// ============ API KEY (OpenRouter) ============
export async function salvarConfiguracoes() {
  for (const seletor of ["#set-calories","#set-protein","#set-carb","#set-fat","#set-water-goal"]) { const campo = $(seletor); if (!Number.isFinite(Number(campo.value)) || Number(campo.value) <= 0) { campo.setAttribute("aria-invalid","true"); campo.focus(); avisar("Informe metas positivas e válidas.",true); return; } campo.removeAttribute("aria-invalid"); }
  // 1) Metas diárias
  const waterGoal = Number($('#set-water-goal').value) || 2000;
  const metasAtuais = getGoals();
  if (['calories','protein','carb','fat'].some(campo => Number($('#set-'+campo).value) !== metasAtuais[campo]) || waterGoal !== metasAtuais.waterGoal) await autorizarAcompanhamento();
  setGoals({
    calories: Number($('#set-calories').value) || 0,
    protein: Number($('#set-protein').value) || 0,
    carb: Number($('#set-carb').value) || 0,
    fat: Number($('#set-fat').value) || 0,
    waterGoal,
  });
  if (waterGoal !== metasAtuais.waterGoal) await atualizarMetaAgua(waterGoal);

  // 2) Notificações — per-meal
  const plan = getCurrentPlan();
  const mealNotifications = [];
  if (plan && Array.isArray(plan.refeicoes)) {
    plan.refeicoes.forEach((r, i) => {
      const toggle = document.querySelector(`[data-meal-toggle="${i}"]`);
      const timeInput = $(`#set-meal-time-${i}`);
      mealNotifications.push({
        name: r.nome,
        time: timeInput ? timeInput.value : '12:00',
        enabled: toggle ? toggle.dataset.on === '1' : false,
      });
    });
  }

  salvarLembretes({
    meals: mealNotifications,
    streakEnabled: $('#set-toggle-streak').dataset.on === '1',
    streakTime: $('#set-streak-time').value || LEMBRETES_PADRAO.streakTime,
  });

  // 3) Agendar notificações
  agendarLembretes();

  // Reflete imediatamente no dashboard
  renderizarPainel();
  agendarSincronizacao();
  avisar('Configurações salvas');
}

export async function exportarJson() {
  const backup = await exportarBackupIntegral();
  await baixarArquivo(new Blob([JSON.stringify(backup)],{type:'application/json'}),'nutrifoto-backup-'+localDate()+'.json');
}
export async function exportarCsv() {
  const refeicoes = await listarTodasRefeicoes();
  const linhas = [['data','alimentos','calorias','proteina_g','carboidrato_g','gordura_g']];
  for (const refeicao of refeicoes) linhas.push([localDate(refeicao.createdAt),refeicao.alimentos.map(alimento=>alimento.nome).join('; '),refeicao.total.calorias,refeicao.total.proteina_g,refeicao.total.carboidrato_g,refeicao.total.gordura_g]);
  const csv = linhas.map(linha=>linha.map(valor=>'"'+String(valor).replace(/^[=+@-]/,"'").replaceAll('"','""')+'"').join(',')).join('\n');
  await baixarArquivo(new Blob([csv],{type:'text/csv;charset=utf-8'}),'nutrifoto-historico-'+localDate()+'.csv');
}
export async function importarArquivoBackup(evento) {
  const arquivo=evento.target.files[0]; if(!arquivo)return;
  if(arquivo.size>30*1024*1024){avisar('O backup deve ter até 30 MB.',true);return;}
  if(!await confirmarAcao('Mesclar o backup com os dados desta sessão? Conflitos manterão seus dados locais.'))return;
  try { await importarBackupIntegral(await arquivo.text(),{modo:'mesclar',conflito:'local'}); agendarSincronizacao(); mostrarTela('dashboard'); avisar('Backup restaurado'); }
  catch(erro){avisar(erro.message,true);} finally{evento.target.value='';}
}
export async function baixarArquivo(blob, filename) {
  if(window.NutriFotoAndroid)return window.NutriFotoAndroid.exportarArquivo(blob,filename);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

