// storage.js — localStorage para metas diárias + leitura da chave OpenRouter

// Em produção, config.local.js (chave real) não é commitado. Como fallback,
// usamos config.example.js que sempre está presente. Se nem ele estiver,
// a app continua funcionando (sem chave de IA).
let OPENROUTER_API_KEY = '';
try {
  const mod = await import('./config.local.js');
  OPENROUTER_API_KEY = mod.OPENROUTER_API_KEY || '';
} catch {
  // config.local.js ausente (não commitado) — tenta o placeholder.
  try {
    const ex = await import('./config.example.js');
    OPENROUTER_API_KEY = ex.OPENROUTER_API_KEY || '';
  } catch {
    // Nada disponível, app segue sem chave de IA.
  }
}

const KEY_GOALS = 'nutrifoto.goals';

const DEFAULT_GOALS = {
  calories: 2200,
  protein: 150,
  carb: 250,
  fat: 70,
};

// ---------- API key ----------

export function getApiKey() {
  return OPENROUTER_API_KEY;
}

export function isConfigured() {
  return Boolean(OPENROUTER_API_KEY) && !OPENROUTER_API_KEY.includes('SUA_CHAVE');
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
