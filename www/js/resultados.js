import { salvarRefeicao } from "./db.js";
import { recalcularTotal } from "./visionApi.js";
import { ajustarPorcao } from "./nutricao.js";
import { vincularRotulos } from './elementos.js';
import { agendarSincronizacao } from "./sincronizacao.js";
import { $, estado, mostrarTela, avisar, escaparHtml } from "./base.js";
// ============ RESULTS — Receipt Style ============
export function renderizarResultados() {
  if (!estado.currentAnalysis) return;
  const a = estado.currentAnalysis;

  // Hero thumb
  const hero = $('#result-hero');
  if (estado.imagemDaAnalise) {
    hero.innerHTML = `
      <img class="result-hero-thumb" src="${estado.imagemDaAnalise}" alt="" />
      <div class="result-hero-info">
        <div class="result-hero-title">${a.alimentos.length} ${a.alimentos.length===1?'alimento':'alimentos'} para revisar</div>
        <div class="result-hero-count">Toque nos campos para ajustar porções</div>
      </div>
    `;
  } else {
    hero.innerHTML = `
      <div class="result-hero-info">
        <div class="result-hero-title">${a.alimentos.length} ${a.alimentos.length===1?'alimento':'alimentos'} para revisar</div>
        <div class="result-hero-count">Toque nos campos para ajustar porções</div>
      </div>
    `;
  }

  // Food receipt cards
  const aviso=document.createElement('p');aviso.className='api-key-help';aviso.textContent=(a.simulado?'DADOS SIMULADOS — não utilizar para alimentação real. ':'Estimativa: revise alimento e quantidade antes de salvar. ')+(a.avisos||[]).join(' ');hero.append(aviso);
  const list = $('#foods-list');
  if (a.alimentos.length === 0) {
    list.innerHTML = '<p class="empty">Nenhum alimento identificado. Tente outra foto.</p>';
  } else {
    list.innerHTML = a.alimentos.map((f, idx) => `
      <div class="food-receipt" data-idx="${idx}">
        <div class="food-receipt-header">
          <input class="food-receipt-name" value="${escaparHtml(f.nome)}" data-field="nome" />
          ${f.marca_identificada ? `<span class="food-receipt-brand" title="Produto identificado por embalagem">${escaparHtml(f.marca_identificada)}</span>` : ''}
          ${f.validado ? `<span class="food-receipt-badge food-receipt-badge-valid" title="Valor validado com dados da TACO (NEPA/UNICAMP)"><i data-lucide="check-circle" class="badge-icon"></i> TACO</span>` : `<span class="food-receipt-badge food-receipt-badge-ia" title="Estimativa da IA (não validado com base de dados externa)"><i data-lucide="sparkles" class="badge-icon"></i> IA</span>`}
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
      const f = estado.currentAnalysis.alimentos[idx];
      prepararValoresOriginais(f);

      // Name edit
      row.querySelector('[data-field="nome"]').oninput = (e) => {
        f.nome = e.target.value;
        f.validado=false; f.base_origem='manual'; f.nome_base=null;
        const selo=row.querySelector('.food-receipt-badge');if(selo){selo.textContent='Revisão manual';selo.title='Nome alterado: valores anteriores precisam de revisão.';}
      };

      // Grams edit — recalculate macros proportionally
      row.querySelector('[data-field="porcao_estimada_g"]').oninput = (e) => {
        const quantidade = Number(e.target.value);
        try { Object.assign(f, ajustarPorcao(f, quantidade)); e.target.setCustomValidity(''); }
        catch { e.target.setCustomValidity('Informe uma porção positiva e válida.'); avisar('Informe uma porção positiva e válida.', true); return; }
        const macros = row.querySelector('.food-receipt-macros');
        macros.textContent = f.calorias + ' kcal · P ' + f.proteina_g + 'g · C ' + f.carboidrato_g + 'g · G ' + f.gordura_g + 'g';
        atualizarTotais();
      };

      // Remove
      row.querySelector('[data-remove]').onclick = () => {
        estado.currentAnalysis.alimentos.splice(idx, 1);
        renderizarResultados();
      };
    });
  }
  vincularRotulos(list);
  atualizarTotais();
  // Renderiza ícones Lucide nos badges de validação
  if (window.lucide) lucide.createIcons();
}

export function prepararValoresOriginais(f) {
  if (f.calorias_original === undefined) f.calorias_original = f.calorias;
  if (f.proteina_original === undefined) f.proteina_original = f.proteina_g;
  if (f.carbo_original === undefined) f.carbo_original = f.carboidrato_g;
  if (f.gordura_original === undefined) f.gordura_original = f.gordura_g;
  if (!f.porcao_original_g) f.porcao_original_g = f.porcao_estimada_g;
}

export function atualizarTotais() {
  if (!estado.currentAnalysis) return;
  estado.currentAnalysis.alimentos.forEach(prepararValoresOriginais);
  const total = recalcularTotal(estado.currentAnalysis.alimentos);
  estado.currentAnalysis.total = total;
  $('#totals-summary').innerHTML = `
    <div><strong>${total.calorias}</strong><span>kcal</span></div>
    <div><strong>${total.proteina_g}g</strong><span>P</span></div>
    <div><strong>${total.carboidrato_g}g</strong><span>C</span></div>
    <div><strong>${total.gordura_g}g</strong><span>G</span></div>
  `;
}

export let salvandoRefeicao = false;
export async function salvarRefeicaoAtual() {
  if (salvandoRefeicao) return;
  if (!estado.currentAnalysis?.alimentos.length) { avisar('Nenhum alimento identificado. Volte e descreva os alimentos ou escolha outra foto.', true);return; }
  if (!$('#foods-list').querySelector('input:invalid') && estado.currentAnalysis.alimentos.every(alimento => alimento.porcao_estimada_g > 0)) {
    salvandoRefeicao = true; const botao = $('#btn-save-meal'); botao.disabled = true; botao.setAttribute('aria-busy','true');
    try {
      await salvarRefeicao({ chaveOperacao: crypto.randomUUID(), imageDataUrl: estado.imagemDaAnalise || null, alimentos: estado.currentAnalysis.alimentos, total: recalcularTotal(estado.currentAnalysis.alimentos) });
      if(estado.imagemDaAnalise)estado.currentImage = null;
      estado.currentAnalysis = null;estado.imagemDaAnalise = null;agendarSincronizacao();
      mostrarTela('dashboard'); avisar('Refeição salva');
    } catch (erro) { avisar(erro.message || 'Não foi possível salvar. Seus dados continuam nesta tela.',true); }
    finally { salvandoRefeicao=false; botao.disabled=false; botao.removeAttribute('aria-busy'); }
  } else avisar('Revise as quantidades antes de salvar.',true);
}

