
import { getUserProfile, saveUserProfile, getCurrentPlan, saveCurrentPlan, gerarPlanoAlimentar } from "./dietPlan.js";
import { getAlternatives, criarSubstituicao } from "./foodAlternatives.js";
import { validarPerfil, validarPlano, somarNutrientes } from "./nutricao.js";
import { getChaveLocal } from './storage.js';
import { obterSessaoAtual } from './servicoHttp.js';
import { agendarSincronizacao } from './sincronizacao.js';
import { prepararDialogo, vincularRotulos } from "./elementos.js";
import { $, iniciarMensagemProcessamento, encerrarMensagemProcessamento, avisar, escaparHtml } from "./base.js";
// ============ DIET PLAN (Meu Plano) ============
export const OPCOES_RESTRICOES = [
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'vegano', label: 'Vegano' },
  { value: 'sem_gluten', label: 'Sem glúten' },
  { value: 'sem_lactose', label: 'Sem lactose' },
  { value: 'low_carb', label: 'Low carb' },
  { value: 'nenhuma', label: 'Nenhuma' },
];

export const OPCOES_TIPO_DIETA = [
  { value: 'equilibrado', label: 'Equilibrado', desc: 'Balanceia sabor, praticidade e nutrição' },
  { value: 'sabor', label: 'Sabor & Prazer', desc: 'Mais variedade e prato gostoso' },
  { value: 'performance', label: 'Performance', desc: 'Timing de nutrientes e alimentos funcionais' },
  { value: 'praticidade', label: 'Praticidade', desc: 'Preparo rápido, poucos ingredientes' },
];

export const ROTULOS_OBJETIVOS = {
  perder_peso: 'Perda de peso',
  manter_peso: 'Manter peso',
  ganhar_massa: 'Ganhar massa muscular',
  melhorar_saude: 'Melhorar saúde geral',
};

export function lerFormularioPerfil() {
  const v = (q) => document.querySelector(q);
  const chips = Array.from(document.querySelectorAll('#dp-chips .diet-chip.active')).map(c => c.dataset.value);
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
    gestante: Boolean(v('#dp-gestante')?.checked),
    acompanhamentoProfissional: Boolean(v('#dp-acompanhamento')?.checked),
  };
}

export function preencherFormularioPerfil(profile) {
  const set = (q, val) => { const el = document.querySelector(q); if (el != null) el.value = val ?? ''; };
  set('#dp-idade', profile?.idade);
  set('#dp-sexo', profile?.sexo||'masculino');
  set('#dp-peso', profile?.pesoAtual);
  set('#dp-altura', profile?.altura);
  set('#dp-atividade', profile?.nivelAtividade||'sedentario');
  set('#dp-objetivo', profile?.objetivo||'manter_peso');
  set('#dp-peso-desejado', profile?.pesoDesejado);
  set('#dp-prazo', profile?.prazo);
  set('#dp-alergias', profile?.restricoesTexto);
  set('#dp-nao-gosta', profile?.alimentosNaoGosta);
  set('#dp-favoritos', profile?.alimentosFavoritos);
  set('#dp-refeicoes', profile?.refeicoesPorDia||4);
  set('#dp-acorda', profile?.horarioAcorda||'07:00');
  set('#dp-dorme', profile?.horarioDorme||'23:00');
  set('#dp-rotina', profile?.rotinaTexto);
  set('#dp-condicoes', profile?.condicoesSaude||(profile?.condicaoClinica?'Condição clínica indicada no perfil anterior; requer revisão profissional.':''));
  $('#dp-gestante').checked=Boolean(profile?.gestante||profile?.gestacao||profile?.amamentando);
  $('#dp-acompanhamento').checked=Boolean(profile?.acompanhamentoProfissional);
  const chips = document.querySelectorAll('#dp-chips .diet-chip');
  const r = new Set(profile?.restricoes || []);
  chips.forEach(c => c.classList.toggle('active', r.has(c.dataset.value)||(c.dataset.value==='nenhuma'&&!r.size)));
  const tipoChips = document.querySelectorAll('.diet-chip-tipo');
  tipoChips.forEach(c => c.classList.toggle('active', c.dataset.value === (profile?.tipoDieta || 'equilibrado')));
}

