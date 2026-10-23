import { downscaleImage } from "./camera.js";
import { analyzeImage, analyzeText } from "./visionApi.js";
import { buscarValidacaoTaco, buscarCorrespondenciaTaco, possuiNutrientesTaco } from "./tacoSearch.js";
import { ajustarPorcao } from "./nutricao.js";
import { $, $$, estado, MENSAGENS_ANALISE, iniciarMensagemProcessamento, encerrarMensagemProcessamento, mostrarTela, avisar } from "./base.js";
import { renderizarResultados } from "./resultados.js";
// ============ CAPTURE ============
let controladorAtual = null;
function informarErroCaptura(mensagem) { $('#captura-feedback').textContent = mensagem;avisar(mensagem,true); }
export function cancelarAnalise(){ controladorAtual?.abort(); }
function iniciarProcessamento(){ if(controladorAtual)return null;controladorAtual=new AbortController();$('#cancelar-analise').hidden=false;return controladorAtual.signal; }
function finalizarProcessamento(){controladorAtual=null;$('#cancelar-analise').hidden=true;}
export function definirModoCaptura(mode) {
  $('#captura-feedback').textContent = '';
  estado.captureMode = mode;
  const tabs = $$('.capture-tab');
  const photoArea = $('#capture-photo-area');
  const textArea = $('#capture-text-area');
  const btn = $('#btn-analyze');

  tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));

  if (mode === 'photo') {
    photoArea.style.display = '';
    textArea.style.display = 'none';
    btn.disabled = false;
  } else {
    photoArea.style.display = 'none';
    textArea.style.display = '';
    btn.disabled = false;
  }
}

export function definirImagemCaptura(img) {
  estado.currentImage = img;
  const preview = $('#image-preview');
  if (img) {
    preview.innerHTML = `<img src="${img.dataUrl}" alt="prato" />`;
    if (estado.captureMode === 'photo') $('#btn-analyze').disabled = false;
  } else {
    preview.innerHTML = '<i data-lucide="image-plus" class="preview-icon"></i><span>Tire uma foto ou escolha da galeria</span>';
    if (estado.captureMode === 'photo') $('#btn-analyze').disabled = false;
    if (window.lucide) lucide.createIcons();
  }
}

export async function selecionarImagem(captureFn) {
  try {
    const raw = await captureFn();
    if (!raw) return;
    const img = await downscaleImage(raw.dataUrl, 1024);
    definirImagemCaptura(img);
  } catch (e) {
    informarErroCaptura(e.message || 'Não foi possível abrir a imagem. Escolha outra imagem da galeria.');
  }
}

export async function analisarCaptura() {
  if (estado.captureMode === 'text') {
    await analisarTexto();
    return;
  }

  $('#captura-feedback').textContent = '';
  if (!estado.currentImage) { informarErroCaptura('Tire uma foto ou escolha uma imagem da galeria antes de analisar.');return; }
  const imagemAnalisada = estado.currentImage;
  const sinal=iniciarProcessamento();if(!sinal)return;
  const btn = $('#btn-analyze');
  btn.disabled = true;
  const skeleton = $('#skeleton-loading');
  skeleton.style.display = 'block';
  iniciarMensagemProcessamento('#bowl-text-photo', MENSAGENS_ANALISE);
  try {
    const result = await analyzeImage({...imagemAnalisada,signal:sinal});
    await validarComTaco(result.alimentos);
    if(sinal.aborted)return;
    estado.currentAnalysis = result;estado.imagemDaAnalise = imagemAnalisada.dataUrl;
    renderizarResultados();
    mostrarTela('results');
  } catch (e) {
    informarErroCaptura(e.message || 'Não foi possível analisar. Tente novamente quando houver conexão.');
  } finally {
    btn.disabled = false;
    skeleton.style.display = 'none';
    encerrarMensagemProcessamento(); finalizarProcessamento();
  }
}

export const MENSAGENS_TEXTO = [
  'Consultando base nutricional...',
  'Buscando na TACO...',
  'Calculando macros...',
  'Quase pronto...',
];

