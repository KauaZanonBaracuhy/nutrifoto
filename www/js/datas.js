// Datas de calendário são locais; instantes persistidos continuam em UTC.
export function localDate(valor = new Date()) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return validarDia(valor);
  const data = valor instanceof Date ? valor : new Date(valor);
  if (!Number.isFinite(data.getTime())) throw new Error('Data inválida.');
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}
export function validarDia(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('Dia inválido.');
  const data = new Date(`${valor}T12:00:00`);
  if (!Number.isFinite(data.getTime()) || localDate(data) !== valor) throw new Error('Dia inválido.');
  return valor;
}
export function deslocarDia(dia, quantidade) {
  const data = new Date(`${validarDia(dia)}T12:00:00`);
  data.setDate(data.getDate() + quantidade);
  return localDate(data);
}
export function calcularStreak(dias, hoje = localDate()) {
  const conjunto = new Set(dias);
  let dia = conjunto.has(hoje) ? hoje : deslocarDia(hoje, -1);
  let total = 0;
  while (conjunto.has(dia)) { total++; dia = deslocarDia(dia, -1); }
  return total;
}
