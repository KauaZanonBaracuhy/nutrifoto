import { reservarChaveIa, concluirChaveIa } from './chavesIa.js';
import { VERSAO_APLICATIVO } from './base.js';
let identidade, situacao, ocupado = false, temporizador, escolhaUsuario;
const chaveCompra = 'nutrifoto.pixPendente';
const elemento = id => document.getElementById(id);
async function buscarLicenca(opcoes) { try { return await fetch('/api/licenca', { ...opcoes, signal: AbortSignal.timeout(15000) }); } catch (erro) { if (erro.codigo === 'BACKEND_NAO_CONFIGURADO') throw erro;throw new Error('Não conseguimos conectar ao serviço. Tente atualizar a ativação novamente quando houver conexão.'); } }
async function lerResposta(resposta) { const dados = await resposta.json(); if (!resposta.ok) throw Object.assign(new Error(dados.erro || 'Ativação indisponível.'), { status: resposta.status }); return dados; }
export async function requisitarLicenca(pedido) {
  if (!window.NutriFotoAndroid || !window.NutriFotoKeystore) throw new Error('A Web é uma demonstração. A ativação segura está disponível no aplicativo Android.');
  const { nonce } = await lerResposta(await buscarLicenca({ method: 'POST', body: JSON.stringify({ acao: 'desafio' }), headers: { 'Content-Type': 'application/json' } }));
  for (let tentativa = 0; !identidade && tentativa < 100; tentativa++) {
    const preparada = JSON.parse(window.NutriFotoKeystore.identidade());
    if (preparada.erro) throw new Error(preparada.erro);
    if (!preparada.pendente) identidade = preparada;else await new Promise(resolver => setTimeout(resolver, 200));
  }
  if (!identidade) throw new Error('A proteção da instalação ainda está sendo preparada. Tente atualizar a ativação novamente.');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(pedido)));
  const resumo = Array.from(new Uint8Array(bytes), parte => parte.toString(16).padStart(2, '0')).join('');
  const assinatura = window.NutriFotoKeystore.assinar(nonce, resumo);
  return lerResposta(await buscarLicenca({ method: 'POST', body: JSON.stringify({ ...identidade, nonce, assinatura, pedido }), headers: { 'Content-Type': 'application/json' } }));
}
export async function analisarComLicenca(dados, opcoes = {}) {
  if (sessionStorage.getItem('nutrifoto.cienciaIa') !== '1') throw new Error('Confirme o envio dos dados à IA em Seu NutriFoto · ativação.');
  if (opcoes.signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  situacao = await requisitarLicenca({ acao: 'situacao' });
  if (!situacao.ativa) throw new Error(situacao.bloqueada ? 'Seu pagamento está em revisão. Procure o atendimento em Seu NutriFoto.' : situacao.validade && new Date(situacao.validade) <= new Date() ? 'Seu acesso à IA terminou. Renove em Seu NutriFoto para continuar.' : 'Para utilizar a IA, ative um plano de 30 dias em Seu NutriFoto.');
  const oferta = situacao.planos.find(plano => plano.id === situacao.plano), foto = dados.tipo === 'foto';
  if (oferta && (foto ? situacao.uso?.fotos >= oferta.fotos : situacao.uso?.textos >= oferta.textos)) throw new Error('Você atingiu seu limite de análises de hoje. Ele será renovado amanhã, à meia-noite de Brasília.');
  const intencao = await reservarChaveIa(situacao.id, JSON.stringify(dados));
  if (opcoes.signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  const resultado = await requisitarLicenca({ acao: 'analise', dados, ciencia: true, intencao: intencao.chave });
  concluirChaveIa(intencao);
  return resultado;
}
export async function autorizarAcompanhamento() { if (typeof window !== 'undefined' && window.NutriFotoAndroid) await requisitarLicenca({ acao: 'autorizar', recurso: 'acompanhamento' }); }
function mostrarOfertas(planos) {
  const recipiente = elemento('licenca-ofertas');recipiente.replaceChildren();
  for (const plano of planos) {
    const cartao = document.createElement('label');cartao.className = 'diet-section licenca-oferta';
    const radio = document.createElement('input');radio.type = 'radio';radio.name = 'licenca-plano';radio.value = plano.id;radio.checked = plano.id === (situacao?.plano || 'ia');
    radio.checked = plano.id === (escolhaUsuario || situacao?.plano || 'ia');
    radio.onchange = () => { if (situacao?.ativa && situacao.plano !== plano.id) { radio.checked = false;recipiente.querySelector(`[value="${situacao.plano}"]`).checked = true;elemento('licenca-erro').textContent = 'Sua licença está vigente. Você pode renovar o plano atual; a troca de plano fica disponível após o vencimento.';return; } escolhaUsuario = plano.id; };
    const conteudo = document.createElement('span'), titulo = document.createElement('strong'), preco = document.createElement('b'), beneficios = document.createElement('span');
    titulo.textContent = plano.nome;preco.textContent = (plano.centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ' / 30 dias';
    beneficios.textContent = `Até ${plano.fotos} fotos e ${plano.textos} análises textuais por dia. Reconhecimento alimentar e informações nutricionais.` + (plano.acompanhamento ? ' Acompanhamento, gráficos, peso, água e metas manuais.' : ' Diário alimentar e revisão das estimativas.');
    conteudo.append(titulo, preco, beneficios);cartao.append(radio, conteudo);recipiente.append(cartao);
  }
}
function atualizarEstado() {
  const nativo = Boolean(window.NutriFotoAndroid);
  elemento('licenca-status').textContent = situacao ? situacao.bloqueada ? 'Ativação suspensa para revisão de pagamento.' : situacao.ativa ? 'Sua licença está ativa neste dispositivo.' : situacao.validade && new Date(situacao.validade) <= new Date() ? 'Seu acesso à IA terminou. Renove para continuar. Seus registros estão preservados.' : 'Sem licença vigente. Seus registros continuam disponíveis.' : nativo ? 'Ativação aguardando conexão com o servidor.' : 'Demonstração Web — a licença utiliza a proteção do Android.';
  elemento('licenca-dias').textContent = situacao?.ativa ? `${situacao.diasRestantes} dias restantes · até ${new Date(situacao.validade).toLocaleString('pt-BR')}` : '';
  const plano = situacao?.planos.find(item => item.id === situacao.plano);
  elemento('licenca-uso').textContent = plano && situacao.ativa ? `Hoje: ${Math.max(0, plano.fotos - (situacao.uso?.fotos || 0))} fotos e ${Math.max(0, plano.textos - (situacao.uso?.textos || 0))} análises textuais disponíveis.` : '';
  elemento('licenca-pagador').hidden = false;
  for (const id of ['licenca-nome', 'licenca-documento']) elemento(id).closest('.diet-field').hidden = !nativo;
  elemento('licenca-pagar').disabled = ocupado;
  for (const id of ['licenca-atualizar', 'licenca-guardar', 'licenca-transferir']) elemento(id).disabled = ocupado;
}
async function executar(acao) {
  if (ocupado) return;ocupado = true;atualizarEstado();elemento('licenca-erro').textContent = '';
  try { await acao(); } catch (erro) { elemento('licenca-erro').textContent = erro.message; }
  finally { ocupado = false;atualizarEstado();elemento('licenca-erro').scrollIntoView({block:'nearest'}); }
}
async function consultar() {
  const compra = localStorage.getItem(chaveCompra);
  situacao = null;
  try { situacao = await requisitarLicenca({ acao: 'situacao', ...(compra ? { compra } : {}) }); }
  catch (erro) { if (compra && erro.status === 404) { localStorage.removeItem(chaveCompra);situacao = await requisitarLicenca({ acao: 'situacao' }); } else throw erro; }
  mostrarOfertas(situacao.planos);atualizarEstado();elemento('licenca-erro').textContent = situacao.ativa ? 'Ativação atualizada. Sua licença continua ativa.' : situacao.bloqueada ? 'Pagamento em revisão. Procure o atendimento para resolver a suspensão.' : 'Consulta concluída. Escolha um plano e pague com Pix para ativar este dispositivo.';
  if (situacao.compraPendente) localStorage.setItem(chaveCompra, situacao.compraPendente);
  if (situacao.qr) mostrarPix(situacao.qr);
  if (!situacao.compraPendente || situacao.compraStatus === 'RECEIVED' || ['CANCELLED','DELETED','OVERDUE','REFUNDED','REVERTIDA'].includes(situacao.compraStatus) || situacao.bloqueada) { localStorage.removeItem(chaveCompra);elemento('licenca-pix').hidden = true;clearInterval(temporizador); }
}
function mostrarPix(qr) {
  if (!qr || typeof qr.payload !== 'string' || qr.payload.length > 10000 || !/^[A-Za-z0-9+/=]+$/.test(qr.encodedImage) || qr.encodedImage.length > 500000) return;
  elemento('licenca-qr').src = 'data:image/png;base64,' + qr.encodedImage;elemento('licenca-copia').value = qr.payload;elemento('licenca-pix').hidden = false;
}
export async function iniciarLicenca() {
  elemento('licenca-versao').textContent = 'Licença por dispositivo · ' + VERSAO_APLICATIVO;
  elemento('privacidade-excluir').hidden = true;
  elemento('privacidade-apagar-local').textContent = 'Apagar registros locais deste dispositivo';
  for (const link of document.querySelectorAll('[data-ir-tela=conta],[data-ir-tela=assinatura]')) { link.dataset.irTela = 'ativacao';link.textContent = 'Seu NutriFoto · ativação'; }
  elemento('licenca-atualizar').onclick = () => executar(consultar);
  elemento('licenca-pagador').onsubmit = evento => { evento.preventDefault();executar(async () => {
    if (!window.NutriFotoAndroid) throw new Error('Demonstração Web: o pagamento por dispositivo é feito no aplicativo Android. O backend HTTPS e o Pix sandbox ainda precisam ser configurados; nenhum Pix será criado aqui.');
    if (!situacao) throw new Error('Não foi possível consultar a ativação. Toque em Atualizar ativação e tente novamente antes de pagar.');
    if (situacao.bloqueada) throw new Error('Sua ativação está suspensa para revisão do pagamento. Procure o atendimento antes de pagar novamente.');
    if (elemento('licenca-nome').value.trim().length < 3) { elemento('licenca-nome').focus();throw new Error('Informe o nome do pagador com pelo menos três letras.'); }
    if (![11,14].includes(elemento('licenca-documento').value.replace(/\D/g, '').length)) { elemento('licenca-documento').focus();throw new Error('Informe o CPF com 11 dígitos ou CNPJ com 14 dígitos do pagador.'); }
    const plano = document.querySelector('[name=licenca-plano]:checked')?.value;
    const intencao = localStorage.getItem(chaveCompra) || crypto.randomUUID();localStorage.setItem(chaveCompra, intencao);
    const resposta = await requisitarLicenca({ acao: 'pix', plano, intencao, pagador: { nome: elemento('licenca-nome').value.trim(), documento: elemento('licenca-documento').value.replace(/\D/g, '') } });
    mostrarPix(resposta.qr);
    await consultar();clearInterval(temporizador);temporizador = setInterval(() => { if (!document.hidden && !ocupado) executar(consultar); }, 15000);
  }); };
  elemento('licenca-copiar').onclick = () => executar(async () => { await navigator.clipboard.writeText(elemento('licenca-copia').value);elemento('licenca-erro').textContent = 'Código Pix copiado.'; });
  elemento('licenca-guardar').onclick = () => executar(async () => { const resposta = await requisitarLicenca({ acao: 'recuperacao' });elemento('licenca-codigo').textContent = resposta.codigo; });
  elemento('licenca-transferir').onclick = () => executar(async () => { await requisitarLicenca({ acao: 'transferir', codigo: elemento('licenca-recuperacao').value.trim() });localStorage.removeItem(chaveCompra);elemento('licenca-recuperacao').value = '';await consultar(); });
  elemento('licenca-ciencia').checked = sessionStorage.getItem('nutrifoto.cienciaIa') === '1';
  elemento('licenca-ciencia').onchange = evento => { if (evento.target.checked) sessionStorage.setItem('nutrifoto.cienciaIa', '1');else sessionStorage.removeItem('nutrifoto.cienciaIa'); };
  const referencia = await fetch('/data/licencas.json').then(resposta => resposta.json());mostrarOfertas(referencia);atualizarEstado();
  if (window.NutriFotoAndroid) await executar(consultar);
  document.addEventListener('nutrifoto:tela', evento => { if (evento.detail !== 'ativacao') elemento('licenca-codigo').textContent = '';else if (window.NutriFotoAndroid) executar(consultar); });
}