export function renderizarFormularioPerfil(profile) {
  try{const rascunho=JSON.parse(sessionStorage.getItem(getChaveLocal('nutrifoto.rascunhoPerfil'))||'null');if(rascunho)profile=rascunho;}catch{}
  const container = $('#diet-form-content');
  container.innerHTML = `
    <div class="perfil-introducao">
      <span class="estado-etiqueta"><i data-lucide="leaf"></i> Seu perfil alimentar</span>
      <h3>${profile?'Um cuidado que acompanha você':'Seu plano começa por você'}</h3>
      <p>Organize suas preferências e mantenha seu perfil salvo. Planos são rascunhos para revisão com um profissional.</p>
    </div>

    <div class="diet-section">
      <div class="diet-section-title"><i data-lucide="user"></i> Dados pessoais</div>
      <div class="diet-grid-2">
        <div class="diet-field"><label>Idade</label><input type="number" id="dp-idade" min="18" max="120" placeholder="ex: 30" /></div>
        <div class="diet-field"><label>Sexo</label><select id="dp-sexo"><option value="masculino">Masculino</option><option value="feminino">Feminino</option></select></div>
        <div class="diet-field"><label>Peso (kg)</label><input type="number" id="dp-peso" min="20" max="300" step="0.1" placeholder="ex: 75" /></div>
        <div class="diet-field"><label>Altura (cm)</label><input type="number" id="dp-altura" min="100" max="250" placeholder="ex: 175" /></div>
      </div>
      <div class="diet-field">
        <label>Nível de atividade</label>
        <select id="dp-atividade">
          <option value="sedentario">Sedentário (pouco ou nenhum exercício)</option>
          <option value="leve">Leve (1-3x por semana)</option>
          <option value="moderado">Moderado (3-5x por semana)</option>
          <option value="intenso">Intenso (6-7x por semana)</option>
          <option value="atleta">Atleta (2x ao dia ou trabalho físico pesado)</option>
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
          <option value="melhorar_saude">Melhorar saúde geral</option>
        </select>
      </div>
      <div class="diet-grid-2">
        <div class="diet-field"><label>Peso desejado (kg)</label><input type="number" id="dp-peso-desejado" min="20" max="300" step="0.1" placeholder="opcional" /></div>
        <div class="diet-field"><label>Prazo</label><input type="text" id="dp-prazo" placeholder="ex: 3 meses" /></div>
      </div>
    </div>

    <div class="diet-section">
      <div class="diet-section-title"><i data-lucide="chef-hat"></i> Estilo alimentar</div>
      <div class="diet-field">
        <label>Perfil alimentar</label>
        <div class="diet-chips" id="dp-chips-tipo">
          ${OPCOES_TIPO_DIETA.map(o => `<button type="button" class="diet-chip diet-chip-tipo" data-value="${o.value}"><strong>${o.label}</strong><span class="tipo-desc">${o.desc}</span></button>`).join('')}
        </div>
        <div class="diet-section-hint">Preferência para rascunhos que poderão ser revisados.</div>
      </div>
    </div>

    <div class="diet-section">
      <div class="diet-section-title"><i data-lucide="utensils"></i> Restrições e preferências</div>
      <div class="diet-field">
        <label>Restrições alimentares</label>
        <div class="diet-chips" id="dp-chips">
          ${OPCOES_RESTRICOES.map(o => `<button type="button" class="diet-chip" data-value="${o.value}">${o.label}</button>`).join('')}
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
        <div class="diet-field"><label>Refeições/dia</label><select id="dp-refeicoes"><option>3</option><option>4</option><option selected>5</option><option>6</option></select></div>
        <div class="diet-field"><label>Acorda</label><input type="time" id="dp-acorda" value="07:00" /></div>
        <div class="diet-field"><label>Dorme</label><input type="time" id="dp-dorme" value="23:00" /></div>
      </div>
      <div class="diet-field">
        <label>Compromissos que afetam as refeições</label>
        <textarea id="dp-rotina" placeholder="ex: almoco so depois das 13h por causa do trabalho"></textarea>
      </div>
    </div>

    <div class="diet-section">
      <div class="diet-section-title"><i data-lucide="heart-pulse"></i> Condições de saúde (opcional)</div>
      <div class="diet-field">
        <textarea id="dp-condicoes" placeholder="ex: diabetes tipo 2, hipertensao, problema renal"></textarea>
        <div class="diet-section-hint">Informar uma condição não impede salvar o perfil. A geração automática fica bloqueada.</div>
      </div>
    </div>

    <div class="sticky-save">
      <div class="perfil-cuidados">
        <label><input type="checkbox" id="dp-gestante" /> Estou gestante ou amamentando</label>
        <label><input type="checkbox" id="dp-acompanhamento" /> Tenho acompanhamento profissional</label>
      </div>
      <p id="perfil-feedback" class="mensagem-campo" role="status" aria-live="polite"></p>
      <button type="button" class="btn-primary" id="btn-save-profile"><i data-lucide="check"></i> Salvar perfil</button>
      <div class="plano-disponibilidade"><p id="plano-disponibilidade" class="api-key-help"></p>
        <button type="button" class="btn-secondary" id="btn-generate-plan" aria-describedby="plano-disponibilidade"><i data-lucide="sparkles"></i> Gerar rascunho de teste</button>
      </div>
    </div>
  `;

  vincularRotulos(container);
  container.querySelectorAll('#dp-chips .diet-chip').forEach(chip => {
    chip.onclick = () => {
      const val = chip.dataset.value;
      if (val === 'nenhuma') {
        container.querySelectorAll('#dp-chips .diet-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        return;
      }
      const nenhuma = container.querySelector('.diet-chip[data-value="nenhuma"]');
      if (nenhuma) nenhuma.classList.remove('active');
      chip.classList.toggle('active');
      const anyActive = container.querySelectorAll('#dp-chips .diet-chip.active').length > 0;
      if (!anyActive && nenhuma) nenhuma.classList.add('active');
    };
  });

  container.querySelectorAll('.diet-chip-tipo').forEach(chip => {
    chip.onclick = () => {
      container.querySelectorAll('.diet-chip-tipo').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    };
  });

  $('#btn-generate-plan').onclick = gerarPlanoAtual;
  $('#btn-save-profile').onclick = ()=>salvarPerfilAtual();

  preencherFormularioPerfil(profile||{sexo:'masculino',nivelAtividade:'sedentario',objetivo:'manter_peso',refeicoesPorDia:4,horarioAcorda:'07:00',horarioDorme:'23:00'});
  organizarSecoesPerfil(container);
  const guardarRascunho=()=>{try{sessionStorage.setItem(getChaveLocal('nutrifoto.rascunhoPerfil'),JSON.stringify(lerFormularioPerfil()));mostrarMensagemPerfil('Alterações ainda não salvas.');}catch{mostrarMensagemPerfil('Não foi possível manter o rascunho. Salve o perfil antes de sair.',true);}container.querySelectorAll('.diet-chip').forEach(chip=>chip.setAttribute('aria-pressed',String(chip.classList.contains('active'))));atualizarDisponibilidadePlano();};
  container.oninput=guardarRascunho;container.onchange=guardarRascunho;
  container.onclick=evento=>{if(evento.target.closest('.diet-chip'))guardarRascunho();};
  atualizarDisponibilidadePlano();
  container.querySelectorAll('.diet-chip').forEach(chip=>chip.setAttribute('aria-pressed',String(chip.classList.contains('active'))));
  if (window.lucide) lucide.createIcons();
}

function organizarSecoesPerfil(container){
  container.querySelectorAll('.diet-section').forEach((secao,indice)=>{
    const painel=document.createElement('details');painel.className='diet-section perfil-secao';painel.open=indice===0;
    const titulo=secao.querySelector('.diet-section-title');const resumo=document.createElement('summary');
    resumo.className='diet-section-title';resumo.append(...titulo.childNodes);titulo.remove();
    const conteudo=document.createElement('div');conteudo.className='perfil-secao-conteudo';conteudo.append(...secao.childNodes);
    painel.append(resumo,conteudo);secao.replaceWith(painel);
  });
}

function mostrarMensagemPerfil(mensagem,erro=false){
  const campo=$('#perfil-feedback');if(!campo)return;
  campo.textContent=mensagem;campo.classList.toggle('erro',erro);
}

function indicarErroPerfil(erro){
  mostrarMensagemPerfil(erro.message,true);
  const identificador=/idade/i.test(erro.message)?'dp-idade':/altura/i.test(erro.message)?'dp-altura':/peso desejado/i.test(erro.message)?'dp-peso-desejado':'dp-peso';
  const campo=document.getElementById(identificador);if(campo){const secao=campo.closest('details');if(secao)secao.open=true;campo.setAttribute('aria-invalid','true');campo.setAttribute('aria-describedby','perfil-feedback');campo.focus({preventScroll:true});campo.scrollIntoView({block:'center',behavior:'instant'});}
  avisar(erro.message,true);
}

export function salvarPerfilAtual(){
  try{
    const perfil=validarPerfil(lerFormularioPerfil(),{paraPlano:false});
    saveUserProfile(perfil);sessionStorage.removeItem(getChaveLocal('nutrifoto.rascunhoPerfil'));
    $('#diet-form-content').querySelectorAll('[aria-invalid]').forEach(campo=>campo.removeAttribute('aria-invalid'));
    mostrarMensagemPerfil('Perfil salvo neste dispositivo.');avisar('Perfil salvo');
    agendarSincronizacao();return perfil;
  }catch(erro){indicarErroPerfil(erro);return null;}
}

function obterBloqueioPlano(){
  const perfil=lerFormularioPerfil();
  if(perfil.gestante)return 'A geração de planos personalizados para gestantes ou pessoas amamentando ainda não foi homologada. Salve seu perfil e procure acompanhamento profissional.';
  if(perfil.condicoesSaude)return 'Este perfil exige avaliação profissional. Salve seu perfil; a geração automática permanece bloqueada.';
  if(window.NutriFotoAndroid)return 'Geração de planos e aplicação automática de metas aguardam homologação nutricional. Seu perfil e seus rascunhos existentes continuam disponíveis.';
  const sessao=obterSessaoAtual();
  if(!sessao?.simulado&&!sessao?.planosDisponiveis)return window.NutriFotoDesktop?'Geração por IA indisponível nesta versão de teste. Você pode salvar seu perfil e consultar rascunhos existentes.':'A geração de planos aguarda homologação nutricional. Salvar seu perfil continua disponível.';
  if(!sessao.usuario)return 'A Web é uma demonstração. Você pode salvar seu perfil e consultar rascunhos existentes.';
  return '';
}

function atualizarDisponibilidadePlano(){
  const motivo=obterBloqueioPlano();$('#btn-generate-plan').disabled=false;
  $('#btn-generate-plan').lastChild.textContent=obterSessaoAtual()?.simulado&&!motivo?' Gerar rascunho de teste':' Gerar rascunho';
  $('#plano-disponibilidade').textContent=motivo||(obterSessaoAtual()?.simulado?'Ambiente simulado: o resultado será fictício e não deve orientar sua alimentação.':'O resultado será uma estimativa para revisão profissional. Nenhuma meta será aplicada automaticamente.');
}

export function renderizarPlano(plan, profile) {
  $('#plan-tdee-val').textContent='—';$('#plan-meta-val').textContent='—';$('#plan-objective').textContent='Revisão necessária';
  $('#plan-aviso').textContent='Rascunho preservado para revisão profissional.';
  try { validarPlano(plan); } catch { $('#plan-meals-timeline').innerHTML='<p class="estado-vazio">Este rascunho antigo precisa ser revisado. Os dados foram preservados. Você pode editar e salvar seu perfil.</p>';$('#plan-macro-bars').replaceChildren();return; }
  $('#plan-tdee-val').textContent = Number(plan.tdee).toLocaleString('pt-BR',{maximumFractionDigits:0});
  $('#plan-meta-val').textContent = Number(plan.metaCalorica).toLocaleString('pt-BR',{maximumFractionDigits:0});
  $('#plan-objective').textContent = ROTULOS_OBJETIVOS[profile?.objetivo] || 'Rascunho salvo';

  const totals = {
    proteina_g: plan.macros.proteina,
    carboidrato_g: plan.macros.carboidrato,
    gordura_g: plan.macros.gordura,
  };
  $('#plan-macro-bars').innerHTML=[['Proteínas',totals.proteina_g,'proteina'],['Carboidratos',totals.carboidrato_g,'carboidrato'],['Gorduras',totals.gordura_g,'gordura']].map(([nome,valor,tipo])=>`<div class="plano-macro ${tipo}"><span>${nome}</span><strong>${Number(valor).toLocaleString('pt-BR',{maximumFractionDigits:1})}<small> g</small></strong></div>`).join('');
  $('#plan-aviso').textContent=plan.simulado?'Exemplo fictício de teste. Não utilize como plano alimentar.':'Rascunho para revisão profissional. Não altera suas metas diárias.';

  const timeline = $('#plan-meals-timeline');
  timeline.innerHTML = plan.refeicoes.map((r, ri) => `
    <div class="plan-meal-card">
      <div class="plan-meal-header">
        <span class="plan-meal-name">${escaparHtml(r.nome)}</span>
        <span class="plan-meal-time">${escaparHtml(r.horario)}</span>
      </div>
      <div class="plan-meal-items">
        ${(r.itens || []).map((item, ii) => `
          <div class="plan-meal-item" data-refei="${ri}" data-item="${ii}">
            <div class="plan-meal-item-info">
              <span class="plan-meal-item-name">${escaparHtml(item.alimento)}</span>
              ${item.quantidade ? `<span class="plan-meal-item-qty">${escaparHtml(formatarQuantidadePlano(item.quantidade))}</span>` : ''}
            </div>
            <button class="plan-meal-swap-btn" data-refei="${ri}" data-item="${ii}" aria-label="Trocar ${escaparHtml(item.alimento)}" >
              <i data-lucide="refresh-cw" style="width:14px;height:14px"></i>
            </button>
          </div>
        `).join('')}
      </div>
      ${r.itens.some(item=>!alternativasPermitidas(item,profile).length)?'<p class="api-key-help plano-troca-ajuda">Alguns itens não têm substituição validada para suas restrições.</p>':''}
      <span class="plan-meal-kcal">${Number(r.kcalEstimada).toLocaleString('pt-BR',{maximumFractionDigits:1})} kcal estimadas</span>
    </div>
  `).join('');

  timeline.querySelectorAll('.plan-meal-swap-btn').forEach(btn => {
    btn.onclick = () => {
      const ri = Number(btn.dataset.refei);
      const ii = Number(btn.dataset.item);
      abrirSubstituicao(ri, ii, plan);
    };
  });

  if (window.lucide) lucide.createIcons();
}

// ============ SWAP FOOD MODAL ============
function formatarQuantidadePlano(quantidade){const valor=String(quantidade).match(/^(\d+(?:\.\d+)?)\s*g$/);return valor?Number(valor[1]).toLocaleString('pt-BR',{maximumFractionDigits:2})+' g':quantidade;}
function alternativasPermitidas(item,perfil={}){
  if(!perfil?.idade)return [];
  if(perfil?.gestante||perfil?.gestacao||perfil?.amamentando||perfil?.condicaoClinica||String(perfil?.condicoesSaude||'').trim())return [];
  return getAlternatives(item.categoria||'outro',perfil||{}).filter(nome=>nome!==item.alimento);
}
export function abrirSubstituicao(refeiIdx, itemIdx, plan) {
  const item = plan.refeicoes[refeiIdx]?.itens?.[itemIdx];
  if (!item) return;
  const userProfile = getUserProfile() || {};
  const alternatives = alternativasPermitidas(item,userProfile);
  const titular=getChaveLocal('nutrifoto.currentPlan');
  let fechado=false;
  const overlay = document.createElement('div');
  overlay.className = 'swap-overlay';
  overlay.innerHTML = `
    <div class="swap-modal">
      <div class="swap-modal-header">
        <h3>Trocar alimento</h3>
        <button class="swap-modal-close" id="swap-modal-close" aria-label="Fechar substituições"><i data-lucide="x" style="width:18px;height:18px"></i></button>
      </div>
      <div class="swap-modal-current">
        <span class="swap-modal-label">Atual:</span>
        <span class="swap-modal-current-name">${escaparHtml(item.alimento)}</span>
        ${item.quantidade ? `<span class="swap-modal-current-qty">${escaparHtml(item.quantidade)}</span>` : ''}
      </div>
      <div class="swap-modal-section">
        <span class="swap-modal-section-title">Alternativas da TACO</span>
        <p class="api-key-help">Equivalência apenas de energia. Outros nutrientes mudam e precisam de revisão profissional.</p>
        <div class="swap-modal-list">
          ${alternatives.map(alt => `
            <button class="swap-modal-option" data-alt="${escaparHtml(alt)}">${escaparHtml(alt)}</button>
          `).join('')}
        </div>
        ${alternatives.length?'':'<p class="mensagem-campo">Não há alternativa validada para suas restrições. Mantenha o alimento e consulte um profissional.</p>'}
      </div>
      <p id="substituicao-feedback" class="mensagem-campo" role="status" aria-live="polite"></p>
      <div class="swap-modal-section">
        <span class="swap-modal-section-title">Observação (opcional)</span>
        <input type="text" class="swap-modal-note" id="swap-note" placeholder="ex: nao gosto de peixe" />
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  const closeModal = prepararDialogo(overlay, () => {fechado=true;overlay.remove();});

  overlay.querySelector('#swap-modal-close').onclick = closeModal;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  overlay.querySelectorAll('.swap-modal-option').forEach(btn => {
    btn.onclick = async () => {
      const newAlimento = btn.dataset.alt;
      const note = overlay.querySelector('#swap-note')?.value?.trim() || '';

      const controles=[...overlay.querySelectorAll('.swap-modal-option')];controles.forEach(botao=>botao.disabled=true);
      overlay.querySelector('#swap-modal-close').focus();
      overlay.querySelector('#substituicao-feedback').textContent='Calculando a porção com a base TACO…';
      try {
        const substituto=await criarSubstituicao(item,newAlimento,userProfile);
        if(fechado||titular!==getChaveLocal('nutrifoto.currentPlan'))return;
        const novoPlano=structuredClone(plan);novoPlano.refeicoes[refeiIdx].itens[itemIdx]=substituto;
        if(note)substituto.observacao=note;
        for(const refeicao of novoPlano.refeicoes)refeicao.kcalEstimada=somarNutrientes(refeicao.itens.map(alimento=>({...alimento,nome:alimento.alimento||alimento.nome}))).calorias;
        const nutrientes=somarNutrientes(novoPlano.refeicoes.flatMap(refeicao=>refeicao.itens.map(alimento=>({...alimento,nome:alimento.alimento||alimento.nome}))));
        novoPlano.metaCalorica=nutrientes.calorias;novoPlano.macros={proteina:nutrientes.proteina_g,carboidrato:nutrientes.carboidrato_g,gordura:nutrientes.gordura_g};
        saveCurrentPlan(novoPlano);renderizarPlano(novoPlano,getUserProfile());agendarSincronizacao();avisar('Substituição salva para revisão');closeModal();
      } catch(erro){if(!fechado){overlay.querySelector('#substituicao-feedback').textContent=erro.message;avisar(erro.message,true);}}
      finally{controles.forEach(botao=>botao.disabled=false);}
    };
  });
}

export function renderizarTelaPlano() {
  const profile = getUserProfile();
  const plan = getCurrentPlan();
  const formContainer = $('#diet-form-container');
  const planView = $('#diet-plan-view');

  $('#btn-edit-profile').hidden=!plan;
  $('#btn-edit-profile').setAttribute('aria-label','Editar perfil');$('#btn-edit-profile').innerHTML='<i data-lucide="pencil"></i>';
  if(controladorPlano){formContainer.style.display='none';planView.style.display='none';$('#diet-skeleton').style.display='block';return;}
  $('#diet-skeleton').style.display='none';
  if (plan) {
    formContainer.style.display = 'none';
    planView.style.display = 'block';
    renderizarPlano(plan, profile||{});
  } else {
    formContainer.style.display = 'block';
    planView.style.display = 'none';
    renderizarFormularioPerfil(profile);
  }
}

let controladorPlano=null;
export function cancelarPlano(){controladorPlano?.abort();}
export async function gerarPlanoAtual() {
  if(controladorPlano)return;
  const bloqueio=obterBloqueioPlano();if(bloqueio){mostrarMensagemPerfil(bloqueio,true);return;}
  const profile = lerFormularioPerfil();

  try { validarPerfil(profile); } catch(erro) { indicarErroPerfil(erro); return; }
  if (!profile.idade || !profile.pesoAtual || !profile.altura) {
    avisar('Preencha idade, peso e altura', true);
    return;
  }

  saveUserProfile(profile);
  sessionStorage.removeItem(getChaveLocal('nutrifoto.rascunhoPerfil'));
  controladorPlano=new AbortController();const controle=controladorPlano,titular=getChaveLocal('nutrifoto.currentPlan');$('#cancelar-plano').hidden=false;

  $('#diet-form-container').style.display = 'none';
  $('#diet-plan-view').style.display = 'none';
  $('#diet-skeleton').style.display = 'block';
  iniciarMensagemProcessamento('#bowl-text-diet', [obterSessaoAtual()?.simulado?'Preparando um rascunho fictício para teste…':'Aguardando o rascunho para revisão…']);

  try {
    const plan = await gerarPlanoAlimentar(profile,{signal:controle.signal});
    if(titular!==getChaveLocal('nutrifoto.currentPlan')||controle.signal.aborted)return;
    saveCurrentPlan(plan);
    renderizarPlano(plan, profile);
    $('#diet-skeleton').style.display = 'none';
    encerrarMensagemProcessamento();
    $('#diet-plan-view').style.display = 'block';
    $('#btn-edit-profile').hidden=false;agendarSincronizacao();avisar(obterSessaoAtual()?.simulado?'Rascunho de teste salvo':'Rascunho salvo para revisão');
  } catch (e) {
    if(titular!==getChaveLocal('nutrifoto.currentPlan'))return;
    $('#diet-skeleton').style.display = 'none';
    encerrarMensagemProcessamento();
    $('#diet-form-container').style.display = 'block';
    mostrarMensagemPerfil(e.message||'Não foi possível gerar o rascunho.',true);avisar(e.message || 'Erro ao gerar plano', true);
  } finally {
    if(controladorPlano===controle){controladorPlano=null;$('#cancelar-plano').hidden=true;encerrarMensagemProcessamento();}
  }
}

export function aplicarMetasPlano() {
  const plan = getCurrentPlan();
  if (!plan) return;
  avisar('Este plano é um rascunho. A aplicação automática de metas está bloqueada até revisão profissional comprovada.',true);
}

export function editarPerfil() {
  if($('#diet-form-container').style.display==='block'&&getCurrentPlan()){renderizarTelaPlano();return;}
  $('#btn-edit-profile').hidden=!getCurrentPlan();
  $('#btn-edit-profile').setAttribute('aria-label','Voltar ao rascunho');$('#btn-edit-profile').innerHTML='<i data-lucide="arrow-left"></i>';
  $('#diet-plan-view').style.display = 'none';
  $('#diet-form-container').style.display = 'block';
  renderizarFormularioPerfil(getUserProfile());
}

export function gerarNovoPlano() {
  editarPerfil();
}

