import { obterChaveLocal } from './storage.js';
import { validarPerfil, validarPlano } from './nutricao.js';
import { requisitarIa } from './visionApi.js';

const CHAVE_PERFIL = 'nutrifoto.userProfile';
const CHAVE_PLANO = 'nutrifoto.currentPlan';

function lerRegistro(chave) {
  try { return JSON.parse(localStorage.getItem(obterChaveLocal(chave)) || 'null'); }
  catch { return null; }
}

export function getUserProfile() { return lerRegistro(CHAVE_PERFIL); }
export function saveUserProfile(perfil) {
  localStorage.setItem(obterChaveLocal(CHAVE_PERFIL), JSON.stringify(validarPerfil(perfil, { paraPlano: false })));
}
export function getCurrentPlan() { return lerRegistro(CHAVE_PLANO); }
export function saveCurrentPlan(plano) {
  localStorage.setItem(obterChaveLocal(CHAVE_PLANO), JSON.stringify(validarPlano(plano)));
}
export function clearCurrentPlan() { localStorage.removeItem(obterChaveLocal(CHAVE_PLANO)); }

export { buildPrompt, minimizarPerfil } from './promptPlano.js';
import { minimizarPerfil } from './promptPlano.js';

export async function gerarPlanoAlimentar(perfil, opcoes = {}) {
  const minimizado = minimizarPerfil(perfil);
  return validarPlano(await requisitarIa({ tipo: 'plano', perfil: minimizado }, { ...opcoes, prazoMs: opcoes.prazoMs ?? 45000 }));
}
