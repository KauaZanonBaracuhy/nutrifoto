// Preferências isoladas por conta. Nomes antigos permanecem no espaço legado.
let contaAtual = null;
const METAS_PADRAO = { calories: 2200, protein: 150, carb: 250, fat: 70, waterGoal: 2000 };
export function definirContaArmazenamento(id) { contaAtual = id ? String(id) : null; }
export function obterChaveLocal(chave) {
  return contaAtual ? `nutrifoto.conta.${encodeURIComponent(contaAtual)}.${chave.replace(/^nutrifoto\./, '')}` : chave;
}
export const getChaveLocal = obterChaveLocal;
export function obterContaArmazenamento() { return contaAtual; }
// Compatibilidade temporária: chaves privadas nunca são lidas nem persistidas.
export function getApiKey() { return ''; }
export function setApiKey() { localStorage.removeItem('nutrifoto.apiKey'); return false; }
export function isConfigured() { return true; }
export function getApiKeySource() { return 'servidor'; }
export function getGoals() {
  try { const metas={ ...METAS_PADRAO, ...JSON.parse(localStorage.getItem(obterChaveLocal('nutrifoto.goals')) || '{}') };for(const campo of Object.keys(METAS_PADRAO))if(!Number.isFinite(metas[campo])||metas[campo]<=0)metas[campo]=METAS_PADRAO[campo];return metas; }
  catch { return { ...METAS_PADRAO }; }
}
export function setGoals(metas) {
  const atualizadas = { ...getGoals(), ...metas };
  for (const campo of Object.keys(METAS_PADRAO)) {
    if (!Number.isFinite(atualizadas[campo]) || atualizadas[campo] <= 0) throw new Error('Metas devem ser números positivos.');
  }
  localStorage.setItem(obterChaveLocal('nutrifoto.goals'), JSON.stringify(atualizadas));
}
