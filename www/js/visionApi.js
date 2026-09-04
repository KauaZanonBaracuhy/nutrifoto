// visionApi.js — chamada fixa à OpenRouter (visão nutricional)
import { getApiKey } from './storage.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';
const APP_REFERER = 'http://localhost';
const APP_TITLE = 'NutriFoto';

const ANALYSIS_PROMPT = `Analise esta foto de uma refeição.

Para cada alimento visível, estime:
- nome (em português, simples)
- porcao_estimada_g (peso estimado em gramas)
- calorias (kcal)
- proteina_g, carboidrato_g, gordura_g

Use valores por 100g como base e ajuste pela porção estimada.
Arredonde para inteiros.
Se não for comida, retorne "alimentos": [].

Responda EXCLUSIVAMENTE com JSON válido neste formato, sem markdown, sem texto antes ou depois:

{
  "alimentos": [
    {
      "nome": "string",
      "porcao_estimada_g": number,
      "calorias": number,
      "proteina_g": number,
      "carboidrato_g": number,
      "gordura_g": number
    }
  ],
  "total": {
    "calorias": number,
    "proteina_g": number,
    "carboidrato_g": number,
    "gordura_g": number
  }
}`;

function extractJson(text) {
  const trimmed = (text || '').trim();
  try { return JSON.parse(trimmed); } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

function recalculateTotal(alimentos) {
  return alimentos.reduce((acc, a) => {
    const p = Number(a.porcao_estimada_g) || 0;
    if (a.porcao_original_g && a.porcao_original_g > 0) {
      const ratio = p / a.porcao_original_g;
      acc.calorias += Math.round((Number(a.calorias) || 0) * ratio);
      acc.proteina_g += Math.round((Number(a.proteina_g) || 0) * ratio);
      acc.carboidrato_g += Math.round((Number(a.carboidrato_g) || 0) * ratio);
      acc.gordura_g += Math.round((Number(a.gordura_g) || 0) * ratio);
    } else {
      acc.calorias += Math.round(Number(a.calorias) || 0);
      acc.proteina_g += Math.round(Number(a.proteina_g) || 0);
      acc.carboidrato_g += Math.round(Number(a.carboidrato_g) || 0);
      acc.gordura_g += Math.round(Number(a.gordura_g) || 0);
    }
    return acc;
  }, { calorias: 0, proteina_g: 0, carboidrato_g: 0, gordura_g: 0 });
}

export function recalcularTotal(alimentos) {
  return recalculateTotal(alimentos);
}

export async function analyzeImage({ base64, mediaType }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Chave da API não configurada.');
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': APP_REFERER,
    'X-Title': APP_TITLE,
  };

  const body = {
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: ANALYSIS_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
        ],
      },
    ],
  };

  let res;
  try {
    res = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Sem internet ou API inacessível.');
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('Chave da API inválida (401).');
    if (res.status === 402) throw new Error('Sem créditos na OpenRouter (402). Adicione créditos em openrouter.ai/credits.');
    if (res.status === 429) throw new Error('Limite de requisições excedido. Tente em alguns segundos.');
    if (res.status === 400) throw new Error(`Requisição inválida (400): ${errText.slice(0, 300)}`);
    throw new Error(`Erro ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`OpenRouter: ${data.error.message || 'erro desconhecido'}`);
  }

  const rawText = data?.choices?.[0]?.message?.content;
  if (rawText === undefined || rawText === null) {
    throw new Error('Resposta vazia da OpenRouter.');
  }

  const parsed = extractJson(typeof rawText === 'string' ? rawText : JSON.stringify(rawText));
  if (!parsed) {
    throw new Error('Resposta não contém JSON válido. Tente com outra foto.');
  }
  if (!Array.isArray(parsed.alimentos)) {
    throw new Error('Formato de resposta inesperado — "alimentos" não é um array.');
  }

  const alimentos = parsed.alimentos.map(a => ({
    nome: String(a.nome || '').trim() || 'Alimento',
    porcao_estimada_g: Math.round(Number(a.porcao_estimada_g) || 0),
    porcao_original_g: Math.round(Number(a.porcao_estimada_g) || 0),
    calorias: Math.round(Number(a.calorias) || 0),
    proteina_g: Math.round(Number(a.proteina_g) || 0),
    carboidrato_g: Math.round(Number(a.carboidrato_g) || 0),
    gordura_g: Math.round(Number(a.gordura_g) || 0),
  }));

  const total = parsed.total && typeof parsed.total === 'object'
    ? {
        calorias: Math.round(Number(parsed.total.calorias) || 0),
        proteina_g: Math.round(Number(parsed.total.proteina_g) || 0),
        carboidrato_g: Math.round(Number(parsed.total.carboidrato_g) || 0),
        gordura_g: Math.round(Number(parsed.total.gordura_g) || 0),
      }
    : recalculateTotal(alimentos);

  return { alimentos, total };
}

export async function testConnection() {
  const apiKey = getApiKey();
  if (!apiKey) return { ok: false, error: 'Chave da API não configurada.' };

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': APP_REFERER,
    'X-Title': APP_TITLE,
  };

  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: 'Responda apenas: {"ok":true}' }],
  };

  try {
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true, message: 'Conexão OK!' };
    const errText = await res.text().catch(() => '');
    return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 300)}` };
  } catch (e) {
    return { ok: false, error: `Falha na conexão: ${e.message}` };
  }
}