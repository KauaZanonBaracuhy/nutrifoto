import { requisitarApi } from './servicoHttp.js';
import { ajustarPorcao, somarNutrientes, validarAnalise } from './nutricao.js';
export { ajustarPorcao } from './nutricao.js';

// O prazo cobre conexão e leitura do corpo. O cancelamento do chamador também é preservado.
export async function requisitarIa(dados, { signal, prazoMs = 30000 } = {}) {
  const controlador = new AbortController();
  const cancelar = () => controlador.abort();
  if (signal?.aborted) cancelar();
  signal?.addEventListener('abort', cancelar, { once: true });
  const temporizador = setTimeout(cancelar, prazoMs);
  let rejeitarCancelamento;
  const cancelamento = new Promise((_, rejeitar) => { rejeitarCancelamento = rejeitar; });
  const rejeitar = () => rejeitarCancelamento(new Error(signal?.aborted ? 'Operação cancelada.' : 'Tempo esgotado. Tente novamente.'));
  controlador.signal.addEventListener('abort', rejeitar, { once: true });
  try {
    if (controlador.signal.aborted) throw new Error('Operação cancelada.');
    return await Promise.race([
      requisitarApi('/api/ia', { method: 'POST', credentials: 'same-origin', body: JSON.stringify(dados), signal: controlador.signal }),
      cancelamento,
    ]);
  } finally {
    clearTimeout(temporizador);
    signal?.removeEventListener('abort', cancelar);
    controlador.signal.removeEventListener('abort', rejeitar);
  }
}

export function recalcularTotal(alimentos) { return somarNutrientes(alimentos); }

export async function analyzeImage({ base64, mediaType, signal }) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) || typeof base64 !== 'string' || !base64 || base64.length > 8000000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error('Imagem inválida ou muito grande.');
  return validarAnalise(await requisitarIa({ tipo: 'foto', base64, mediaType }, { signal }));
}

export async function analyzeText({ nome, gramas, signal }) {
  if (typeof nome !== 'string' || !nome.trim() || nome.length > 300) throw new Error('Informe um alimento específico.');
  if (gramas != null && (typeof gramas !== 'number' || !Number.isFinite(gramas) || gramas <= 0 || gramas > 10000)) throw new Error('Informe uma quantidade válida em gramas.');
  return validarAnalise(await requisitarIa({ tipo: 'texto', texto: nome.trim(), gramas }, { signal }));
}

export async function testConnection() {
  try { await requisitarApi('/api/conta'); return { ok: true, message: 'Sessão conectada. Disponibilidade da IA é verificada ao analisar.' }; }
  catch { return { ok: false, error: 'Entre na sua conta para utilizar a IA.' }; }
}
