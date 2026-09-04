// storage.js — localStorage para metas diárias + leitura da chave OpenRouter

// Carregamos a chave via um script tag síncrono (não ESM) injetado pelo index.html.
// Isso evita o erro MIME type do import() dinâmico.
// Veja: <script src="js/config.local.js"></script> no index.html (síncrono, sem type=module)
// e <script src="js/config.example.js"></script> como fallback.

// Como config.local.js define window.OPENROUTER_API_KEY_GLOBAL e config.example.js
// define window.OPENROUTER_API_KEY_PLACEHOLDER, o storage.js pega o que existir.

const KEY_GOALS = 'nutrifoto.goals';

const DEFAULT_GOALS = {
  calories: 2200,
  protein: 150,
  carb: 250,
  fat: 70,
};

function loadApiKey() {
  if (typeof window === 'undefined') return '';
  // config.local.js define window.OPENROUTER_API_KEY (chave real)
  if (typeof window.OPENROUTER_API_KEY === 'string') return window.OPENROUTER_API_KEY;
  // config.example.js define window.OPENROUTER_API_KEY como placeholder
  // (já coberto acima)
  return '';
}

const OPENROUTER_API_KEY = loadApiKey();

export function getApiKey() {
  return OPENROUTER_API_KEY;
}

export function isConfigured() {
  return Boolean(OPENROUTER_API_KEY) && !OPENROUTER_API_KEY.includes('SUA_CHAVE');
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
