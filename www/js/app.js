// app.js — v2 layout: hero donut, macro bars, mini chart, FAB, timeline, receipt
import { getGoals, setGoals, isConfigured, getApiKey, setApiKey, getApiKeySource } from './storage.js';
import { salvarRefeicao, atualizarRefeicao, listarRefeicoesDoDia, listarHistorico, deletarRefeicao, listarTotaisPorDia } from './db.js';
import { captureFromCamera, pickFromGallery, downscaleImage } from './camera.js';
import { analyzeImage, recalcularTotal, testConnection } from './visionApi.js';
import { updateHeroDonut, updateMacroBars, renderMiniBar, renderBarChart, renderLineChart } from './charts.js';
import {
  getUserProfile,
  saveUserProfile,
  getCurrentPlan,
  saveCurrentPlan,
  gerarPlanoAlimentar,
} from './dietPlan.js';
import { getAlternatives, getAllCategories } from './foodAlternatives.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DEVELOPER_CREDIT = 'ZanonApps';

const DEFAULT_THEME = 'azul';

const THEMES = [
  { id: 'azul',           label: 'Azul',           swatch: ['#0B1E3F', '#2563EB', '#60A5FA'] },
  { id: 'vibrante',       label: 'Vibrante',       swatch: ['#00D68F', '#3B82F6', '#FF6B6B'] },
  { id: 'caveira',        label: 'Caveira',        swatch: ['#0A0A0A', '#8B0000', '#FF1F1F'] },
  { id: 'vulcao',         label: 'Vulcão',         swatch: ['#1A0F0A', '#F97316', '#DC2626'] },
  { id: 'gelo',           label: 'Gelo',           swatch: ['#F0F8FF', '#BAE6FD', '#94A3B8'] },
  { id: 'arcoiris',       label: 'Arco-íris',      swatch: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#A855F7'] },
  { id: 'oceano',         label: 'Oceano',         swatch: ['#0C2A47', '#0E7490', '#22D3EE'] },
  { id: 'porDoSol',       label: 'Pôr do Sol',     swatch: ['#7C2D12', '#F97316', '#EC4899', '#7C3AED'] },
  { id: 'floresta',       label: 'Floresta',       swatch: ['#1B2A1A', '#166534', '#92400E'] },
  { id: 'minimalista',    label: 'Minimalista',    swatch: ['#FFFFFF', '#E5E7EB', '#111827'] },
];

const state = {
  currentImage: null,
  currentAnalysis: null,
  chartsExpanded: false,
};

// ============ BOWL LOADER TEXT ROTATION ============
const BOWL_MESSAGES = [
  'Analisando sua refeicao...',
  'Identificando os alimentos...',
  'Calculando os macros...',
  'Quase pronto...',
];
const BOWL_MESSAGES_DIET = [
  'Gerando seu plano...',
  'Calculando suas calorias...',
  'Montando as refeicoes...',
  'Quase pronto...',
];
const _bowlTimers = [];

function startBowlText(textElId, messages) {
  stopBowlText();
  const el = $(textElId);
  if (!el) return;
  let idx = 0;
  el.textContent = messages[0];
  el.classList.remove('fade');
  const tid = setInterval(() => {
    el.classList.add('fade');
    setTimeout(() => {
      idx = (idx + 1) % messages.length;
      el.textContent = messages[idx];
      el.classList.remove('fade');
    }, 300);
  }, 1500);
  _bowlTimers.push(tid);
}

function stopBowlText() {
  _bowlTimers.forEach(id => clearInterval(id));
  _bowlTimers.length = 0;
}

// ============ THEME ============
function isValidTheme(id) { return THEMES.some(t => t.id === id); }
function getTheme() {
  const saved = localStorage.getItem('nutrifoto.theme');
  return isValidTheme(saved) ? saved : DEFAULT_THEME;
}
function setTheme(t) {
  if (!isValidTheme(t)) t = DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('nutrifoto.theme', t);
}
function toggleTheme() {
  const i = THEMES.findIndex(t => t.id === getTheme());
  const next = THEMES[(i + 1) % THEMES.length];
  const grid = $('#set-theme-grid');
  if (grid) {
    applyThemeSelection(next.id, grid);
  } else {
    setTheme(next.id);
    if (typeof renderDashboard === 'function') renderDashboard();
  }
}

// ============ NAVIGATION ============
function showScreen(name) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const screen = $(`#screen-${name}`);
  if (screen) screen.classList.add('active');
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));

  const nav = $('.nav');
  const fab = $('.fab');
  const isOverlay = name === 'capture' || name === 'results';
  nav.style.display = isOverlay ? 'none' : 'flex';
  if (fab) fab.style.display = name === 'dashboard' ? 'flex' : 'none';

  if (name === 'dashboard') renderDashboard();
  if (name === 'history') renderHistory();
  if (name === 'settings') renderSettings();
  if (name === 'diet') renderDiet();
  if (window.lucide) lucide.createIcons();
}

// ============ TOAST ============
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ============ CONFIRMATION ============
function showConfirmation() {
  const o = $('#confirm-overlay');
  o.style.display = 'flex';
  setTimeout(() => { o.style.display = 'none'; }, 1400);
}

// ============ HELPERS ============
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ============ DASHBOARD ============
async function renderDashboard() {
  const meals = await listarRefeicoesDoDia();
  const goals = getGoals();
  const totals = meals.reduce((acc, m) => {
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
  renderMiniBar(dailyData, goals.calories);
  renderBarChart(dailyData, goals.calories);
  renderLineChart(dailyData, goals.protein);

  // Meals list
  const list = $('#meals-list');
  if (meals.length === 0) {
    list.innerHTML = '<p class="empty">Nenhuma refeição registrada hoje.<br/>Toque no + para começar!</p>';
  } else {
    list.innerHTML = meals.map(m => `
      <div class="meal-item" data-id="${m.id}">
        ${m.imageDataUrl ? `<img class="meal-thumb" src="${m.imageDataUrl}" alt="" />` : '<div class="meal-thumb"></div>'}
        <div class="meal-info">
          <div class="meal-time">${formatTime(m.createdAt)}</div>
          <div class="meal-title">${m.alimentos.length > 0 ? m.alimentos[0].nome + (m.alimentos.length > 1 ? ` +${m.alimentos.length - 1}` : '') : 'Sem alimentos'}</div>
          <div class="meal-macros">
            <span>${m.total?.calorias || 0} kcal</span>
            <span>P ${m.total?.proteina_g || 0}g</span>
            <span>C ${m.total?.carboidrato_g || 0}g</span>
            <span>G ${m.total?.gordura_g || 0}g</span>
          </div>
        </div>
        <button class="btn-danger" style="width:auto;padding:6px 10px;font-size:12px" data-del="${m.id}">✕</button>
      </div>
    `).join('');
  }

  list.querySelectorAll('.meal-item').forEach(card => {
    card.style.cursor = 'pointer';
    card.onclick = (e) => {
      if (e.target.closest('[data-del]')) return;
      openEditMealModal(Number(card.dataset.id));
    };
  });

  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.del);
      if (confirm('Excluir esta refeição?')) {
        await deletarRefeicao(id);
        renderDashboard();
      }
    };
  });
}

