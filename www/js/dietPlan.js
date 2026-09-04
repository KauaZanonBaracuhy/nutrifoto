// dietPlan.js — novo módulo: formulário de perfil + geração de plano alimentar via OpenRouter (texto)
import { getApiKey } from './storage.js';

const KEY_PROFILE = 'nutrifoto.userProfile';
const KEY_PLAN = 'nutrifoto.currentPlan';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';
const APP_REFERER = 'http://localhost';
const APP_TITLE = 'NutriFoto';

// ---------- Perfil ----------

export function getUserProfile() {
  try {
    const raw = localStorage.getItem(KEY_PROFILE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveUserProfile(profile) {
  localStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
}

export function getCurrentPlan() {
  try {
    const raw = localStorage.getItem(KEY_PLAN);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCurrentPlan(plan) {
  localStorage.setItem(KEY_PLAN, JSON.stringify(plan));
}

export function clearCurrentPlan() {
  localStorage.removeItem(KEY_PLAN);
}

// ---------- Prompt ----------

function buildPrompt(profile) {
  const alimentosNaoGosta = profile.restricoesTexto || 'nenhum';
  const favoritos = profile.alimentosFavoritos || 'nenhum';

  return `Você é um nutricionista especialista. Com base nos dados do usuário abaixo, gere um plano alimentar diário personalizado.

DADOS DO USUÁRIO:
- Idade: ${profile.idade} anos
- Sexo: ${profile.sexo === 'masculino' ? 'Masculino' : 'Feminino'}
- Peso atual: ${profile.pesoAtual} kg
- Altura: ${profile.altura} cm
- Nível de atividade: ${profile.nivelAtividade}
- Objetivo: ${profile.objetivo}
- Peso desejado: ${profile.pesoDesejado || 'não informado'} kg
- Prazo: ${profile.prazo || 'não informado'}
- Restrições: ${profile.restricoes.join(', ') || 'nenhuma'}
- Alergias: ${alimentosNaoGosta}
- Alimentos que não gosta: ${alimentosNaoGosta}
- Alimentos favoritos: ${favoritos}
- Refeições por dia: ${profile.refeicoesPorDia}
- Acorda: ${profile.horarioAcorda}
- Dorme: ${profile.horarioDorme}
- Observações de rotina: ${profile.rotinaTexto || 'nenhuma'}
- Condições de saúde: ${profile.condicoesSaude || 'nenhuma'}

INSTRUÇÕES:
1. Calcule a TMB (taxa metabólica basal) usando a fórmula de Mifflin-St Jeor.
2. Multiplique pela taxa de atividade: sedentario=1.2, leve=1.375, moderado=1.55, intenso=1.725, atleta=1.9.
3. Ajuste as calorias para o objetivo (perder: -500 kcal, manter: = TDEE, ganhar: +500 kcal, melhorar saúde: +100 kcal).
4. Distribua os macros: proteína 1.6-2.2g/kg (ou mais se ganhando massa), carboidrato 45-55% do total, gordura 20-30%.
5. Distribua as refeições pelos horários informados, com sugestões de pratos reais e saborosos, respeitando restrições, alergias e preferências.
6. Estime kcal por refeição.

RESPONDA APENAS com JSON válido neste formato exato (sem markdown, sem texto extra):

{
  "tdee": 2340,
  "metaCalorica": 1840,
  "macros": {
    "proteina": 140,
    "carboidrato": 200,
    "gordura": 60
  },
  "refeicoes": [
    {
      "nome": "Café da manhã",
      "horario": "07:30",
      "sugestao": "Omelete de 3 claras + 1 ovo com espinafre e aveia",
      "kcalEstimada": 420
    }
  ]
}`;
}

function extractJson(text) {
  const trimmed = (text || '').trim();
  try { return JSON.parse(trimmed); } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

// ---------- API chamada de texto ----------

export async function gerarPlanoAlimentar(profile) {
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
        content: buildPrompt(profile),
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
    throw new Error('Resposta não contém JSON válido. Tente gerar novamente.');
  }
  if (!parsed.tdee || !parsed.metaCalorica || !parsed.macros || !Array.isArray(parsed.refeicoes)) {
    throw new Error('Formato de resposta inesperado — campos obrigatórios ausentes.');
  }

  return parsed;
}
