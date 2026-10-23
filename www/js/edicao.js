import { atualizarRefeicao, deletarRefeicao, obterRefeicao } from "./db.js";
import { obterContaArmazenamento } from './storage.js';
import { recalcularTotal } from "./visionApi.js";
import { getUserProfile } from "./dietPlan.js";
import { getAlternatives, getAllCategories } from "./foodAlternatives.js";
import { ajustarPorcao } from "./nutricao.js";
import { prepararDialogo, confirmarAcao } from "./elementos.js";
import { validarAlimento } from "./nutricao.js";
import { agendarSincronizacao } from "./sincronizacao.js";
import { avisar, formatarHorario, escaparHtml } from "./base.js";
import { prepararValoresOriginais } from "./resultados.js";
// ============ EDIT MEAL MODAL ============
export async function abrirEdicaoRefeicao(mealId) {
  const contaInicial=obterContaArmazenamento();
  const meal = await obterRefeicao(mealId);
  if(contaInicial!==obterContaArmazenamento())return;
  if (!meal) { avisar('Refeição não encontrada', true); return; }

  const alimentos = JSON.parse(JSON.stringify(meal.alimentos));
  alimentos.forEach(a => prepararValoresOriginais(a));

  const overlay = document.createElement('div');
  overlay.className = 'edit-overlay';
  overlay.innerHTML = `
    <div class="edit-modal">
      <div class="swap-modal-header">
        <h3>Editar Refeição</h3>
        <button class="swap-modal-close" id="edit-modal-close"><i data-lucide="x" style="width:18px;height:18px"></i></button>
      </div>
      <div class="edit-meal-info">
        <span class="edit-meal-info-time">🕐 ${formatarHorario(meal.createdAt)}</span>
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

  const closeModal = prepararDialogo(overlay, () => overlay.remove());

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
             <input class="food-receipt-name" value="${escaparHtml(f.nome)}" data-field="nome" />
             ${f.marca_identificada ? `<span class="food-receipt-brand" title="Produto identificado por embalagem">${escaparHtml(f.marca_identificada)}</span>` : ''}
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

        row.querySelector('[data-field="nome"]').oninput = (e) => { f.nome = e.target.value; f.validado=false;f.base_origem='manual';f.nome_base=null; };

        row.querySelector('[data-field="porcao_estimada_g"]').oninput = (e) => {
          try { Object.assign(f, ajustarPorcao(f, Number(e.target.value))); e.target.setCustomValidity(''); }
          catch { e.target.setCustomValidity('Informe uma porção positiva e válida.'); avisar('Informe uma porção positiva e válida.', true); return; }
          row.querySelector('.food-receipt-macros').textContent = f.calorias + ' kcal · P ' + f.proteina_g + 'g · C ' + f.carboidrato_g + 'g · G ' + f.gordura_g + 'g';
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
      <button class="edit-sug-btn" data-name="${escaparHtml(m.name)}" data-cat="${escaparHtml(m.category)}">${escaparHtml(m.name)}</button>
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
    if (!name || grams <= 0) { avisar('Preencha nome e gramas', true); return; }
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
    try { validarAlimento(newFood); } catch(erro){avisar(erro.message,true);return;}
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
    avisar('Alimento adicionado');
  };

  // ---- Save ----
  overlay.querySelector('#edit-save-btn').onclick = async () => {
    if(overlay.querySelector('input:invalid')){overlay.querySelector('input:invalid').focus();avisar('Revise as quantidades antes de salvar.',true);return;}
    if (alimentos.length === 0) {
      if (!await confirmarAcao('Remover todos os alimentos? A refeição será excluída.')) return;
      await deletarRefeicao(mealId);
      closeModal();
      document.dispatchEvent(new Event("nutrifoto:atualizar"));
      avisar('Refeição excluída');
      return;
    }
    const total = recalcularTotal(alimentos);
    const updated = { ...meal, alimentos, total };
    await atualizarRefeicao(mealId, updated);
    closeModal();
    document.dispatchEvent(new Event("nutrifoto:atualizar"));  agendarSincronizacao();
    avisar('Refeição atualizada');
  };
}

