import { reservarChaveIa, concluirChaveIa } from './chavesIa.js';
import { obterContaArmazenamento } from './storage.js';
import { obterContaOffline,lembrarContaVerificada,esquecerContinuidadeConta } from './continuidadeConta.js';
let tokenProtecao = '';
let sessaoAtual = null;
function invalidarContextoConta(){sessaoAtual=null;tokenProtecao='';esquecerContinuidadeConta();if(typeof window!=='undefined')window.dispatchEvent(new Event('nutrifoto:sessao-expirada'));}
export async function consultarSessao(signal) {
  const resposta = await fetch('/api/conta', { credentials: 'same-origin', cache: 'no-store', signal: signal || AbortSignal.timeout(10000) });
  if (!resposta.ok) throw Object.assign(new Error('Não foi possível verificar sua sessão. Tente novamente.'),{status:resposta.status});
  sessaoAtual = await resposta.json(); tokenProtecao = sessaoAtual.csrf || '';
  return sessaoAtual;
}
export function obterSessaoAtual() { return sessaoAtual; }
export async function requisitarApi(caminho, opcoes = {}) {
  if (typeof window !== 'undefined' && window.NutriFotoAndroid && caminho === '/api/ia') return (await import('./licenca.js')).analisarComLicenca(JSON.parse(opcoes.body), opcoes);
  const usaIa = caminho === '/api/ia';
  let acaoConta;try{if(caminho==='/api/conta'&&opcoes.body)acaoConta=JSON.parse(opcoes.body).acao;}catch{}
  const protegeConta=caminho!=='/api/conta'||['sair','excluir'].includes(acaoConta);
  // Capturado antes de qualquer await: uma sessão descoberta depois não muda o dono da intenção.
  const contaEsperada=protegeConta?obterContaArmazenamento():null;
  if(usaIa && typeof sessionStorage !== 'undefined' && sessionStorage.getItem('nutrifoto.cienciaIa') !== '1') throw new Error('Abra Minha conta → Privacidade e confirme o envio à IA antes de analisar.');
  const controle = new AbortController();
  const cancelar = () => controle.abort();
  opcoes.signal?.addEventListener('abort', cancelar, { once: true });
  if (opcoes.signal?.aborted) controle.abort();
  const temporizador = setTimeout(cancelar, 35000);
  try {
    const revalidando=protegeConta&&Boolean(obterContaOffline());
    if (!tokenProtecao||revalidando) await consultarSessao(controle.signal);
    const sessaoDoPedido=sessaoAtual;
    if(usaIa&&!sessaoDoPedido?.usuario)throw new Error('A IA não está disponível neste acesso de demonstração Web. Use a busca TACO local ou ative um plano no aplicativo Android quando o serviço estiver configurado.');
    if(protegeConta&&contaEsperada&&sessaoDoPedido?.usuario?.id!==contaEsperada){invalidarContextoConta();throw Object.assign(new Error('A conta mudou ou a sessão terminou. Entre novamente antes de continuar.'),{status:409,codigo:'CONTA_ALTERADA'});}
    if(contaEsperada&&obterContaArmazenamento()!==contaEsperada)throw new Error('A conta mudou durante a operação. Tente novamente.');
    if(revalidando){lembrarContaVerificada(sessaoDoPedido?.usuario?.id);if(typeof window!=='undefined')window.dispatchEvent(new Event('nutrifoto:conta-revalidada'));}
    const intencaoIa=usaIa?await reservarChaveIa(sessaoDoPedido?.usuario?.id,opcoes.body):null;
    const resposta = await fetch(caminho, { ...opcoes, credentials: 'same-origin', cache: 'no-store', signal: controle.signal,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': tokenProtecao, 'X-Idempotency-Key': crypto.randomUUID(), ...(usaIa ? {'X-Ciencia-IA':'1'} : {}), ...opcoes.headers, ...(intencaoIa?{'X-Idempotency-Key':intencaoIa.chave}:{}), ...(contaEsperada?{'X-Conta-Esperada':contaEsperada}:{}) } });
    const conteudo = await resposta.json().catch(() => {
      if(usaIa)throw new Error('Resposta interrompida ou inválida. Tente novamente para recuperar a mesma análise.');
      return {};
    });
    if (!resposta.ok) {
      if ((resposta.status===401||conteudo.codigo==='CONTA_ALTERADA')&&sessaoAtual===sessaoDoPedido)invalidarContextoConta();
      const erro = new Error(conteudo.erro || conteudo.error || 'Não foi possível concluir. Tente novamente.'); erro.status = resposta.status; throw erro;
    }
    if(contaEsperada&&obterContaArmazenamento()!==contaEsperada)throw new Error('A conta mudou durante a operação. Tente novamente.');
    concluirChaveIa(intencaoIa);
    return conteudo;
  } catch (erro) {
    if (erro.name === 'AbortError') throw new Error('Operação cancelada ou tempo esgotado. Tente novamente.');
    throw erro;
  } finally { clearTimeout(temporizador); opcoes.signal?.removeEventListener('abort', cancelar); }
}
