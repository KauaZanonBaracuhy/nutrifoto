// storage.js — localStorage para metas diárias + leitura da chave OpenRouter

// Config local em desenvolvimento: config.local.js (definido em outro <script>)
// define window.OPENROUTER_API_KEY. Em produção, esse arquivo não existe (não é
// commitado) e o usuário precisa digitar a chave na tela de Configurações, que
// fica salva em localStorage.

const KEY_GOALS = 'nutrifoto.goals';
const KEY_API = 'nutrifoto.apiKey';

const DEFAULT_GOALS = {
  calories: 2200,
  protein: 150,
  carb: 250,
  fat: 70,
  waterGoal: 2000,
};

function readApiKey() {
  try {
    const stored = localStorage.getItem(KEY_API);
    if (stored && stored.trim().length > 0) return stored.trim();
  } catch {}
  if (typeof window !== 'undefined' && typeof window.OPENROUTER_API_KEY === 'string') {
    const fromConfig = window.OPENROUTER_API_KEY.trim();
    if (fromConfig) return fromConfig;
  }
  return '';
}

export function getApiKey() {
  return readApiKey();
}

export function setApiKey(key) {
  try {
    if (key && key.trim().length > 0) {
      localStorage.setItem(KEY_API, key.trim());
    } else {
      localStorage.removeItem(KEY_API);
    }
    return true;
  } catch {
    return false;
  }
}

export function isConfigured() {
  return Boolean(readApiKey());
}

export function getApiKeySource() {
  // Retorna 'localStorage' se a chave veio do localStorage, 'config' se veio
  // do config.local.js, ou 'none' se não há chave configurada.
  try {
    const stored = localStorage.getItem(KEY_API);
    if (stored && stored.trim().length > 0) return 'localStorage';
  } catch {}
  if (typeof window !== 'undefined' && typeof window.OPENROUTER_API_KEY === 'string') {
    const fromConfig = window.OPENROUTER_API_KEY.trim();
    if (fromConfig) return 'config';
  }
  return 'none';
}

export function getGoals() {
  try {
    const raw = localStorage.getItem(KEY_GOALS);
    if (!raw) return { ...DEFAULT_GOALS };
    return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GOALS };
  }
}

export function setGoals(goals) {
  localStorage.setItem(KEY_GOALS, JSON.stringify(goals));
}
