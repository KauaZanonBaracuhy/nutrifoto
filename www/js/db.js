// db.js — IndexedDB wrapper for meal history + weight history + water tracking
const DB_NAME = 'nutrifoto';
const DB_VERSION = 3;
const STORE_MEALS = 'meals';
const STORE_WEIGHTS = 'weights';
const STORE_WATER = 'water';

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_MEALS)) {
        const store = db.createObjectStore(STORE_MEALS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_WEIGHTS)) {
        const store = db.createObjectStore(STORE_WEIGHTS, { keyPath: 'date' });
        store.createIndex('date', 'date', { unique: true });
      }
      if (!db.objectStoreNames.contains(STORE_WATER)) {
        const store = db.createObjectStore(STORE_WATER, { keyPath: 'date' });
        store.createIndex('date', 'date', { unique: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(store, mode) {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function salvarRefeicao(meal) {
  const store = await tx(STORE_MEALS, 'readwrite');
  const record = {
    ...meal,
    createdAt: meal.createdAt || new Date().toISOString(),
  };
  const id = await reqToPromise(store.add(record));
  return { ...record, id };
}

export async function listarRefeicoesDoDia(dateISO) {
  const day = (dateISO || new Date().toISOString()).slice(0, 10);
  const store = await tx(STORE_MEALS, 'readonly');
  const all = await reqToPromise(store.getAll());
  return all
    .filter(m => m.createdAt.slice(0, 10) === day)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listarHistorico() {
  const store = await tx(STORE_MEALS, 'readonly');
  const all = await reqToPromise(store.getAll());
  const byDay = {};
  for (const m of all) {
    const day = m.createdAt.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(m);
  }
  return Object.keys(byDay)
    .sort((a, b) => b.localeCompare(a))
    .map(day => ({ day, meals: byDay[day].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }));
}

export async function atualizarRefeicao(id, meal) {
  const store = await tx(STORE_MEALS, 'readwrite');
  return reqToPromise(store.put({ ...meal, id }));
}

export async function deletarRefeicao(id) {
  const store = await tx(STORE_MEALS, 'readwrite');
  await reqToPromise(store.delete(id));
}

export async function listarTotaisPorDia(dias = 7) {
  const store = await tx(STORE_MEALS, 'readonly');
  const all = await reqToPromise(store.getAll());
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dias);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const byDay = {};
  for (const m of all) {
    const day = m.createdAt.slice(0, 10);
    if (day < cutoffStr) continue;
    if (!byDay[day]) {
      byDay[day] = { day, calorias: 0, proteina_g: 0, carboidrato_g: 0, gordura_g: 0 };
    }
    byDay[day].calorias += m.total?.calorias || 0;
    byDay[day].proteina_g += m.total?.proteina_g || 0;
    byDay[day].carboidrato_g += m.total?.carboidrato_g || 0;
    byDay[day].gordura_g += m.total?.gordura_g || 0;
  }

  // Fill missing days with zeros
  const result = [];
  const d = new Date();
  d.setDate(d.getDate() - dias + 1);
  for (let i = 0; i < dias; i++) {
    const dayStr = d.toISOString().slice(0, 10);
    result.push(byDay[dayStr] || { day: dayStr, calorias: 0, proteina_g: 0, carboidrato_g: 0, gordura_g: 0 });
    d.setDate(d.getDate() + 1);
  }
  return result;
}

// ============ WEIGHT HISTORY ============

export async function salvarPeso(peso_kg, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const store = await tx(STORE_WEIGHTS, 'readwrite');
  const record = { date, peso_kg, createdAt: new Date().toISOString() };
  await reqToPromise(store.put(record));
  return record;
}

export async function listarPesos(dias) {
  const store = await tx(STORE_WEIGHTS, 'readonly');
  const all = await reqToPromise(store.getAll());
  const sorted = all.sort((a, b) => a.date.localeCompare(b.date));
  if (!dias) return sorted;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dias);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return sorted.filter(r => r.date >= cutoffStr);
}

export async function obterPesoMaisRecente() {
  const all = await listarPesos(0);
  return all.length > 0 ? all[all.length - 1] : null;
}

export async function obterPesoAnterior() {
  const all = await listarPesos(0);
  return all.length > 1 ? all[all.length - 2] : null;
}

// ============ WATER TRACKING ============

export async function obterAguaHoje() {
  const today = new Date().toISOString().slice(0, 10);
  const store = await tx(STORE_WATER, 'readonly');
  const record = await reqToPromise(store.get(today));
  return record || { date: today, ml_consumidos: 0, ml_por_copo: 250, meta_ml: 2000 };
}

export async function adicionarCopo(mlPorCopo = 250) {
  const today = new Date().toISOString().slice(0, 10);
  const store = await tx(STORE_WATER, 'readwrite');
  const existing = await reqToPromise(store.get(today));
  const record = {
    date: today,
    ml_consumidos: (existing?.ml_consumidos || 0) + mlPorCopo,
    ml_por_copo: mlPorCopo,
    meta_ml: existing?.meta_ml || 2000,
  };
  await reqToPromise(store.put(record));
  return record;
}

export async function removerCopo(mlPorCopo = 250) {
  const today = new Date().toISOString().slice(0, 10);
  const store = await tx(STORE_WATER, 'readwrite');
  const existing = await reqToPromise(store.get(today));
  const record = {
    date: today,
    ml_consumidos: Math.max(0, (existing?.ml_consumidos || 0) - mlPorCopo),
    ml_por_copo: mlPorCopo,
    meta_ml: existing?.meta_ml || 2000,
  };
  await reqToPromise(store.put(record));
  return record;
}

export async function atualizarMetaAgua(metaMl) {
  const today = new Date().toISOString().slice(0, 10);
  const store = await tx(STORE_WATER, 'readwrite');
  const existing = await reqToPromise(store.get(today));
  const record = {
    date: today,
    ml_consumidos: existing?.ml_consumidos || 0,
    ml_por_copo: existing?.ml_por_copo || 250,
    meta_ml: metaMl,
  };
  await reqToPromise(store.put(record));
  return record;
}