// ============ CHARTS TOGGLE ============
function toggleCharts() {
  state.chartsExpanded = !state.chartsExpanded;
  const el = $('#charts-expanded');
  const section = $('#mini-chart-section');
  if (state.chartsExpanded) {
    el.style.display = 'block';
    section.classList.add('expanded');
  } else {
    el.style.display = 'none';
    section.classList.remove('expanded');
  }
}

// ============ CAPTURE ============
function setCaptureImage(img) {
  state.currentImage = img;
  const preview = $('#image-preview');
  if (img) {
    preview.innerHTML = `<img src="${img.dataUrl}" alt="prato" />`;
    $('#btn-analyze').disabled = false;
  } else {
    preview.innerHTML = '<i data-lucide="image-plus" class="preview-icon"></i><span>Tire uma foto ou escolha da galeria</span>';
    $('#btn-analyze').disabled = true;
    if (window.lucide) lucide.createIcons();
  }
}

async function handleImage(captureFn) {
  try {
    const raw = await captureFn();
    if (!raw) return;
    const img = await downscaleImage(raw.dataUrl, 1024);
    setCaptureImage(img);
  } catch (e) {
    toast(e.message || 'Erro ao obter imagem', true);
  }
}

async function handleAnalyze() {
  if (!state.currentImage) return;
  if (!isConfigured()) {
    toast('Chave da API não configurada. Vá em Configurações → Chave da API OpenRouter.', true);
    showScreen('settings');
    return;
  }
  const btn = $('#btn-analyze');
  btn.disabled = true;
  const skeleton = $('#skeleton-loading');
  skeleton.style.display = 'block';
  startBowlText('#bowl-text-photo', BOWL_MESSAGES);
  try {
    const result = await analyzeImage(state.currentImage);
    state.currentAnalysis = result;
    renderResults();
    showScreen('results');
  } catch (e) {
    toast(e.message || 'Erro na análise', true);
  } finally {
    btn.disabled = false;
    skeleton.style.display = 'none';
    stopBowlText();
  }
}

