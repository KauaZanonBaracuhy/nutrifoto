// charts.js — v2: hero donut, macro bars, mini bar, bar chart, line chart

// Temas com fundo predominantemente claro recebem paleta de grafico "light".
// Demais temas usam a paleta dark, que ja cobre o caso padrao.
const LIGHT_THEMES = new Set(['gelo', 'minimalista']);

function isDark() {
  const t = document.documentElement.getAttribute('data-theme');
  return !LIGHT_THEMES.has(t);
}

function getColors() {
  return {
    green: isDark() ? '#10B981' : '#059669',
    greenDim: isDark() ? 'rgba(16,185,129,0.15)' : 'rgba(5,150,105,0.1)',
    amber: isDark() ? '#F59E0B' : '#D97706',
    amberDim: isDark() ? 'rgba(245,158,11,0.15)' : 'rgba(217,119,6,0.1)',
    red: isDark() ? '#EF4444' : '#DC2626',
    redDim: isDark() ? 'rgba(239,68,68,0.15)' : 'rgba(220,38,38,0.08)',
    purple: isDark() ? '#8B5CF6' : '#7C3AED',
    purpleDim: isDark() ? 'rgba(139,92,246,0.15)' : 'rgba(124,58,237,0.1)',
    muted: isDark() ? '#7A9A8B' : '#94A3B8',
    surface: isDark() ? '#162019' : '#FFFFFF',
    text: isDark() ? '#E8F5EF' : '#0F172A',
    metaBar: isDark() ? 'rgba(16,185,129,0.2)' : '#0F172A',
    border: isDark() ? '#243830' : '#D1E7DF',
    track: isDark() ? '#1E2D25' : '#E4F0EB',
  };
}

function getStatusColor(pct) {
  if (pct > 1) return getColors().red;
  if (pct > 0.85) return getColors().amber;
  return getColors().green;
}

// ============================================================
// HERO DONUT — single large calorie ring
// ============================================================

let heroDonut = null;

function updateHeroDonut(value, goal) {
  const canvas = document.getElementById('donut-hero');
  if (!canvas) return;
  const c = getColors();
  const over = value > goal && goal > 0;
  const color = over ? c.red : c.green;
  const colorDim = over ? c.redDim : c.greenDim;
  const pct = goal > 0 ? Math.min(value / goal, 1.5) : 0;

  if (heroDonut) {
    heroDonut.data.datasets[0].data = [value, Math.max(0, goal - value)];
    heroDonut.data.datasets[0].backgroundColor[0] = color;
    heroDonut.data.datasets[0].backgroundColor[1] = colorDim;
    heroDonut.update();
    return;
  }

  heroDonut = new Chart(canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [value, Math.max(0, goal - value)],
        backgroundColor: [color, colorDim],
        borderWidth: 0,
        cutout: '82%',
        borderRadius: 8,
      }],
    },
    options: {
      responsive: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { animateRotate: true, duration: 1000, easing: 'easeOutQuart' },
    },
  });
}

// ============================================================
// MACRO BARS — horizontal bar rows (protein, carb, fat)
// ============================================================

function updateMacroBars(totals, goals) {
  const container = document.getElementById('macro-bars');
  if (!container) return;

  const items = [
    { key: 'proteina_g', goal: goals.protein, label: 'P', color: '#8B5CF6' },
    { key: 'carboidrato_g', goal: goals.carb, label: 'C', color: '#F59E0B' },
    { key: 'gordura_g', goal: goals.fat, label: 'G', color: '#EF4444' },
  ];

  container.innerHTML = items.map(item => {
    const value = totals[item.key] || 0;
    const pct = item.goal > 0 ? Math.min((value / item.goal) * 100, 100) : 0;
    const statusPct = item.goal > 0 ? value / item.goal : 0;
    const statusClass = statusPct > 1 ? 'status-over' : statusPct > 0.85 ? 'status-warn' : 'status-ok';
    const fillColor = statusPct > 1 ? getColors().red : statusPct > 0.85 ? getColors().amber : item.color;

    return `
      <div class="macro-bar-row">
        <span class="macro-bar-label">${item.label}</span>
        <div class="macro-bar-track">
          <div class="macro-bar-fill ${statusClass}" style="width:${pct}%;background:${fillColor}"></div>
        </div>
        <span class="macro-bar-value">${value}g</span>
        <span class="macro-bar-pct">${Math.round(pct)}%</span>
      </div>
    `;
  }).join('');
}

// ============================================================
// MINI BAR — thin strip always visible (7 days)
// ============================================================

