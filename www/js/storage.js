// storage.js — localStorage para metas diárias + leitura da chave OpenRouter

// Import opcional: se config.local.js não existir (não commitado no GitHub),
// o site continua funcionando, apenas sem chave de IA pré-configurada.
let OPENROUTER_API_KEY = '';
try {
  const mod = await import('./config.local.js');
  OPENROUTER_API_KEY = mod.OPENROUTER_API_KEY || '';
} catch {
  // config.local.js ausente — usuário precisará configurar manualmente depois.
  OPENROUTER_API_KEY = '';
}

const KEY_GOALS = 'nutrifoto.goals';

const DEFAULT_GOALS = {
  calories: 2200,
  protein: 150,
  carb: 250,
  fat: 70,
};

// ---------- API key (vem de config.local.js, se existir) ----------

export function getApiKey() {
  return OPENROUTER_API_KEY;
}

export function isConfigured() {
  return Boolean(OPENROUTER_API_KEY);
}

// ---------- Goals ----------

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