// ============ RESULTS — Receipt Style ============
function renderResults() {
  if (!state.currentAnalysis) return;
  const a = state.currentAnalysis;

  // Hero thumb
  const hero = $('#result-hero');
  if (state.currentImage) {
    hero.innerHTML = `
      <img class="result-hero-thumb" src="${state.currentImage.dataUrl}" alt="" />
      <div class="result-hero-info">
        <div class="result-hero-title">${a.alimentos.length} alimento(s) detectado(s)</div>
        <div class="result-hero-count">Toque nos campos para ajustar porções</div>
      </div>
    `;
  } else {
    hero.innerHTML = `
      <div class="result-hero-info">
        <div class="result-hero-title">${a.alimentos.length} alimento(s) detectado(s)</div>
        <div class="result-hero-count">Toque nos campos para ajustar porções</div>
      </div>
    `;
  }

  // Food receipt cards
  const list = $('#foods-list');
  if (a.alimentos.length === 0) {
    list.innerHTML = '<p class="empty">Nenhum alimento identificado. Tente outra foto.</p>';
  } else {
    list.innerHTML = a.alimentos.map((f, idx) => `
      <div class="food-receipt" data-idx="${idx}">
        <div class="food-receipt-header">
          <input class="food-receipt-name" value="${escapeHtml(f.nome)}" data-field="nome" />
          <button class="food-receipt-remove" data-remove="${idx}">✕</button>
        </div>
        <div class="food-receipt-edit">
          <input class="food-receipt-grams" type="number" min="0" value="${f.porcao_estimada_g}" data-field="porcao_estimada_g" inputmode="numeric" />
          <span class="food-receipt-grams-label">gramas</span>
        </div>
        <div class="food-receipt-macros">
          <span><strong>${f.calorias}</strong> kcal</span>
          <span>P: <strong>${f.proteina_g}</strong>g</span>
          <span>C: <strong>${f.carboidrato_g}</strong>g</span>
          <span>G: <strong>${f.gordura_g}</strong>g</span>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.food-receipt').forEach(row => {
      const idx = Number(row.dataset.idx);
      const f = state.currentAnalysis.alimentos[idx];
      ensureOriginals(f);

      // Name edit
      row.querySelector('[data-field="nome"]').oninput = (e) => {
        f.nome = e.target.value;
      };

      // Grams edit — recalculate macros proportionally
      row.querySelector('[data-field="porcao_estimada_g"]').oninput = (e) => {
        const v = Number(e.target.value) || 0;
        f.porcao_estimada_g = v;
        const orig = f.porcao_original_g || f.porcao_estimada_g;
        if (orig > 0) {
          const ratio = v / orig;
          f.calorias = Math.round(f.calorias_original * ratio);
          f.proteina_g = Math.round(f.proteina_original * ratio);
          f.carboidrato_g = Math.round(f.carbo_original * ratio);
          f.gordura_g = Math.round(f.gordura_original * ratio);
          // Update macro display
          const macros = row.querySelector('.food-receipt-macros');
          macros.innerHTML = `
            <span><strong>${f.calorias}</strong> kcal</span>
            <span>P: <strong>${f.proteina_g}</strong>g</span>
            <span>C: <strong>${f.carboidrato_g}</strong>g</span>
            <span>G: <strong>${f.gordura_g}</strong>g</span>
          `;
        }
        updateTotals();
      };

      // Remove
      row.querySelector('[data-remove]').onclick = () => {
        state.currentAnalysis.alimentos.splice(idx, 1);
        renderResults();
      };
    });
  }
  updateTotals();
}

function ensureOriginals(f) {
  if (f.calorias_original === undefined) f.calorias_original = f.calorias;
  if (f.proteina_original === undefined) f.proteina_original = f.proteina_g;
  if (f.carbo_original === undefined) f.carbo_original = f.carboidrato_g;
  if (f.gordura_original === undefined) f.gordura_original = f.gordura_g;
  if (!f.porcao_original_g) f.porcao_original_g = f.porcao_estimada_g;
}

function updateTotals() {
  if (!state.currentAnalysis) return;
  state.currentAnalysis.alimentos.forEach(ensureOriginals);
  const total = recalcularTotal(state.currentAnalysis.alimentos);
  state.currentAnalysis.total = total;
  $('#totals-summary').innerHTML = `
    <div><strong>${total.calorias}</strong><span>kcal</span></div>
    <div><strong>${total.proteina_g}g</strong><span>P</span></div>
    <div><strong>${total.carboidrato_g}g</strong><span>C</span></div>
    <div><strong>${total.gordura_g}g</strong><span>G</span></div>
  `;
}

async function handleSaveMeal() {
  if (!state.currentAnalysis || state.currentAnalysis.alimentos.length === 0) {
    toast('Nada para salvar', true);
    return;
  }
  const meal = {
    imageDataUrl: state.currentImage?.dataUrl || null,
    alimentos: state.currentAnalysis.alimentos,
    total: state.currentAnalysis.total,
  };
  await salvarRefeicao(meal);
  state.currentImage = null;
  state.currentAnalysis = null;
  setCaptureImage(null);
  showConfirmation();
  setTimeout(() => showScreen('dashboard'), 1500);
}

// ============ HISTORY — Timeline ============
function getStatusClass(dayTotal, goals) {
  if (dayTotal === 0) return 'status-empty';
  if (goals.calories > 0) {
    const pct = dayTotal / goals.calories;
    if (pct > 1) return 'status-over';
    if (pct > 0.85) return 'status-warn';
  }
  return 'status-ok';
}

async function renderHistory() {
  const groups = await listarHistorico();
  const goals = getGoals();
  const list = $('#history-list');

  if (groups.length === 0) {
    list.innerHTML = '<p class="empty">Nenhuma refeição registrada ainda.</p>';
    return;
  }

  const todayStr = getTodayStr();

  list.innerHTML = `<div class="timeline">${groups.map(g => {
    const dayTotal = g.meals.reduce((acc, m) => acc + (m.total?.calorias || 0), 0);
    const macroTotal = g.meals.reduce((acc, m) => {
      acc.proteina_g += m.total?.proteina_g || 0;
      acc.carboidrato_g += m.total?.carboidrato_g || 0;
      return acc;
    }, { proteina_g: 0, carboidrato_g: 0 });

    const statusClass = getStatusClass(dayTotal, goals);
    const isToday = g.day === todayStr;
    const dayLabel = isToday ? 'Hoje' : formatDate(g.day + 'T12:00:00');

    return `
      <div class="timeline-day" data-day="${g.day}">
        <div class="timeline-dot ${statusClass}"></div>
        <div class="timeline-day-header">
          <div>
            <div class="timeline-day-date">${dayLabel}</div>
            <div class="timeline-day-summary">
              <span>${dayTotal} kcal</span>
              <span class="dot-sep">·</span>
              <span>${g.meals.length} refeição(ões)</span>
            </div>
          </div>
          <span class="timeline-day-arrow">&#9656;</span>
        </div>
        <div class="timeline-day-content">
          <div class="timeline-meals">
            ${g.meals.map(m => `
              <div class="timeline-meal" data-meal-id="${m.id}">
                <span class="timeline-meal-time">${formatTime(m.createdAt)}</span>
                <span class="timeline-meal-name">${m.alimentos.length > 0 ? m.alimentos.map(a => a.nome).join(', ') : 'Sem alimentos'}</span>
                <span class="timeline-meal-kcal">${m.total?.calorias || 0}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('')}</div>`;

  list.querySelectorAll('.timeline-day-header').forEach(h => {
    h.onclick = () => h.parentElement.classList.toggle('open');
  });

  list.querySelectorAll('.timeline-meal').forEach(el => {
    el.style.cursor = 'pointer';
    el.onclick = () => openEditMealModal(Number(el.dataset.mealId));
  });
}

// ============ SETTINGS ============
const NOTIFY_KEY = 'nutrifoto.notify';
const APP_VERSION = '0.1.0';

// PLACEHOLDER: secao futura "Comunidade / Social"
// Quando for implementada, adicionar um novo <div class="settings-card">
// nesta posicao do array de cards em screen-settings (entre "Tema visual"
// e "Sobre o app", ou onde fizer mais sentido no produto).
// Sugestoes de UI para essa secao:
//   - Feed de refeicoes publicas de outros usuarios
//   - Compartilhar refeicao com foto + macros
//   - Seguir amigos / ver streaks deles
//   - Desafios semanais (ex: 7 dias semanais completos)
//   - Reacoes/comentarios
// Por enquanto NAO adicionar nenhum elemento visivel aqui — apenas
// manter este comentario para marcar o local de insercao futura.

const DEFAULT_NOTIFY = {
  meals: [],
  streakEnabled: false,
  streakTime: '20:00',
};

function readNotify() {
  try {
    const raw = localStorage.getItem(NOTIFY_KEY);
    if (!raw) return { ...DEFAULT_NOTIFY };
    return { ...DEFAULT_NOTIFY, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIFY };
  }
}

function writeNotify(prefs) {
  localStorage.setItem(NOTIFY_KEY, JSON.stringify(prefs));
}

function setToggle(btn, on) {
  btn.dataset.on = on ? '1' : '0';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function renderThemeGrid() {
  const grid = $('#set-theme-grid');
  if (!grid) return;
  const current = getTheme();
  grid.innerHTML = THEMES.map(t => `
    <button type="button" class="theme-card${t.id === current ? ' active' : ''}" data-theme-id="${t.id}" aria-pressed="${t.id === current}">
      <span class="theme-card-swatches">
        ${t.swatch.map(c => `<span class="theme-card-swatch" style="background:${c}"></span>`).join('')}
      </span>
      <span class="theme-card-label">${t.label}</span>
    </button>
  `).join('');
  grid.querySelectorAll('.theme-card').forEach(btn => {
    btn.onclick = () => {
      applyThemeSelection(btn.dataset.themeId, grid);
    };
  });
}

function applyThemeSelection(id, grid) {
  setTheme(id);
  if (grid) {
    grid.querySelectorAll('.theme-card').forEach(c => {
      const on = c.dataset.themeId === id;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  // Re-render dashboard so charts (donut/bar/line) pick up the new palette
  if (typeof renderDashboard === 'function') renderDashboard();
}

function bindSettingsAccordions() {
  document.querySelectorAll('.settings-section-header').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.settings-section').classList.toggle('open');
    });
  });
}

function renderSettings() {
  // Meta calórica + macros
  const g = getGoals();
  $('#set-calories').value = g.calories;
  $('#set-protein').value = g.protein;
  $('#set-carb').value = g.carb;
  $('#set-fat').value = g.fat;

  // Notificações — lembretes por refeição
  renderMealNotifications();

  // Streak toggle
  const n = readNotify();
  setToggle($('#set-toggle-streak'), n.streakEnabled);
  $('#set-streak-time').value = n.streakTime;

  // Tema (grade de 10 opções)
  renderThemeGrid();

  // Chave da API
  renderApiKeyField();

  // Sobre
  $('#about-version').textContent = APP_VERSION;
  $('#about-developer').textContent = DEVELOPER_CREDIT;

  bindSettingsToggles();
  bindMacroCalculation();
  bindApiKeyControls();
  bindSettingsAccordions();

  // Link "Perfil e plano alimentar" → Meu Plano
  document.querySelectorAll('[data-screen-link="diet"]').forEach(a => {
    a.onclick = (e) => {
      e.preventDefault();
      showScreen('diet');
    };
  });

  if (window.lucide) lucide.createIcons();
}

function bindSettingsToggles() {
  $('#set-toggle-streak').onclick = (e) => {
    const btn = e.currentTarget;
    setToggle(btn, btn.dataset.on === '0');
  };
}

// ============ PER-MEAL NOTIFICATIONS ============
function renderMealNotifications() {
  const container = $('#meal-notifications-container');
  const hint = $('#notif-hint');
  if (!container) return;
  const plan = getCurrentPlan();
  const saved = readNotify();
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
          <span class="toggle-title">${escapeHtml(r.nome)}</span>
          <span class="toggle-sub">~${r.kcalEstimada || 0} kcal</span>
        </div>
        <button class="toggle-switch" data-meal-toggle="${i}" data-on="${enabled ? '1' : '0'}" aria-pressed="${enabled ? 'true' : 'false'}" aria-label="Ativar lembrete ${escapeHtml(r.nome)}">
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="diet-field" style="margin-bottom:12px;">
        <label>${escapeHtml(r.nome)}</label>
        <input type="time" id="set-meal-time-${i}" value="${time}" />
      </div>
    `;
    container.appendChild(row);

    const toggleBtn = row.querySelector(`[data-meal-toggle="${i}"]`);
    toggleBtn.onclick = () => {
      setToggle(toggleBtn, toggleBtn.dataset.on === '0');
    };
  });
}

// ============ MACRO ↔ CALORIE BIDIRECTIONAL CALCULATION ============
const MACRO_ENERGIES = { protein: 4, carb: 4, fat: 9 };

function calcCaloriesFromMacros() {
  const p = Number($('#set-protein').value) || 0;
  const c = Number($('#set-carb').value) || 0;
  const f = Number($('#set-fat').value) || 0;
  return Math.round(p * MACRO_ENERGIES.protein + c * MACRO_ENERGIES.carb + f * MACRO_ENERGIES.fat);
}

function calcMacrosFromCalories(totalCal) {
  const p = Number($('#set-protein').value) || 0;
  const c = Number($('#set-carb').value) || 0;
  const f = Number($('#set-fat').value) || 0;
  const macroCalSum = p * MACRO_ENERGIES.protein + c * MACRO_ENERGIES.carb + f * MACRO_ENERGIES.fat;
  let rp, rc, rf;
  if (macroCalSum > 0) {
    rp = (p * MACRO_ENERGIES.protein) / macroCalSum;
    rc = (c * MACRO_ENERGIES.carb) / macroCalSum;
    rf = (f * MACRO_ENERGIES.fat) / macroCalSum;
  } else {
    rp = 0.30; rc = 0.40; rf = 0.30;
  }
  return {
    protein: Math.round((totalCal * rp) / MACRO_ENERGIES.protein),
    carb: Math.round((totalCal * rc) / MACRO_ENERGIES.carb),
    fat: Math.round((totalCal * rf) / MACRO_ENERGIES.fat),
  };
}

function bindMacroCalculation() {
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
      calInput.value = calcCaloriesFromMacros();
      lock = false;
    });
  });

  calInput.addEventListener('input', () => {
    if (lock) return;
    lock = true;
    const total = Number(calInput.value) || 0;
    const m = calcMacrosFromCalories(total);
    pInput.value = m.protein;
    cInput.value = m.carb;
    fInput.value = m.fat;
    lock = false;
  });
}

