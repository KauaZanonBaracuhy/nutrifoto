// app.js — v2 layout: hero donut, macro bars, mini chart, FAB, timeline, receipt
import { getGoals, setGoals, isConfigured, getApiKey } from './storage.js';
import { salvarRefeicao, listarRefeicoesDoDia, listarHistorico, deletarRefeicao, listarTotaisPorDia } from './db.js';
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

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
  currentImage: null,
  currentAnalysis: null,
  chartsExpanded: false,
};

// ============ THEME ============
function getTheme() { return localStorage.getItem('nutrifoto.theme') || 'dark'; }
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('nutrifoto.theme', t);
}
function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }

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
    toast('Configure sua chave da OpenRouter em Configurações', true);
    showScreen('settings');
    return;
  }
  const btn = $('#btn-analyze');
  btn.disabled = true;
  const skeleton = $('#skeleton-loading');
  skeleton.style.display = 'block';
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
              <div class="timeline-meal">
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
}

// ============ SETTINGS ============
function renderSettings() {
  const g = getGoals();
  $('#goal-calories').value = g.calories;
  $('#goal-protein').value = g.protein;
  $('#goal-carb').value = g.carb;
  $('#goal-fat').value = g.fat;
  $('#test-result').style.display = 'none';

  // Pré-preencher campo de API key (mascarado) se já houver chave salva
  const apiKeyInput = $('#api-key-input');
  if (apiKeyInput) {
    const existing = getApiKey();
    if (existing) {
      apiKeyInput.value = maskKey(existing);
      apiKeyInput.dataset.masked = '1';
    } else {
      apiKeyInput.value = '';
      apiKeyInput.dataset.masked = '0';
    }
    apiKeyInput.type = 'password';
    const eyeOn = apiKeyInput.parentElement.querySelector('.icon-eye');
    const eyeOff = apiKeyInput.parentElement.querySelector('.icon-eye-off');
    if (eyeOn) eyeOn.style.display = '';
    if (eyeOff) eyeOff.style.display = 'none';
    $('#api-key-status').style.display = 'none';
  }
}

function maskKey(key) {
  if (!key || key.length < 12) return key;
  return key.substring(0, 7) + '••••••••••••' + key.substring(key.length - 4);
}

function handleSaveApiKey() {
  const input = $('#api-key-input');
  const status = $('#api-key-status');
  let raw = input.value.trim();

  // Se está mascarado, não salvar
  if (raw.includes('••')) {
    status.style.display = 'block';
    status.className = 'test-result success';
    status.textContent = '✓ Chave já está salva (mascarada). Edite o campo para alterar.';
    return;
  }

  if (!raw) {
    setApiKey('');
    status.style.display = 'block';
    status.className = 'test-result error';
    status.textContent = 'Chave removida. Análise de imagem ficará desabilitada.';
    input.dataset.masked = '0';
    return;
  }

  if (!raw.startsWith('sk-or-')) {
    status.style.display = 'block';
    status.className = 'test-result error';
    status.textContent = '✗ Formato inválido. Chave deve começar com "sk-or-".';
    return;
  }

  const ok = setApiKey(raw);
  if (ok) {
    status.style.display = 'block';
    status.className = 'test-result success';
    status.textContent = '✓ Chave salva neste dispositivo.';
    input.value = maskKey(raw);
    input.dataset.masked = '1';
  } else {
    status.style.display = 'block';
    status.className = 'test-result error';
    status.textContent = '✗ Não foi possível salvar.';
  }
}

function handleToggleApiKey() {
  const input = $('#api-key-input');
  const eyeOn = $('#btn-toggle-api-key').querySelector('.icon-eye');
  const eyeOff = $('#btn-toggle-api-key').querySelector('.icon-eye-off');
  if (input.type === 'password') {
    input.type = 'text';
    eyeOn.style.display = 'none';
    eyeOff.style.display = '';
  } else {
    input.type = 'password';
    eyeOn.style.display = '';
    eyeOff.style.display = 'none';
  }
}

function handleSaveSettings() {
  setGoals({
    calories: Number($('#goal-calories').value) || 0,
    protein: Number($('#goal-protein').value) || 0,
    carb: Number($('#goal-carb').value) || 0,
    fat: Number($('#goal-fat').value) || 0,
  });
  toast('Metas salvas');
}

async function handleTestConnection() {
  const btn = $('#btn-test-connection');
  const result = $('#test-result');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" style="width:16px;height:16px"></i> Testando...';
  result.style.display = 'none';

  try {
    const res = await testConnection();
    result.style.display = 'block';
    if (res.ok) {
      result.className = 'test-result success';
      result.textContent = '✓ ' + (res.message || 'Conexão OK!');
    } else {
      result.className = 'test-result error';
      result.textContent = '✗ ' + (res.error || 'Erro desconhecido');
    }
  } catch (e) {
    result.style.display = 'block';
    result.className = 'test-result error';
    result.textContent = '✗ ' + e.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="wifi" style="width:16px;height:16px"></i> Testar conexão';
    if (window.lucide) lucide.createIcons();
  }
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

const OBJETIVO_LABEL = {
  perder_peso: 'Perda de peso',
  manter_peso: 'Manter peso',
  ganhar_massa: 'Ganhar massa muscular',
  melhorar_saude: 'Melhorar saude geral',
};

function getFormValues() {
  const v = (q) => document.querySelector(q);
  const chips = Array.from(document.querySelectorAll('.diet-chip.active')).map(c => c.dataset.value);
  return {
    idade: Number(v('#dp-idade')?.value) || 0,
    sexo: v('#dp-sexo')?.value || 'masculino',
    pesoAtual: Number(v('#dp-peso')?.value) || 0,
    altura: Number(v('#dp-altura')?.value) || 0,
    nivelAtividade: v('#dp-atividade')?.value || 'sedentario',
    objetivo: v('#dp-objetivo')?.value || 'manter_peso',
    pesoDesejado: v('#dp-peso-desejado')?.value || '',
    prazo: v('#dp-prazo')?.value || '',
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
  timeline.innerHTML = plan.refeicoes.map(r => `
    <div class="plan-meal-card">
      <div class="plan-meal-header">
        <span class="plan-meal-name">${escapeHtml(r.nome)}</span>
        <span class="plan-meal-time">${escapeHtml(r.horario)}</span>
      </div>
      <div class="plan-meal-suggestion">${escapeHtml(r.sugestao)}</div>
      <span class="plan-meal-kcal">~${r.kcalEstimada} kcal</span>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
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

  try {
    const plan = await gerarPlanoAlimentar(profile);
    saveCurrentPlan(plan);
    renderDietPlan(plan, profile);
    $('#diet-skeleton').style.display = 'none';
    $('#diet-plan-view').style.display = 'block';
    toast('Plano gerado!');
  } catch (e) {
    $('#diet-skeleton').style.display = 'none';
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
  $('#btn-test-connection').addEventListener('click', handleTestConnection);
  $('#btn-save-api-key').addEventListener('click', handleSaveApiKey);
  $('#btn-toggle-api-key').addEventListener('click', handleToggleApiKey);
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
  if (window.lucide) lucide.createIcons();
});
