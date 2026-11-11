// Reglas de las tareas del día y de su vínculo con la semana. Sin DOM: se puede probar aislado.
import { S, save, setPath } from './state.js';
import { setDayVisibility } from './prefs.js';
import { weekdayOf, shiftDate } from './util.js';

/** Claves de las tres prioridades, en orden. Las secundarias usan 1…MAX_OTHER. */
export const PRIORITY_KEYS = [0, 501, 502];
export const MAX_PRIORITIES = 3;
export const MAX_OTHER = 500;

export const isPriority = key => PRIORITY_KEYS.includes(+key);
const hasText = row => !!String(row?.t ?? '').trim();
/** Una fila está ocupada si tiene texto, marca, sesiones o vínculo semanal. */
const occupied = row => !!(row && (hasText(row) || row.c || row.s || row.source));

const rowsOf = date => S.d[date]?.k || {};
function dayFor(date) {
  const day = S.d[date] = S.d[date] || {};
  day.k = day.k || {};
  return day;
}
function setRow(rows, key, row) {
  if (row) rows[key] = row;
  else delete rows[key];
}

/** Prioridades visibles (1 a 3): nunca oculta una prioridad ocupada. */
export function priorityCount(date) {
  const day = S.d[date] || {}, rows = day.k || {};
  let last = -1;
  PRIORITY_KEYS.forEach((k, i) => { if (occupied(rows[k])) last = i; });
  const stored = Number.isInteger(day.priorityCount) ? day.priorityCount : 1;
  return Math.min(MAX_PRIORITIES, Math.max(1, stored, last + 1));
}

/** Filas secundarias visibles: dos por defecto; puede ser 0 si la persona las borra. */
export function otherCount(date) {
  const day = S.d[date] || {}, rows = day.k || {};
  let last = 0;
  for (const [k, row] of Object.entries(rows)) {
    const n = +k;
    if (n >= 1 && n <= MAX_OTHER && occupied(row) && n > last) last = n;
  }
  const stored = Number.isInteger(day.otherCount) ? day.otherCount : 2;
  return Math.min(MAX_OTHER, Math.max(stored, last));
}

export function addPriority(date) {
  const count = priorityCount(date);
  if (count >= MAX_PRIORITIES) return null;
  dayFor(date).priorityCount = count + 1;
  save();
  return PRIORITY_KEYS[count];
}

/** Quita la prioridad en la posición indicada y sube las siguientes. Con una sola, la vacía. */
export function removePriority(date, pos) {
  const count = priorityCount(date), day = dayFor(date), rows = day.k;
  if (pos < 0 || pos >= count) return;
  for (let j = pos; j < count - 1; j++) setRow(rows, PRIORITY_KEYS[j], rows[PRIORITY_KEYS[j + 1]]);
  delete rows[PRIORITY_KEYS[count - 1]];
  day.priorityCount = Math.max(1, count - 1);
  save();
}

export function addOther(date) {
  const n = otherCount(date) + 1;
  if (n > MAX_OTHER) return null;
  dayFor(date).otherCount = n;
  save();
  return n;
}

export function removeOther(date, key) {
  const count = otherCount(date), day = dayFor(date), rows = day.k;
  if (key < 1 || key > count) return;
  for (let j = key; j < count; j++) setRow(rows, j, rows[j + 1]);
  delete rows[count];
  day.otherCount = count - 1;
  save();
}

export function moveOther(date, from, to) {
  const count = otherCount(date), rows = dayFor(date).k;
  if (from === to || from < 1 || to < 1 || from > count || to > count) return false;
  const moving = rows[from];
  if (from < to) for (let j = from; j < to; j++) setRow(rows, j, rows[j + 1]);
  else for (let j = from; j > to; j--) setRow(rows, j, rows[j - 1]);
  setRow(rows, to, moving);
  save();
  return true;
}

/** Elimina una tarea cualquiera del día (prioritaria o secundaria). */
export function removeTask(date, key) {
  if (isPriority(key)) removePriority(date, PRIORITY_KEYS.indexOf(+key));
  else removeOther(date, +key);
}

/**
 * Ubica una tarea en un día: prioridades en el primer espacio libre de los tres;
 * secundarias en la primera fila vacía o al final. Devuelve la clave o null si no hay espacio.
 */
