import { getGoals, obterContaArmazenamento } from "./storage.js";
import { listarHistorico } from "./db.js";
import { $, formatarHorario, formatarData, escaparHtml, obterDiaAtual } from "./base.js";
import { abrirEdicaoRefeicao } from "./edicao.js";
// ============ HISTORY — Timeline ============
export function obterClasseMeta(dayTotal, goals) {
  if (dayTotal === 0) return 'status-empty';
  if (goals.calories > 0) {
    const pct = dayTotal / goals.calories;
    if (pct > 1) return 'status-over';
    if (pct > 0.85) return 'status-warn';
  }
  return 'status-ok';
}

export async function renderizarHistorico(gruposAnteriores = []) {
  const contaInicial=obterContaArmazenamento();
  const novosGrupos = await listarHistorico({antesDe:gruposAnteriores.at(-1)?.day,limiteDias:30});
  if(contaInicial!==obterContaArmazenamento())return;
  const groups = [...gruposAnteriores,...novosGrupos];
  const goals = getGoals();
  const list = $('#history-list');

  if (groups.length === 0) {
    list.innerHTML = '<p class="empty">Nenhuma refeição registrada ainda.</p>';
    return;
  }

  const todayStr = obterDiaAtual();

  list.innerHTML = `<div class="timeline">${groups.map(g => {
    const dayTotal = g.meals.reduce((acc, m) => acc + (m.requerRevisao ? 0 : Number(m.total?.calorias) || 0), 0);
    const macroTotal = g.meals.reduce((acc, m) => {
      acc.proteina_g += m.total?.proteina_g || 0;
      acc.carboidrato_g += m.total?.carboidrato_g || 0;
      return acc;
    }, { proteina_g: 0, carboidrato_g: 0 });

    const statusClass = obterClasseMeta(dayTotal, goals);
    const isToday = g.day === todayStr;
    const dayLabel = isToday ? 'Hoje' : formatarData(g.day + 'T12:00:00');

    return `
      <div class="timeline-day" data-day="${escaparHtml(g.day)}">
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
              <div class="timeline-meal" data-meal-id="${escaparHtml(m.id)}">
                <span class="timeline-meal-time">${formatarHorario(m.createdAt)}</span>
                <span class="timeline-meal-name">${m.alimentos.length > 0 ? m.alimentos.map(a => escaparHtml(a.nome)).join(', ') : 'Sem alimentos'}</span>
                <span class="timeline-meal-kcal">${escaparHtml(m.total?.calorias || 0)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('')}</div>`;

  if(novosGrupos.length===30){const carregar=document.createElement('button');carregar.className='btn-secondary';carregar.textContent='Carregar dias anteriores';carregar.onclick=()=>renderizarHistorico(groups);list.append(carregar);}
  list.querySelectorAll('.timeline-day-header').forEach(h => {
    h.setAttribute('role','button');h.tabIndex=0;h.setAttribute('aria-expanded','false');
    h.onclick = () => {const aberto=h.parentElement.classList.toggle('open');h.setAttribute('aria-expanded',String(aberto));};
    h.onkeydown=evento=>{if(evento.key==='Enter'||evento.key===' '){evento.preventDefault();h.click();}};
  });

  list.querySelectorAll('.timeline-meal').forEach(el => {
    el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-label','Editar refeição '+el.querySelector('.timeline-meal-name').textContent);
    el.onkeydown=evento=>{if(evento.key==='Enter'||evento.key===' '){evento.preventDefault();el.click();}};
    el.style.cursor = 'pointer';
    el.onclick = () => abrirEdicaoRefeicao(Number(el.dataset.mealId));
  });
}

