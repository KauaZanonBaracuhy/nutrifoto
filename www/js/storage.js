// storage.js — localStorage para metas diárias + leitura da chave OpenRouter

import { OPENROUTER_API_KEY } from './config.local.js';

const KEY_GOALS = 'nutrifoto.goals';

const DEFAULT_GOALS = {
  calories: 2200,
  protein: 150,
  carb: 250,
  fat: 70,
};

// ---------- API key (fixa, vem de config.local.js) ----------

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