export function placeTask(date, kind, row) {
  if (kind === 'priority') {
    const rows = rowsOf(date), pos = PRIORITY_KEYS.findIndex(k => !occupied(rows[k]));
    if (pos < 0) return null;
    const count = priorityCount(date), day = dayFor(date);
    day.k[PRIORITY_KEYS[pos]] = row;
    day.priorityCount = Math.max(count, pos + 1);
    setDayVisibility('d_star', weekdayOf(date), true);
    save();
    return PRIORITY_KEYS[pos];
  }
  const count = otherCount(date), rows = rowsOf(date);
  let n = 1;
  while (n <= count && occupied(rows[n])) n++;
  if (n > MAX_OTHER) return null;
  const day = dayFor(date);
  day.k[n] = row;
  day.otherCount = Math.max(count, n);
  setDayVisibility('d_oth', weekdayOf(date), true);
  save();
  return n;
}

/** Copia de seguridad mínima para poder deshacer cambios en uno o más días. */
export function snapshot(dates) {
  return {
    days: Object.fromEntries(dates.map(d => [d, S.d[d] ? structuredClone(S.d[d]) : null])),
    visibility: structuredClone(S.cfg.days || {}),
  };
}
export function restore(snap) {
  for (const [date, day] of Object.entries(snap.days)) {
    if (day) S.d[date] = day;
    else delete S.d[date];
  }
  S.cfg.days = snap.visibility;
  save();
}

/** Pasa una tarea al día siguiente. Devuelve { undo } o { error }. */
export function carryToTomorrow(date, key) {
  const origin = rowsOf(date)[key];
  if (!hasText(origin)) return { error: 'Escribe una tarea antes de pasarla.' };
  const target = shiftDate(date, 1), priority = isPriority(key);
  const undo = snapshot([date, target]);
  const copy = { ...origin, c: false };
  delete copy.carriedFrom;
  if (placeTask(target, priority ? 'priority' : 'other', copy) === null) {
    restore(undo);
    return { error: priority ? 'Mañana ya tiene tres tareas importantes. Libera una antes de pasar esta.' : 'Mañana no tiene más espacio para tareas.' };
  }
  removeTask(date, key);
  return { undo, target };
}

/** Lleva una tarea semanal (ruta w.LUNES.a|b.i) a un día. Devuelve { key } o { error }. */
export function planWeeklyTask(path, date, kind) {
  if (Object.values(rowsOf(date)).some(r => r?.source === path)) return { error: 'Esta tarea ya está en ese día.' };
  const weekly = path.split('.').reduce((o, k) => o?.[k], S) || {};
  const key = placeTask(date, kind, { t: weekly.t || '', c: !!weekly.c, s: 0, source: path });
  if (key === null) return { error: 'Ese día ya tiene tres tareas importantes.' };
  return { key };
}

/** Al cambiar el nombre de una tarea vinculada, el vínculo con la semana se rompe. */
export function detachEditedTask(path, oldText, newText) {
  if (oldText === newText) return false;
  const daily = path.match(/^d\.([^.]+)\.k\.(\d+)\.t$/);
  if (daily) {
    const row = S.d[daily[1]]?.k?.[daily[2]];
    if (!row?.source) return false;
    delete row.source;
    save();
    return true;
  }
  const weekly = path.match(/^(w\.[^.]+\.[ab]\.\d+)\.t$/);
  if (!weekly) return false;
  let changed = false;
  for (const day of Object.values(S.d)) for (const row of Object.values(day.k || {})) {
    if (row?.source === weekly[1]) { delete row.source; changed = true; }
  }
  if (changed) save();
  return changed;
}

/** Marca como hecha una tarea y todas sus copias vinculadas (semana y días). */
export function syncTask(path, value) {
  const daily = path.match(/^d\.([^.]+)\.k\.(\d+)\.c$/);
  const source = daily ? S.d[daily[1]]?.k?.[daily[2]]?.source : path.slice(0, -2);
  if (!source || !/^w\./.test(source)) return;
  setPath(source + '.c', value);
  for (const day of Object.values(S.d)) for (const row of Object.values(day.k || {})) {
    if (row?.source === source) row.c = value;
  }
  save();
}