function renderMiniBar(dailyData, goal) {
  const container = document.getElementById('mini-chart-bar');
  if (!container) return;
  const c = getColors();
  const maxVal = Math.max(...dailyData.map(d => d.calorias), goal, 1);

  container.innerHTML = dailyData.map(d => {
    const h = maxVal > 0 ? (d.calorias / maxVal) * 100 : 0;
    const over = goal > 0 && d.calorias > goal;
    const near = goal > 0 && d.calorias > goal * 0.85;
    const color = over ? c.red : near ? c.amber : c.green;
    return `<div class="mini-bar" style="height:${Math.max(h, 4)}%;background:${color}"></div>`;
  }).join('');
}

// ============================================================
// BAR CHART — 7 days calories (full, expanded)
// ============================================================

let barChart = null;

function renderBarChart(dailyData, goal) {
  const canvas = document.getElementById('chart-bars');
  if (!canvas) return;
  const c = getColors();
  const labels = dailyData.map(d => {
    const dt = new Date(d.day + 'T12:00:00');
    return dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
  });
  const actuals = dailyData.map(d => d.calorias);
  const goalsArr = dailyData.map(() => goal);

  if (barChart) {
    barChart.data.labels = labels;
    barChart.data.datasets[0].data = actuals;
    barChart.data.datasets[1].data = goalsArr;
    barChart.data.datasets[0].backgroundColor = actuals.map(v =>
      v > goal ? c.red : v > goal * 0.85 ? c.amber : c.green
    );
    barChart.update();
    return;
  }

  barChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Realizado',
          data: actuals,
          backgroundColor: actuals.map(v =>
            v > goal ? c.red : v > goal * 0.85 ? c.amber : c.green
          ),
          borderRadius: 8,
          borderSkipped: false,
          barPercentage: 0.55,
          categoryPercentage: 0.7,
        },
        {
          label: 'Meta',
          data: goalsArr,
          backgroundColor: c.metaBar,
          borderRadius: 8,
          borderSkipped: false,
          barPercentage: 0.55,
          categoryPercentage: 0.7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: c.muted, font: { size: 11, family: "'Plus Jakarta Sans'" } },
        },
        y: {
          grid: { color: c.border, lineWidth: 0.5 },
          border: { display: false },
          ticks: { color: c.muted, font: { size: 11, family: "'Plus Jakarta Sans'" } },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.surface,
          titleColor: c.text,
          bodyColor: c.text,
          borderColor: c.border,
          borderWidth: 1,
          cornerRadius: 10,
          padding: 12,
          titleFont: { weight: '700', family: "'Plus Jakarta Sans'" },
          bodyFont: { family: "'Plus Jakarta Sans'" },
          displayColors: false,
        },
      },
      animation: { duration: 900, easing: 'easeOutQuart' },
    },
  });
}

// ============================================================
// LINE CHART — protein over time (full, expanded)
// ============================================================

let lineChart = null;

function renderLineChart(dailyData, goal) {
  const canvas = document.getElementById('chart-line');
  if (!canvas) return;
  const c = getColors();
  const labels = dailyData.map(d => {
    const dt = new Date(d.day + 'T12:00:00');
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  });
  const values = dailyData.map(d => d.proteina_g);

  if (lineChart) {
    lineChart.data.labels = labels;
    lineChart.data.datasets[0].data = values;
    lineChart.data.datasets[1].data = dailyData.map(() => goal);
    lineChart.update();
    return;
  }

  lineChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Proteína',
          data: values,
          borderColor: c.purple,
          backgroundColor: c.purpleDim,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: c.purple,
          pointBorderColor: c.surface,
          pointBorderWidth: 2,
          borderWidth: 2.5,
        },
        {
          label: 'Meta',
          data: dailyData.map(() => goal),
          borderColor: c.muted,
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: c.muted, font: { size: 11, family: "'Plus Jakarta Sans'" } },
        },
        y: {
          grid: { color: c.border, lineWidth: 0.5 },
          border: { display: false },
          ticks: { color: c.muted, font: { size: 11, family: "'Plus Jakarta Sans'" } },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.surface,
          titleColor: c.text,
          bodyColor: c.text,
          borderColor: c.border,
          borderWidth: 1,
          cornerRadius: 10,
          padding: 12,
          titleFont: { weight: '700', family: "'Plus Jakarta Sans'" },
          bodyFont: { family: "'Plus Jakarta Sans'" },
          displayColors: false,
        },
      },
      animation: { duration: 900, easing: 'easeOutQuart' },
    },
  });
}

export { updateHeroDonut, updateMacroBars, renderMiniBar, renderBarChart, renderLineChart };
