import { enviarImagemRemota, removerFotosDoPacote } from './imagensRemotas.js';
import { exportarBackupIntegral, lerPreferencias, restaurarDadosIntegrais, mesclarDadosIntegrais, validarDadosIntegrais } from './backup.js';
import { definirContaLocal, lerEstadoRemoto, gravarEstadoRemoto, lerDadosIntegrais, registrarImagemRemota } from './db.js';
import { obterContaArmazenamento } from './storage.js';
import { requisitarApi } from './servicoHttp.js';
let sincronizacaoAtual;
let controleSincronizacao;
const lerEstado = lerEstadoRemoto;
const salvarEstado = gravarEstadoRemoto;
async function assinarDados(dados) {
  const resumo = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(removerFotosDoPacote(dados))));
  return Array.from(new Uint8Array(resumo), valor => valor.toString(16).padStart(2, '0')).join('');
}
function conferirConta(conta) { if (!conta || obterContaArmazenamento() !== conta) throw new Error('A conta mudou durante a sincronização. Tente novamente.'); }
function possuiDados(dados) { return dados.meals.length || dados.weights.length || dados.water.length || dados.perfil || dados.plano || dados.metas; }
function normalizarRemoto(dados) { return validarDadosIntegrais({ meals: [], weights: [], water: [], ...dados }); }
export function obterEstadoSincronizacao() { return lerEstado(); }
export async function sincronizarDados({ resolverConflito } = {}) {
  if (sincronizacaoAtual) return sincronizacaoAtual;
  const controle = new AbortController();
  controleSincronizacao = controle;
  const tarefa = executarSincronizacao(resolverConflito, controle.signal);
  sincronizacaoAtual = tarefa;
  try { return await tarefa; } finally { if (sincronizacaoAtual === tarefa) sincronizacaoAtual = undefined; }
}
async function executarSincronizacao(resolverConflito, sinal) {
  const conta = obterContaArmazenamento();
  function verificarContexto() { conferirConta(conta); sinal.throwIfAborted(); }
  function salvarEstadoSeguro(estado) { verificarContexto(); return salvarEstado(estado); }
  function chamarApi(caminho, opcoes = {}) { verificarContexto(); return requisitarApi(caminho, { ...opcoes, signal: sinal }); }
  verificarContexto();
  let estado = await lerEstado();
  const resposta = await chamarApi('/api/dados');
  verificarContexto();
  const remoto = normalizarRemoto(resposta.dados || {});
  let locais = { ...await lerDadosIntegrais(), ...lerPreferencias() };
  for (const refeicao of locais.meals) {
    if (refeicao.imageDataUrl && !refeicao.imagemRemota) {
      verificarContexto();
      const referencia = await enviarImagemRemota(refeicao.imageDataUrl, sinal);
      verificarContexto();
      await registrarImagemRemota(refeicao.id, referencia);
      refeicao.imagemRemota = referencia;
    }
  }
  function preservarFotosLocais(dados) {
    return { ...dados, meals: dados.meals.map(refeicao => {
      const anterior = locais.meals.find(local => local.id === refeicao.id && local.imagemRemota === refeicao.imagemRemota);
      return anterior?.imageDataUrl ? { ...refeicao, imageDataUrl: anterior.imageDataUrl } : refeicao;
    }) };
  }
  verificarContexto();
  const assinaturaLocal = await assinarDados(locais);
  const alterado = estado.base !== assinaturaLocal;
  if (estado.pendente && resolverConflito && resposta.revisao !== estado.pendente.revisao) {
    delete estado.pendente; await salvarEstadoSeguro(estado);
  }
  if (estado.pendente) {
    // Uma resposta perdida reutiliza exatamente a intenção e o corpo persistidos.
    const recebido = await chamarApi('/api/dados', { method: 'PUT', headers: { 'X-Idempotency-Key': estado.pendente.chave }, body: JSON.stringify({ revisao: estado.pendente.revisao, dados: estado.pendente.dados }) });
    verificarContexto();
    estado = { revisao: recebido.revisao, base: await assinarDados(estado.pendente.dados) };
    await salvarEstadoSeguro(estado);
    return { revisao: estado.revisao, repeticaoRecuperada: true, alteracoesLocaisPendentes: estado.base !== assinaturaLocal };
  }
  const remotoMudou = resposta.revisao !== estado.revisao;
  if ((!estado.base && possuiDados(remoto) && possuiDados(locais)) || (remotoMudou && alterado && estado.base)) {
    if (!['local', 'remoto', 'mesclar'].includes(resolverConflito)) {
      const erro = new Error('Há alterações nos dois dispositivos. Escolha manter os dados locais, remotos ou mesclar antes de continuar.');
      erro.status = 409; throw erro;
    }
    if (resolverConflito === 'remoto') {
      await restaurarDadosIntegrais(preservarFotosLocais(remoto)); verificarContexto();
      await salvarEstadoSeguro({ revisao: resposta.revisao, base: await assinarDados(remoto) });
      return { revisao: resposta.revisao, recebidos: true };
    }
    if (resolverConflito === 'mesclar') locais = mesclarDadosIntegrais(locais, remoto, 'local');
  } else if (remotoMudou || (!estado.base && possuiDados(remoto))) {
    await restaurarDadosIntegrais(preservarFotosLocais(remoto)); verificarContexto();
    await salvarEstadoSeguro({ revisao: resposta.revisao, base: await assinarDados(remoto) });
    return { revisao: resposta.revisao, recebidos: true };
  } else if (!alterado) return { revisao: resposta.revisao, semAlteracoes: true };
  const pendente = { chave: crypto.randomUUID(), revisao: resposta.revisao, dados: removerFotosDoPacote(locais) };
  await salvarEstadoSeguro({ ...estado, pendente });
  const recebido = await chamarApi('/api/dados', { method: 'PUT', headers: { 'X-Idempotency-Key': pendente.chave }, body: JSON.stringify({ revisao: pendente.revisao, dados: pendente.dados }) });
  verificarContexto();
  if (resolverConflito === 'mesclar') await restaurarDadosIntegrais(locais);
  verificarContexto();
  await salvarEstadoSeguro({ revisao: recebido.revisao, base: await assinarDados(locais) });
  const atuais = { ...await lerDadosIntegrais(), ...lerPreferencias() };
  verificarContexto();
  return { revisao: recebido.revisao, enviados: true, alteracoesLocaisPendentes: JSON.stringify(atuais) !== JSON.stringify(locais) };
}
export async function migrarDadosLegados({ consentimento = false, conflito = 'local' } = {}) {
  if (consentimento !== true) throw new Error('A migração exige confirmação explícita do titular.');
  const conta = obterContaArmazenamento(); conferirConta(conta);
  if (sincronizacaoAtual) throw new Error('Aguarde a sincronização antes de migrar.');
  let legado;
  try { definirContaLocal(null); legado = (await exportarBackupIntegral()).dados; }
  finally { definirContaLocal(conta); }
  const atuais = (await exportarBackupIntegral()).dados;
  conferirConta(conta);
  // O original permanece intacto no banco legado; colisões seguem escolha explícita.
  const dados = mesclarDadosIntegrais(atuais, legado, conflito);
  await restaurarDadosIntegrais(dados);
  return { importadas: legado.meals.length, sincronizacaoNecessaria: true };
}

let temporizadorSincronizacao;
export function agendarSincronizacao() {
  if (!obterContaArmazenamento()) return;
  clearTimeout(temporizadorSincronizacao);
  temporizadorSincronizacao = setTimeout(async () => {
    try {
      const estado = await sincronizarDados();
      window.dispatchEvent(new CustomEvent('nutrifoto:sincronizacao', { detail: { estado } }));
      if (estado.alteracoesLocaisPendentes) agendarSincronizacao();
    } catch (erro) {
      window.dispatchEvent(new CustomEvent('nutrifoto:sincronizacao', { detail: { erro: erro.message, estado: 'pendente' } }));
    }
  }, 750);
}
if (typeof window !== 'undefined') window.addEventListener('online', agendarSincronizacao);
// Ao voltar de outro dispositivo, busque a revisão remota sem exigir uma edição local.
if (typeof window !== 'undefined') window.addEventListener('focus', agendarSincronizacao);
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') agendarSincronizacao();
});
if (typeof window !== 'undefined') window.addEventListener('nutrifoto:troca-conta', () => {
  clearTimeout(temporizadorSincronizacao);
  controleSincronizacao?.abort();
});