// ============ API KEY (OpenRouter) ============
function renderApiKeyField() {
  const input = $('#set-apikey');
  const badge = $('#api-status-badge');
  if (!input || !badge) return;
  // Não preenche o input com a chave real por segurança — apenas indica a origem.
  input.value = '';
  const source = getApiKeySource();
  if (source === 'localStorage') {
    badge.textContent = 'configurada';
    badge.dataset.state = 'ok';
  } else if (source === 'config') {
    badge.textContent = 'embutida (env)';
    badge.dataset.state = 'env';
  } else {
    badge.textContent = 'não configurada';
    badge.dataset.state = 'none';
  }
}

function bindApiKeyControls() {
  const input = $('#set-apikey');
  const toggle = $('#btn-toggle-apikey');
  const save = $('#btn-save-apikey');
  const clear = $('#btn-clear-apikey');
  if (!input || !toggle || !save || !clear) return;

  toggle.onclick = () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    toggle.setAttribute('aria-label', isPassword ? 'Ocultar chave' : 'Mostrar chave');
    toggle.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}"></i>`;
    if (window.lucide) lucide.createIcons();
  };

  save.onclick = () => {
    const value = (input.value || '').trim();
    if (value && value.length < 20) {
      toast('Chave muito curta. Verifique se copiou inteira.', true);
      return;
    }
    const ok = setApiKey(value);
    if (!ok) {
      toast('Não foi possível salvar a chave.', true);
      return;
    }
    input.value = '';
    input.type = 'password';
    toggle.innerHTML = '<i data-lucide="eye"></i>';
    if (window.lucide) lucide.createIcons();
    renderApiKeyField();
    toast(value ? 'Chave salva no navegador' : 'Chave embutida do app será usada');
  };

  clear.onclick = () => {
    if (!confirm('Remover a chave salva neste navegador?')) return;
    setApiKey('');
    input.value = '';
    input.type = 'password';
    toggle.innerHTML = '<i data-lucide="eye"></i>';
    if (window.lucide) lucide.createIcons();
    renderApiKeyField();
    toast('Chave removida deste navegador');
  };
}

function handleSaveSettings() {
  // 1) Metas diárias
  setGoals({
    calories: Number($('#set-calories').value) || 0,
    protein: Number($('#set-protein').value) || 0,
    carb: Number($('#set-carb').value) || 0,
    fat: Number($('#set-fat').value) || 0,
  });

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

  writeNotify({
    meals: mealNotifications,
    streakEnabled: $('#set-toggle-streak').dataset.on === '1',
    streakTime: $('#set-streak-time').value || DEFAULT_NOTIFY.streakTime,
  });

  // 3) Agendar notificações
  scheduleAllNotifications();

  // Reflete imediatamente no dashboard
  renderDashboard();
  toast('Configurações salvas');
}

function exportMealsJSON() {
  listarHistorico().then((groups) => {
    const flat = [];
    for (const g of groups) {
      for (const m of g.meals) {
        flat.push({
          date: g.day,
          createdAt: m.createdAt,
          total: m.total,
          alimentos: m.alimentos,
        });
      }
    }
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), meals: flat }, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `nutrifoto-historico-${new Date().toISOString().slice(0, 10)}.json`);
  });
}

