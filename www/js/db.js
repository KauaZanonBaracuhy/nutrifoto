// db.js — IndexedDB wrapper for meal history
const DB_NAME = 'nutrifoto';
const DB_VERSION = 1;
const STORE_MEALS = 'meals';

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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(mode) {
  return openDB().then(db => db.transaction(STORE_MEALS, mode).objectStore(STORE_MEALS));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function salvarRefeicao(meal) {
  const store = await tx('readwrite');
  const record = {
    ...meal,
    createdAt: meal.createdAt || new Date().toISOString(),
  };
  const id = await reqToPromise(store.add(record));
  return { ...record, id };
}

export async function listarRefeicoesDoDia(dateISO) {
  const day = (dateISO || new Date().toISOString()).slice(0, 10);
  const store = await tx('readonly');
  const all = await reqToPromise(store.getAll());
  return all
    .filter(m => m.createdAt.slice(0, 10) === day)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listarHistorico() {
  const store = await tx('readonly');
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

export async function deletarRefeicao(id) {
  const store = await tx('readwrite');
  await reqToPromise(store.delete(id));
}

export async function listarTotaisPorDia(dias = 7) {
  const store = await tx('readonly');
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