export async function analisarTexto({ usarIa = false } = {}) {
  $('#captura-feedback').textContent = '';
  const nomeInput = $('#text-food-name');
  const gramsInput = $('#text-food-grams');
  const nome = nomeInput.value.trim();
  const gramas = gramsInput.value ? Number(gramsInput.value) : null;

  if (gramas !== null && (!Number.isFinite(gramas) || gramas <= 0 || gramas > 10000)) { informarErroCaptura('Informe uma quantidade maior que zero, até 10.000 g.'); return; }
  if (!nome) {
    informarErroCaptura('Digite o nome do alimento.');
    return;
  }

  const sinal=iniciarProcessamento();if(!sinal)return;
  const btn = $('#btn-analyze');
  btn.disabled = true;
  const skeleton = $('#skeleton-loading');
  skeleton.style.display = 'block';
  iniciarMensagemProcessamento('#bowl-text-photo', MENSAGENS_TEXTO);

  try {
    let result;

    // 1) Busca primeiro na TACO local (offline, instantâneo)
    $('#sugestoes-taco')?.remove();
    const correspondencia = await buscarCorrespondenciaTaco(nome);
    const baseIncompleta=correspondencia.alimento&&!correspondencia.alimento.nutrientesDisponiveis;
    const tacoMatch = correspondencia.alimento?.nutrientesDisponiveis?correspondencia.alimento:null;
    if(!tacoMatch && (baseIncompleta||correspondencia.sugestoes.length) && !usarIa){
      const opcoes=document.createElement('div');opcoes.id='sugestoes-taco';opcoes.className='settings-card';opcoes.setAttribute('role','group');opcoes.setAttribute('aria-label','Confirme o alimento na TACO');
      const titulo=document.createElement('p');titulo.textContent=baseIncompleta?'Este alimento está na TACO, mas seus nutrientes não estão disponíveis. Você pode solicitar uma estimativa por IA.':'Há opções diferentes. Confirme o alimento e seu preparo:';opcoes.append(titulo);
      for(const sugestao of correspondencia.sugestoes.filter(possuiNutrientesTaco)){const botao=document.createElement('button');botao.type='button';botao.className='btn-secondary';botao.textContent=sugestao.nome;botao.onclick=()=>{nomeInput.value=sugestao.nome;gramsInput.value=gramas||100;analisarTexto();};opcoes.append(botao);}
      const estimar=document.createElement('button');estimar.type='button';estimar.className='btn-secondary';estimar.textContent='Usar estimativa por IA em vez da base';estimar.onclick=()=>analisarTexto({usarIa:true});opcoes.append(estimar);$('#capture-text-area').append(opcoes);avisar('Confirme o alimento na lista antes de calcular.');return;
    }
    if (tacoMatch) {
      const peso = gramas || 100; // default: 100g se não informado
      const alimento = {
        ...ajustarPorcao({ ...tacoMatch, porcao_estimada_g: 100 }, peso),
        marca_identificada: null,
        validado: true,
        base_origem: 'taco',
        nome_base: tacoMatch.nome,
      };
      alimento.calorias_original = alimento.calorias;
      alimento.proteina_original = alimento.proteina_g;
      alimento.carbo_original = alimento.carboidrato_g;
      alimento.gordura_original = alimento.gordura_g;

      result = {
        alimentos: [alimento],
        total: {
          calorias: alimento.calorias,
          proteina_g: alimento.proteina_g,
          carboidrato_g: alimento.carboidrato_g,
          gordura_g: alimento.gordura_g,
        },
      };
    } else {
      // 2) Fallback: chama a IA com prompt de texto
      result = await analyzeText({ nome, gramas, signal:sinal });
      await validarComTaco(result.alimentos);
    }

    if(sinal.aborted)return;
    estado.currentAnalysis = result;estado.imagemDaAnalise = null;
    renderizarResultados();
    mostrarTela('results');
  } catch (e) {
    informarErroCaptura(e.message || 'Não foi possível analisar. Tente novamente quando houver conexão.');
  } finally {
    btn.disabled = false;
    skeleton.style.display = 'none';
    encerrarMensagemProcessamento(); finalizarProcessamento();
  }
}

/**
 * Para cada alimento SEM marca_identificada, busca na base TACO (local, offline).
 * Se encontrar: substitui calorias/proteina_g/carboidrato_g/gordura_g pelos valores
 * REAIS da TACO (valor por 100g × porcao_estimada_g / 100).
 * Mantém porcao_estimada_g exatamente como a IA estimou.
 * Adiciona campos validado, base_origem e nome_base para auditoria.
 */
export async function validarComTaco(alimentos) {
  const promises = alimentos.map(async (alimento) => {
    // Só valida alimentos sem marca identificada (comida caseira/in natura)
    if (alimento.marca_identificada) {
      alimento.validado = false;
      alimento.base_origem = 'ia';
      alimento.nome_base = null;
      return;
    }

    const taco = await buscarValidacaoTaco(alimento.nome);
    if (!taco) {
      alimento.validado = false;
      alimento.base_origem = 'ia';
      alimento.nome_base = null;
      return;
    }

    // Encontrou na TACO: usa valores de referência por 100g, escalados pelo peso da IA
    const pesoEstimado = alimento.porcao_estimada_g;
    const novoAlimento = ajustarPorcao({ ...taco, porcao_estimada_g: 100 }, pesoEstimado);
    Object.assign(alimento, novoAlimento);
    // Salva os valores originais da IA para permitir Edição/Recálculo proporcional
    alimento.calorias_original = alimento.calorias;
    alimento.proteina_original = alimento.proteina_g;
    alimento.carbo_original = alimento.carboidrato_g;
    alimento.gordura_original = alimento.gordura_g;
    alimento.porcao_original_g = alimento.porcao_estimada_g;
    alimento.nutrientes_origem = { calorias: alimento.calorias, proteina_g: alimento.proteina_g, carboidrato_g: alimento.carboidrato_g, gordura_g: alimento.gordura_g };

    alimento.validado = true;
    alimento.base_origem = 'taco';
    alimento.nome_base = taco.nome; // nome exato encontrado na TACO, para auditoria
  });

  await Promise.all(promises);
}