function exportMealsCSV() {
  listarHistorico().then((groups) => {
    const rows = [['date', 'createdAt', 'alimentos', 'calorias', 'proteina_g', 'carboidrato_g', 'gordura_g']];
    for (const g of groups) {
      for (const m of g.meals) {
        const nomes = (m.alimentos || []).map(a => a.nome).join('; ');
        rows.push([
          g.day,
          m.createdAt,
          `"${nomes.replace(/"/g, '""')}"`,
          m.total?.calorias || 0,
          m.total?.proteina_g || 0,
          m.total?.carboidrato_g || 0,
          m.total?.gordura_g || 0,
        ]);
      }
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `nutrifoto-historico-${new Date().toISOString().slice(0, 10)}.csv`);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// ============ EDIT MEAL MODAL ============
async function openEditMealModal(mealId) {
  const all = await reqToPromiseIndexedDB();
  const meal = all.find(m => m.id === mealId);
  if (!meal) { toast('Refeição não encontrada', true); return; }

  const alimentos = JSON.parse(JSON.stringify(meal.alimentos));
  alimentos.forEach(a => ensureOriginals(a));

  const overlay = document.createElement('div');
  overlay.className = 'edit-overlay';
  overlay.innerHTML = `
    <div class="edit-modal">
      <div class="swap-modal-header">
        <h3>Editar Refeição</h3>
        <button class="swap-modal-close" id="edit-modal-close"><i data-lucide="x" style="width:18px;height:18px"></i></button>
      </div>
      <div class="edit-meal-info">
        <span class="edit-meal-info-time">🕐 ${formatTime(meal.createdAt)}</span>
        <span class="edit-meal-info-total" id="edit-total-header">— kcal</span>
      </div>
      <div class="edit-foods-list" id="edit-foods-list"></div>
      <button class="edit-add-food-btn" id="edit-add-food-btn">
        <i data-lucide="plus" style="width:14px;height:14px"></i> Adicionar alimento
      </button>
      <div class="edit-add-food-form" id="edit-add-food-form" style="display:none">
        <input type="text" class="edit-add-search" id="edit-add-search" placeholder="Buscar alimento..." />
        <div class="edit-add-suggestions" id="edit-add-suggestions"></div>
        <div class="edit-add-manual">
          <input type="text" class="edit-add-name" id="edit-add-name" placeholder="Nome do alimento" />
          <input type="number" class="edit-add-grams" id="edit-add-grams" placeholder="g" min="0" inputmode="numeric" />
        </div>
        <div class="edit-add-macros-row">
          <input type="number" class="edit-add-macro" id="edit-add-cal" placeholder="kcal" min="0" inputmode="numeric" />
          <input type="number" class="edit-add-macro" id="edit-add-prot" placeholder="P(g)" min="0" inputmode="numeric" />
          <input type="number" class="edit-add-macro" id="edit-add-carb" placeholder="C(g)" min="0" inputmode="numeric" />
          <input type="number" class="edit-add-macro" id="edit-add-gord" placeholder="G(g)" min="0" inputmode="numeric" />
        </div>
        <button class="btn-primary" id="edit-confirm-add" style="width:100%;margin-top:8px">
          <i data-lucide="plus" style="width:16px;height:16px"></i> Adicionar
        </button>
      </div>
      <div class="edit-modal-footer">
        <div class="edit-modal-totals" id="edit-modal-totals"></div>
        <button class="btn-primary" id="edit-save-btn">
          <i data-lucide="check" style="width:16px;height:16px"></i> Salvar alterações
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  const closeModal = () => overlay.remove();

  overlay.querySelector('#edit-modal-close').onclick = closeModal;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  function renderEditFoods() {
    const list = overlay.querySelector('#edit-foods-list');
    if (alimentos.length === 0) {
      list.innerHTML = '<p class="empty" style="padding:16px 0">Nenhum alimento. Adicione abaixo.</p>';
    } else {
      list.innerHTML = alimentos.map((f, idx) => `
        <div class="food-receipt" data-idx="${idx}">
          <div class="food-receipt-header">
            <input class="food-receipt-name" value="${escapeHtml(f.nome)}" data-field="nome" />
            <button class="food-receipt-remove" data-remove="${idx}">✕</button>
          </div>
          <div class="food-receipt-edit">
            <input class="food-receipt-grams" type="number" min="0" value="${f.porcao_estimada_g}" data-field="porcao_estimada_g" inputmode="numeric" />
            <span class="food-receipt-grams-label">gramas</span>
          </div>
          <div class="food-receipt-macros">
            <span><strong>${f.calorias}</strong> kcal</span>
            <span>P: <strong>${f.proteina_g}</strong>g</span>
            <span>C: <strong>${f.carboidrato_g}</strong>g</span>
            <span>G: <strong>${f.gordura_g}</strong>g</span>
          </div>
        </div>
      `).join('');

      list.querySelectorAll('.food-receipt').forEach(row => {
        const idx = Number(row.dataset.idx);
        const f = alimentos[idx];

        row.querySelector('[data-field="nome"]').oninput = (e) => { f.nome = e.target.value; };

        row.querySelector('[data-field="porcao_estimada_g"]').oninput = (e) => {
          const v = Number(e.target.value) || 0;
          f.porcao_estimada_g = v;
          const orig = f.porcao_original_g || f.porcao_estimada_g;
          if (orig > 0) {
            const ratio = v / orig;
            f.calorias = Math.round(f.calorias_original * ratio);
            f.proteina_g = Math.round(f.proteina_original * ratio);
            f.carboidrato_g = Math.round(f.carbo_original * ratio);
            f.gordura_g = Math.round(f.gordura_original * ratio);
            const macros = row.querySelector('.food-receipt-macros');
            macros.innerHTML = `
              <span><strong>${f.calorias}</strong> kcal</span>
              <span>P: <strong>${f.proteina_g}</strong>g</span>
              <span>C: <strong>${f.carboidrato_g}</strong>g</span>
              <span>G: <strong>${f.gordura_g}</strong>g</span>
            `;
          }
          updateEditTotals();
        };

        row.querySelector('[data-remove]').onclick = () => {
          alimentos.splice(idx, 1);
          renderEditFoods();
        };
      });
    }
    updateEditTotals();
  }

  function updateEditTotals() {
    const total = recalcularTotal(alimentos);
    const hdr = overlay.querySelector('#edit-total-header');
    const foot = overlay.querySelector('#edit-modal-totals');
    hdr.textContent = `${total.calorias} kcal`;
    foot.innerHTML = `
      <span>${total.calorias} kcal</span>
      <span>P: ${total.proteina_g}g</span>
      <span>C: ${total.carboidrato_g}g</span>
      <span>G: ${total.gordura_g}g</span>
    `;
  }

  renderEditFoods();

  // ---- Add food toggle ----
  overlay.querySelector('#edit-add-food-btn').onclick = () => {
    const form = overlay.querySelector('#edit-add-food-form');
    const show = form.style.display === 'none';
    form.style.display = show ? 'block' : 'none';
    if (show) overlay.querySelector('#edit-add-search').focus();
  };

  // ---- Search suggestions ----
  const allCats = getAllCategories();
  const userProfile = getUserProfile() || {};
  const allFoods = [];
  for (const cat of allCats) {
    for (const name of getAlternatives(cat, userProfile)) {
      if (!allFoods.find(f => f.name === name)) allFoods.push({ name, category: cat });
    }
  }
  // also add from lista completa
  const searchInput = overlay.querySelector('#edit-add-search');
  const sugBox = overlay.querySelector('#edit-add-suggestions');

  searchInput.oninput = () => {
    const q = searchInput.value.trim().toLowerCase();
    if (q.length < 2) { sugBox.innerHTML = ''; return; }
    const matches = allFoods.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
    sugBox.innerHTML = matches.map(m => `
      <button class="edit-sug-btn" data-name="${escapeHtml(m.name)}" data-cat="${escapeHtml(m.category)}">${escapeHtml(m.name)}</button>
    `).join('');
    sugBox.querySelectorAll('.edit-sug-btn').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelector('#edit-add-name').value = btn.dataset.name;
        searchInput.value = '';
        sugBox.innerHTML = '';
      };
    });
  };

  // ---- Confirm add ----
  overlay.querySelector('#edit-confirm-add').onclick = () => {
    const name = overlay.querySelector('#edit-add-name').value.trim();
    const grams = Number(overlay.querySelector('#edit-add-grams').value) || 0;
    if (!name || grams <= 0) { toast('Preencha nome e gramas', true); return; }
    const cal = Number(overlay.querySelector('#edit-add-cal').value) || 0;
    const prot = Number(overlay.querySelector('#edit-add-prot').value) || 0;
    const carb = Number(overlay.querySelector('#edit-add-carb').value) || 0;
    const gord = Number(overlay.querySelector('#edit-add-gord').value) || 0;
    const newFood = {
      nome: name,
      porcao_estimada_g: grams,
      porcao_original_g: grams,
      calorias: cal, calorias_original: cal,
      proteina_g: prot, proteina_original: prot,
      carboidrato_g: carb, carbo_original: carb,
      gordura_g: gord, gordura_original: gord,
    };
    alimentos.push(newFood);
    renderEditFoods();
    // reset form
    overlay.querySelector('#edit-add-name').value = '';
    overlay.querySelector('#edit-add-grams').value = '';
    overlay.querySelector('#edit-add-cal').value = '';
    overlay.querySelector('#edit-add-prot').value = '';
    overlay.querySelector('#edit-add-carb').value = '';
    overlay.querySelector('#edit-add-gord').value = '';
    overlay.querySelector('#edit-add-food-form').style.display = 'none';
    toast('Alimento adicionado');
  };

  // ---- Save ----
  overlay.querySelector('#edit-save-btn').onclick = async () => {
    if (alimentos.length === 0) {
      if (!confirm('Remover todos os alimentos? A refeição será excluída.')) return;
      await deletarRefeicao(mealId);
      closeModal();
      renderDashboard();
      toast('Refeição excluída');
      return;
    }
    const total = recalcularTotal(alimentos);
    const updated = { ...meal, alimentos, total };
    await atualizarRefeicao(mealId, updated);
    closeModal();
    renderDashboard();
    toast('Refeição atualizada');
  };
}

// helper: read all meals from IDB (for edit modal lookup)
function reqToPromiseIndexedDB() {
  return openIDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meals', 'readonly');
      const req = tx.objectStore('meals').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('nutrifoto', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ============ DIET PLAN (Meu Plano) ============
const RESTRICOES_OPTS = [
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'vegano', label: 'Vegano' },
  { value: 'sem_gluten', label: 'Sem gluten' },
  { value: 'sem_lactose', label: 'Sem lactose' },
  { value: 'low_carb', label: 'Low carb' },
  { value: 'nenhuma', label: 'Nenhuma' },
];

const TIPO_DIETA_OPTS = [
  { value: 'equilibrado', label: 'Equilibrado', desc: 'Balanceia sabor, praticidade e nutricao' },
  { value: 'sabor', label: 'Sabor & Prazer', desc: 'Mais variedade e prato gostoso' },
  { value: 'performance', label: 'Performance', desc: 'Timing de nutrientes e alimentos funcionais' },
  { value: 'praticidade', label: 'Praticidade', desc: 'Preparo rapido, poucos ingredientes' },
];

const OBJETIVO_LABEL = {
  perder_peso: 'Perda de peso',
  manter_peso: 'Manter peso',
  ganhar_massa: 'Ganhar massa muscular',
  melhorar_saude: 'Melhorar saude geral',
};

function getFormValues() {
  const v = (q) => document.querySelector(q);
  const chips = Array.from(document.querySelectorAll('.diet-chip.active')).map(c => c.dataset.value);
  const tipoDietaChip = document.querySelector('.diet-chip-tipo.active');
  return {
    idade: Number(v('#dp-idade')?.value) || 0,
    sexo: v('#dp-sexo')?.value || 'masculino',
    pesoAtual: Number(v('#dp-peso')?.value) || 0,
    altura: Number(v('#dp-altura')?.value) || 0,
    nivelAtividade: v('#dp-atividade')?.value || 'sedentario',
    objetivo: v('#dp-objetivo')?.value || 'manter_peso',
    pesoDesejado: v('#dp-peso-desejado')?.value || '',
    prazo: v('#dp-prazo')?.value || '',
    tipoDieta: tipoDietaChip?.dataset?.value || 'equilibrado',
    restricoes: chips.filter(c => c !== 'nenhuma'),
    restricoesTexto: v('#dp-alergias')?.value?.trim() || '',
    alimentosNaoGosta: v('#dp-nao-gosta')?.value?.trim() || '',
    alimentosFavoritos: v('#dp-favoritos')?.value?.trim() || '',
    refeicoesPorDia: Number(v('#dp-refeicoes')?.value) || 4,
    horarioAcorda: v('#dp-acorda')?.value || '07:00',
    horarioDorme: v('#dp-dorme')?.value || '23:00',
    rotinaTexto: v('#dp-rotina')?.value?.trim() || '',
    condicoesSaude: v('#dp-condicoes')?.value?.trim() || '',
  };
}

function setFormValues(profile) {
  const set = (q, val) => { const el = document.querySelector(q); if (el != null) el.value = val ?? ''; };
  set('#dp-idade', profile?.idade);
  set('#dp-sexo', profile?.sexo);
  set('#dp-peso', profile?.pesoAtual);
  set('#dp-altura', profile?.altura);
  set('#dp-atividade', profile?.nivelAtividade);
  set('#dp-objetivo', profile?.objetivo);
  set('#dp-peso-desejado', profile?.pesoDesejado);
  set('#dp-prazo', profile?.prazo);
  set('#dp-alergias', profile?.restricoesTexto);
  set('#dp-nao-gosta', profile?.alimentosNaoGosta);
  set('#dp-favoritos', profile?.alimentosFavoritos);
  set('#dp-refeicoes', profile?.refeicoesPorDia);
  set('#dp-acorda', profile?.horarioAcorda);
  set('#dp-dorme', profile?.horarioDorme);
  set('#dp-rotina', profile?.rotinaTexto);
  set('#dp-condicoes', profile?.condicoesSaude);
  const chips = document.querySelectorAll('.diet-chip');
  const r = new Set(profile?.restricoes || []);
  chips.forEach(c => c.classList.toggle('active', r.has(c.dataset.value)));
  const tipoChips = document.querySelectorAll('.diet-chip-tipo');
  tipoChips.forEach(c => c.classList.toggle('active', c.dataset.value === (profile?.tipoDieta || 'equilibrado')));
}

function renderDietForm(profile) {
  const container = $('#diet-form-content');
  container.innerHTML = `
    <div class="diet-disclaimer">
      <i data-lucide="alert-triangle"></i>
      <p>Este plano e gerado por IA e nao substitui orientacao de um nutricionista ou medico. Consulte um profissional antes de seguir qualquer dieta, especialmente se possuir condicoes de saude.</p>
    </div>

    <div class="diet-section">
      <div class="diet-section-title"><i data-lucide="user"></i> Dados pessoais</div>
      <div class="diet-grid-2">
        <div class="diet-field"><label>Idade</label><input type="number" id="dp-idade" min="10" max="120" placeholder="ex: 30" /></div>
        <div class="diet-field"><label>Sexo</label><select id="dp-sexo"><option value="masculino">Masculino</option><option value="feminino">Feminino</option></select></div>
        <div class="diet-field"><label>Peso (kg)</label><input type="number" id="dp-peso" min="20" max="300" step="0.1" placeholder="ex: 75" /></div>
        <div class="diet-field"><label>Altura (cm)</label><input type="number" id="dp-altura" min="100" max="250" placeholder="ex: 175" /></div>
      </div>
      <div class="diet-field">
        <label>Nivel de atividade</label>
        <select id="dp-atividade">
          <option value="sedentario">Sedentario (pouco ou nenhum exercicio)</option>
          <option value="leve">Leve (1-3x por semana)</option>
          <option value="moderado">Moderado (3-5x por semana)</option>
          <option value="intenso">Intenso (6-7x por semana)</option>
          <option value="atleta">Atleta (2x ao dia ou trabalho fisico pesado)</option>
        </select>
      </div>
    </div>

    <div class="diet-section">
      <div class="diet-section-title"><i data-lucide="target"></i> Objetivo</div>
      <div class="diet-field">
        <label>Meta principal</label>
        <select id="dp-objetivo">
          <option value="perder_peso">Perder peso</option>
          <option value="manter_peso">Manter peso</option>
          <option value="ganhar_massa">Ganhar massa muscular</option>
          <option value="melhorar_saude">Melhorar saude geral</option>
        </select>
      </div>
      <div class="diet-grid-2">
        <div class="diet-field"><label>Peso desejado (kg)</label><input type="number" id="dp-peso-desejado" min="20" max="300" step="0.1" placeholder="opcional" /></div>
        <div class="diet-field"><label>Prazo</label><input type="text" id="dp-prazo" placeholder="ex: 3 meses" /></div>
      </div>
    </div>

    <div class="diet-section">
      <div class="diet-section-title"><i data-lucide="chef-hat"></i> Tipo de Dieta</div>
      <div class="diet-field">
        <label>Perfil alimentar</label>
        <div class="diet-chips" id="dp-chips-tipo">
          ${TIPO_DIETA_OPTS.map(o => `<span class="diet-chip diet-chip-tipo" data-value="${o.value}"><strong>${o.label}</strong><span class="tipo-desc">${o.desc}</span></span>`).join('')}
        </div>
        <div class="diet-section-hint">Influencia quais alimentos sao sugeridos no plano.</div>
      </div>
    </div>

    <div class="diet-section">
      <div class="diet-section-title"><i data-lucide="utensils"></i> Restricoes e preferencias</div>
      <div class="diet-field">
        <label>Restricoes alimentares</label>
        <div class="diet-chips" id="dp-chips">
          ${RESTRICOES_OPTS.map(o => `<span class="diet-chip" data-value="${o.value}">${o.label}</span>`).join('')}
        </div>
      </div>
      <div class="diet-field">
        <label>Alergias alimentares</label>
        <input type="text" id="dp-alergias" placeholder="ex: amendoim, frutos do mar" />
      </div>
      <div class="diet-field">
        <label>Alimentos que nao gosta / nao come</label>
        <textarea id="dp-nao-gosta" placeholder="ex: berinjela, figado"></textarea>
      </div>
      <div class="diet-field">
        <label>Alimentos favoritos (opcional)</label>
        <textarea id="dp-favoritos" placeholder="ex: frango, batata-doce, aveia"></textarea>
      </div>
    </div>

    <div class="diet-section">
      <div class="diet-section-title"><i data-lucide="clock"></i> Rotina</div>
      <div class="diet-grid-3">
        <div class="diet-field"><label>Refeicoes/dia</label><select id="dp-refeicoes"><option>3</option><option>4</option><option selected>5</option><option>6</option></select></div>
        <div class="diet-field"><label>Acorda</label><input type="time" id="dp-acorda" value="07:00" /></div>
        <div class="diet-field"><label>Dorme</label><input type="time" id="dp-dorme" value="23:00" /></div>
      </div>
      <div class="diet-field">
        <label>Compromissos fixos que afetam refeicoes</label>
        <textarea id="dp-rotina" placeholder="ex: almoco so depois das 13h por causa do trabalho"></textarea>
      </div>
    </div>

    <div class="diet-section">
      <div class="diet-section-title"><i data-lucide="heart-pulse"></i> Condicoes de saude (opcional)</div>
      <div class="diet-field">
        <textarea id="dp-condicoes" placeholder="ex: diabetes tipo 2, hipertensao, problema renal"></textarea>
        <div class="diet-section-hint">Se tiver alguma condicao, consulte um medico/nutricionista antes de seguir o plano.</div>
      </div>
    </div>

    <div class="sticky-save">
      <button class="btn-primary" id="btn-generate-plan">
        <i data-lucide="sparkles" style="width:18px;height:18px"></i> Gerar meu plano
      </button>
    </div>
  `;

  container.querySelectorAll('.diet-chip').forEach(chip => {
    chip.onclick = () => {
      const val = chip.dataset.value;
      if (val === 'nenhuma') {
        container.querySelectorAll('.diet-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        return;
      }
      const nenhuma = container.querySelector('.diet-chip[data-value="nenhuma"]');
      if (nenhuma) nenhuma.classList.remove('active');
      chip.classList.toggle('active');
      const anyActive = container.querySelectorAll('.diet-chip.active').length > 0;
      if (!anyActive && nenhuma) nenhuma.classList.add('active');
    };
  });

  container.querySelectorAll('.diet-chip-tipo').forEach(chip => {
    chip.onclick = () => {
      container.querySelectorAll('.diet-chip-tipo').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    };
  });

  $('#btn-generate-plan').onclick = handleGeneratePlan;

  if (profile) setFormValues(profile);
  if (window.lucide) lucide.createIcons();
}

function renderDietPlan(plan, profile) {
  $('#plan-tdee-val').textContent = plan.tdee;
  $('#plan-meta-val').textContent = plan.metaCalorica;
  $('#plan-objective').textContent = OBJETIVO_LABEL[profile.objetivo] || profile.objetivo;

  const totals = {
    proteina_g: plan.macros.proteina,
    carboidrato_g: plan.macros.carboidrato,
    gordura_g: plan.macros.gordura,
  };
  updateMacroBars(totals, totals);

  const timeline = $('#plan-meals-timeline');
  timeline.innerHTML = plan.refeicoes.map((r, ri) => `
    <div class="plan-meal-card">
      <div class="plan-meal-header">
        <span class="plan-meal-name">${escapeHtml(r.nome)}</span>
        <span class="plan-meal-time">${escapeHtml(r.horario)}</span>
      </div>
      <div class="plan-meal-items">
        ${(r.itens || []).map((item, ii) => `
          <div class="plan-meal-item" data-refei="${ri}" data-item="${ii}">
            <div class="plan-meal-item-info">
              <span class="plan-meal-item-name">${escapeHtml(item.alimento)}</span>
              ${item.quantidade ? `<span class="plan-meal-item-qty">${escapeHtml(item.quantidade)}</span>` : ''}
            </div>
            <button class="plan-meal-swap-btn" data-refei="${ri}" data-item="${ii}" aria-label="Trocar alimento">
              <i data-lucide="refresh-cw" style="width:14px;height:14px"></i>
            </button>
          </div>
        `).join('')}
      </div>
      <span class="plan-meal-kcal">~${r.kcalEstimada} kcal</span>
    </div>
  `).join('');

  timeline.querySelectorAll('.plan-meal-swap-btn').forEach(btn => {
    btn.onclick = () => {
      const ri = Number(btn.dataset.refei);
      const ii = Number(btn.dataset.item);
      openSwapModal(ri, ii, plan);
    };
  });

  if (window.lucide) lucide.createIcons();
}

// ============ SWAP FOOD MODAL ============
function openSwapModal(refeiIdx, itemIdx, plan) {
  const item = plan.refeicoes[refeiIdx]?.itens?.[itemIdx];
  if (!item) return;
  const userProfile = getUserProfile() || {};
  const alternatives = getAlternatives(item.categoria || 'outro', userProfile);
  const overlay = document.createElement('div');
  overlay.className = 'swap-overlay';
  overlay.innerHTML = `
    <div class="swap-modal">
      <div class="swap-modal-header">
        <h3>Trocar alimento</h3>
        <button class="swap-modal-close" id="swap-modal-close"><i data-lucide="x" style="width:18px;height:18px"></i></button>
      </div>
      <div class="swap-modal-current">
        <span class="swap-modal-label">Atual:</span>
        <span class="swap-modal-current-name">${escapeHtml(item.alimento)}</span>
        ${item.quantidade ? `<span class="swap-modal-current-qty">${escapeHtml(item.quantidade)}</span>` : ''}
      </div>
      <div class="swap-modal-section">
        <span class="swap-modal-section-title">Alternativas (${escapeHtml(item.categoria || 'outro')})</span>
        <div class="swap-modal-list">
          ${alternatives.map(alt => `
            <button class="swap-modal-option" data-alt="${escapeHtml(alt)}">${escapeHtml(alt)}</button>
          `).join('')}
        </div>
      </div>
      <div class="swap-modal-section">
        <span class="swap-modal-section-title">Observacao (opcional)</span>
        <input type="text" class="swap-modal-note" id="swap-note" placeholder="ex: nao gosto de peixe" />
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  const closeModal = () => overlay.remove();

  overlay.querySelector('#swap-modal-close').onclick = closeModal;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  overlay.querySelectorAll('.swap-modal-option').forEach(btn => {
    btn.onclick = () => {
      const newAlimento = btn.dataset.alt;
      const note = overlay.querySelector('#swap-note')?.value?.trim() || '';

      plan.refeicoes[refeiIdx].itens[itemIdx].alimento = newAlimento;
      if (note) plan.refeicoes[refeiIdx].itens[itemIdx].observacao = note;

      saveCurrentPlan(plan);
      renderDietPlan(plan, getUserProfile());
      toast('Alimento substituido');
      closeModal();
    };
  });
}

function renderDiet() {
  const profile = getUserProfile();
  const plan = getCurrentPlan();
  const formContainer = $('#diet-form-container');
  const planView = $('#diet-plan-view');

  if (plan && profile) {
    formContainer.style.display = 'none';
    planView.style.display = 'block';
    renderDietPlan(plan, profile);
  } else {
    formContainer.style.display = 'block';
    planView.style.display = 'none';
    renderDietForm(profile);
  }
}

async function handleGeneratePlan() {
  const profile = getFormValues();

  if (!profile.idade || !profile.pesoAtual || !profile.altura) {
    toast('Preencha idade, peso e altura', true);
    return;
  }

  saveUserProfile(profile);

  $('#diet-form-container').style.display = 'none';
  $('#diet-plan-view').style.display = 'none';
  $('#diet-skeleton').style.display = 'block';
  startBowlText('#bowl-text-diet', BOWL_MESSAGES_DIET);

  try {
    const plan = await gerarPlanoAlimentar(profile);
    saveCurrentPlan(plan);
    renderDietPlan(plan, profile);
    $('#diet-skeleton').style.display = 'none';
    stopBowlText();
    $('#diet-plan-view').style.display = 'block';
    toast('Plano gerado!');
  } catch (e) {
    $('#diet-skeleton').style.display = 'none';
    stopBowlText();
    $('#diet-form-container').style.display = 'block';
    toast(e.message || 'Erro ao gerar plano', true);
  }
}

function handleApplyGoals() {
  const plan = getCurrentPlan();
  if (!plan) return;
  setGoals({
    calories: plan.metaCalorica,
    protein: plan.macros.proteina,
    carb: plan.macros.carboidrato,
    fat: plan.macros.gordura,
  });
  showConfirmation();
  setTimeout(() => showScreen('settings'), 1500);
}

function handleShowForm() {
  $('#diet-plan-view').style.display = 'none';
  $('#diet-form-container').style.display = 'block';
  renderDietForm(getUserProfile());
}

function handleRegenPlan() {
  handleGeneratePlan();
}

// ============ NOTIFICATION SCHEDULING ============
const _notifTimers = [];

function scheduleAllNotifications() {
  _notifTimers.forEach(id => clearTimeout(id));
  _notifTimers.length = 0;
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }

  const prefs = readNotify();
  const now = new Date();

  (prefs.meals || []).forEach(m => {
    if (!m.enabled) return;
    const [h, min] = (m.time || '12:00').split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, min, 0, 0);
    let delay = target.getTime() - now.getTime();
    if (delay < 0) delay += 24 * 60 * 60 * 1000;
    const tid = setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('NutriFoto — Hora do(a) ' + m.name + '!', {
          body: 'Não esqueça de registrar sua refeição.',
          icon: 'icons/icon-192.png',
        });
      }
    }, delay);
    _notifTimers.push(tid);
  });

  if (prefs.streakEnabled) {
    const [h, min] = (prefs.streakTime || '20:00').split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, min, 0, 0);
    let delay = target.getTime() - now.getTime();
    if (delay < 0) delay += 24 * 60 * 60 * 1000;
    const tid = setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('NutriFoto — Cuidado com a streak!', {
          body: 'Registre sua última refeição do dia para manter a sequência.',
          icon: 'icons/icon-192.png',
        });
      }
    }, delay);
    _notifTimers.push(tid);
  }
}

