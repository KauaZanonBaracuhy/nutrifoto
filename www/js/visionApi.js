// visionApi.js — chamada fixa à OpenRouter (visão nutricional)
import { getApiKey } from './storage.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';
const APP_REFERER = 'https://nutrifoto-rose.vercel.app';
const APP_TITLE = 'NutriFoto';

const ANALYSIS_PROMPT = `Analise esta foto de uma refeição.

PREMISSA: Tudo que está visível na foto é o que a pessoa vai comer.
Calcule os macros considerando a QUANTIDADE TOTAL de cada alimento
visível — NÃÃO estime uma "porção recomendada" ou "porção saudável".

ETAPA 1 — LEIA TEXTOS VISÍVEIS:
Escute atentamente qualquer texto visível na foto: embalagens, caixas,
rótulos, copos, sacolas, placas, cups, cartãos, etc. Isso inclui marcas,
nomes de produtos, logos e frases (ex: "Big Mac", "McChicken", "Whopper",
"Caixa Pizza Pizza Hut", rótulos de produtos industrializados, etc.).

ETAPA 2 — IDENTIFIQUE PRODUTO DE MARCA:
SE um alimento for claramente um produto de marca/rede conhecida pelo
texto ou embalagem visível (ex: hambúrguer da caixa do McDonald's,
McChicken, Big Mac, pizza de rede específica, refrigerante em lata de
marca, etc.): Use o conhecimento nutricional público divulgado pela
própria marca ou amplamente conhecido sobre AQUELE PRODUTO ESPECÍFICO
como base para calorias e macros. Ainda assim, ajuste proporcionalmente
pela quantidade real visível na foto (ex: se só metade do hambúrguer
está na foto, divida os valores pela metade).

ETAPA 3 — ESTIMATIVA VISUAL (fallback):
SE NÃO for possível identificar um produto de marca específica (comida
caseira, sem embalagem visível, sem texto legível, etc.): estime os
macros pela aparência visual usando referências de prato/talheres/mãos
e valores nutricionais por 100g.

Para cada alimento visível na imagem:
- nome (em português, simples)
- porcao_estimada_g (peso total estimado em gramas de TODO o alimento visível)
- calorias (kcal)
- proteina_g, carboidrato_g, gordura_g
- marca_identificada: nome da marca/rede e produto identificado (ex:
  "McDonald's - Big Mac") OU null se for comida caseira ou sem marca
  identificável

Como estimar o peso:
- Use referências visuais comuns: prato fundo (22–26cm diâmetro),
  talheres, mãos, copos, embalagens conhecidas, etc.
- Considere todo o alimento que aparece na foto.
- Baseie-se em valores nutricionais por 100g e ajuste pelo peso total.
- Seja generoso para não subestimar.

Arredonde para inteiros.
Se não for comida, retorne "alimentos": [].

Responda EXCLUSIVAMENTE com JSON válido neste formato, sem markdown:

{
  "alimentos": [
    {
      "nome": "string",
      "porcao_estimada_g": number,
      "calorias": number,
      "proteina_g": number,
      "carboidrato_g": number,
      "gordura_g": number,
      "marca_identificada": "string ou null"
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
    throw new Error('Chave da API não configurada. Abra Configurações → Chave da API OpenRouter e cole sua chave.');
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      res = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('Tempo esgotado (25s). Verifique sua conexão.');
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
    marca_identificada: a.marca_identificada ? String(a.marca_identificada).trim() : null,
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
  if (!apiKey) return { ok: false, error: 'Chave da API não configurada. Vá em Configurações → Chave da API OpenRouter.' };

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.ok) return { ok: true, message: 'Conexão OK!' };
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 300)}` };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, error: 'Tempo esgotado (15s). Verifique sua conexão.' };
    return { ok: false, error: `Falha na conexão: ${e.message}` };
  }
}