// ============ INIT ============
function bind() {
  $$('.nav-btn').forEach(b => {
    b.addEventListener('click', () => showScreen(b.dataset.screen));
  });
  $('#btn-add-meal').addEventListener('click', () => { setCaptureImage(null); showScreen('capture'); });
  $('#btn-camera').addEventListener('click', () => handleImage(captureFromCamera));
  $('#btn-gallery').addEventListener('click', () => handleImage(pickFromGallery));
  $('#btn-analyze').addEventListener('click', handleAnalyze);
  $('#btn-back-analyze').addEventListener('click', () => showScreen('capture'));
  $('#btn-save-meal').addEventListener('click', handleSaveMeal);
  $('#btn-save-settings').addEventListener('click', handleSaveSettings);
  $('#btn-export-json').addEventListener('click', exportMealsJSON);
  $('#btn-export-csv').addEventListener('click', exportMealsCSV);
  $('#btn-cancel-capture').addEventListener('click', () => showScreen('dashboard'));
  $('#btn-toggle-theme').addEventListener('click', toggleTheme);
  $('#btn-expand-charts').addEventListener('click', toggleCharts);
  $('#mini-chart-bar').addEventListener('click', toggleCharts);
  $('#btn-edit-profile').addEventListener('click', handleShowForm);
  $('#btn-edit-form').addEventListener('click', handleShowForm);
  $('#btn-apply-goals').addEventListener('click', handleApplyGoals);
  $('#btn-regen-plan').addEventListener('click', handleRegenPlan);
}

document.addEventListener('DOMContentLoaded', () => {
  setTheme(getTheme());
  bind();
  renderDashboard();
  scheduleAllNotifications();
  if (window.lucide) lucide.createIcons();
});
