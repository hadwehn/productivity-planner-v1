// Reglas de tareas (día y semana). Sin DOM: se puede probar aislado.
//
// Formato guardado (compatible con la versión anterior):
//   d[fecha].k: claves 0, 501, 502 = tareas en foco (máx. 3); 1…500 = el resto, en orden.
//   w[lunes].a / .b: índices 0…4 = foco de la semana / otras tareas de la semana.
//   Una tarea del día traída de la semana guarda source = 'w.LUNES.a|b.i'.
import { S, save } from './state.js';
import { addDays, iso, parseDate, shiftDate, weekday } from './util.js';
import { tr } from './i18n.js';

export const FOCUS_KEYS = [0, 501, 502];
export const MAX_FOCUS = 3;
export const MAX_OTHER = 500;
export const WEEK_SLOTS = 5;

export const isFocusKey = key => FOCUS_KEYS.includes(+key);
const text = row => String(row?.t ?? '').trim();

// ——— Día ———

/** Tareas visibles de un día, en orden: { focus: [{key,row}], rest: [{key,row}] }. */
export function dayTasks(date) {
  const rows = S.d[date]?.k || {};
  const focus = FOCUS_KEYS.filter(k => text(rows[k])).map(key => ({ key, row: rows[key] }));
  const rest = Object.keys(rows).map(Number).filter(k => k >= 1 && k <= MAX_OTHER && text(rows[k]))
    .sort((a, b) => a - b).map(key => ({ key, row: rows[key] }));
  return { focus, rest };
}

/** Reescribe el día sin huecos ni filas vacías, conservando el orden. */
function writeDay(date, focusRows, restRows) {
  const day = S.d[date] = S.d[date] || {};
  const k = {};
  focusRows.slice(0, MAX_FOCUS).forEach((row, i) => { k[FOCUS_KEYS[i]] = row; });
  restRows.slice(0, MAX_OTHER).forEach((row, i) => { k[i + 1] = row; });
  day.k = k;
  // Cantidades que la versión anterior usa para mostrar filas.
  day.priorityCount = Math.max(1, Math.min(MAX_FOCUS, focusRows.length));
  day.otherCount = Math.min(MAX_OTHER, restRows.length);
}
const rowsOf = date => { const { focus, rest } = dayTasks(date); return { focus: focus.map(x => x.row), rest: rest.map(x => x.row) }; };
/** Clave en la que quedó una fila después de reescribir el día. */
function keyOf(date, row) {
  const rows = S.d[date]?.k || {};
  return Number(Object.keys(rows).find(k => rows[k] === row));
}

export function compactDay(date) {
  if (!S.d[date]?.k) return;
  const { focus, rest } = rowsOf(date);
  writeDay(date, focus, rest);
}

/** Añade una tarea. En foco solo si hay espacio; si no, al resto. Devuelve la clave. */
export function addTask(date, value, { focus = false, source } = {}) {
  const t = String(value || '').trim();
  if (!t) return null;
  const { focus: f, rest } = rowsOf(date);
  const row = { t, c: false };
  if (source) row.source = source;
  if (focus && f.length < MAX_FOCUS) f.push(row); else rest.push(row);
  writeDay(date, f, rest);
  save();
  return keyOf(date, row);
}

export function getTask(date, key) { return S.d[date]?.k?.[key]; }

/** Cambia el texto. Si estaba vinculada a la semana y cambia el nombre, el vínculo se rompe. */
export function renameTask(date, key, value) {
  const row = getTask(date, key);
  if (!row) return;
  const t = String(value ?? '');
  if (row.source && t.trim() !== text(row)) delete row.source;
  row.t = t;
  save();
}

/** Pone o quita una tarea del foco. Devuelve { key } o { error }. */
export function toggleFocus(date, key) {
  const row = getTask(date, key);
  if (!row) return { error: tr('La tarea ya no existe.', 'This task no longer exists.') };
  const { focus, rest } = rowsOf(date);
  if (isFocusKey(key)) {
    focus.splice(focus.indexOf(row), 1);
    rest.unshift(row);
  } else {
    if (focus.length >= MAX_FOCUS) return { error: tr('Ya tienes tres tareas en foco. Quita una para elegir otra.', 'You already have three tasks in focus. Remove one to pick another.') };
    rest.splice(rest.indexOf(row), 1);
    focus.push(row);
  }
  writeDay(date, focus, rest);
  save();
  return { key: keyOf(date, row) };
}

export function setDone(date, key, value) {
  const row = getTask(date, key);
  if (!row) return;
  row.c = !!value;
  if (row.c) delete row.drop;
  syncLinked(row.source, row.c);
  save();
}

export function removeTask(date, key) {
  const row = getTask(date, key);
  if (!row) return;
  const { focus, rest } = rowsOf(date);
  writeDay(date, focus.filter(r => r !== row), rest.filter(r => r !== row));
  save();
}

/** Reordena dentro del mismo grupo (foco o resto). */
export function reorderTask(date, fromKey, toKey) {
  const from = getTask(date, fromKey), to = getTask(date, toKey);
  if (!from || !to || from === to || isFocusKey(fromKey) !== isFocusKey(toKey)) return false;
  const { focus, rest } = rowsOf(date), list = isFocusKey(fromKey) ? focus : rest;
  const toIndex = list.indexOf(to);
  list.splice(list.indexOf(from), 1);
  list.splice(toIndex, 0, from);
  writeDay(date, focus, rest);
  save();
  return true;
}

/** Copia de seguridad mínima para deshacer. */
export function snapshot(dates) {
  return { days: Object.fromEntries(dates.map(d => [d, S.d[d] ? structuredClone(S.d[d]) : null])), weeks: structuredClone(S.w) };
}
export function restore(snap) {
  for (const [date, day] of Object.entries(snap.days)) { if (day) S.d[date] = day; else delete S.d[date]; }
  S.w = snap.weeks;
  save();
}

/** Mueve una tarea pendiente a otro día (conserva foco si hay espacio). Devuelve { undo } o { error }. */
export function moveTask(date, key, target) {
  const row = getTask(date, key);
  if (!row || !text(row)) return { error: tr('Escribe una tarea antes de moverla.', 'Write a task before moving it.') };
  if (target === date) return { error: tr('La tarea ya está en ese día.', 'The task is already on that day.') };
  const undo = snapshot([date, target]);
  const copy = { ...row, c: false };
  delete copy.drop;
  delete copy.carriedFrom;
  const dest = rowsOf(target);
  if (isFocusKey(key) && dest.focus.length < MAX_FOCUS) dest.focus.push(copy); else dest.rest.push(copy);
  writeDay(target, dest.focus, dest.rest);
  removeTask(date, key);
  return { undo };
}

// ——— Pendientes de días anteriores ———
const LOOKBACK_DAYS = 21;

/** Tareas sin terminar de días anteriores a `date` (sin las que se soltaron). */
export function overdue(date) {
  const out = [];
  for (let back = LOOKBACK_DAYS; back >= 1; back--) {
    const d = shiftDate(date, -back), { focus, rest } = dayTasks(d);
    for (const { key, row } of [...focus, ...rest]) if (!row.c && !row.drop) out.push({ date: d, key, row });
  }
  return out;
}
/** Trae a `date` todas las pendientes (o una lista concreta). */
export function bringOverdue(date, items = overdue(date)) {
  const dates = [...new Set([date, ...items.map(x => x.date)])], undo = snapshot(dates);
  // Se procesan de la más nueva a la más antigua para que las claves sigan siendo válidas.
  for (const { date: from, row } of items.slice().reverse()) {
    const key = keyOf(from, row);
    if (Number.isFinite(key)) moveTask(from, key, date);
  }
  return { undo, count: items.length };
}
/** «Soltar» una tarea: deja de aparecer como pendiente, sin borrarla de su día. */
export function dropTask(date, key) {
  const row = getTask(date, key);
  if (!row) return;
  row.drop = true;
  save();
}

// ——— Semana ———
export const weekKey = date => iso(addDays(parseDate(date), -weekday(parseDate(date))));
export const weekPath = (week, list, i) => `w.${week}.${list}.${i}`;
const weekList = (week, list) => S.w[week]?.[list] || {};

/** Tareas de la semana con sus días programados. */
export function weekTasks(week, list) {
  const rows = weekList(week, list);
  return [...Array(WEEK_SLOTS).keys()].filter(i => text(rows[i])).map(i => ({ i, row: rows[i], path: weekPath(week, list, i), days: scheduledDays(weekPath(week, list, i)) }));
}

/** Días (fechas) en los que hay una copia vinculada de la tarea semanal. */
export function scheduledDays(path) {
  const out = [];
  for (const [date, day] of Object.entries(S.d)) for (const row of Object.values(day.k || {})) if (row?.source === path && text(row)) out.push(date);
  return out.sort();
}

function writeWeek(week, list, rows) {
  const w = S.w[week] = S.w[week] || {};
  const out = {};
  rows.slice(0, WEEK_SLOTS).forEach((row, i) => { out[i] = row; });
  w[list] = out;
}
/** Renombra los vínculos de los días cuando una tarea semanal cambia de lugar. */
function relink(from, to) {
  for (const day of Object.values(S.d)) for (const row of Object.values(day.k || {})) {
    if (row?.source === from) { if (to) row.source = to; else delete row.source; }
  }
}
/** Reordena una lista semanal quitando huecos y actualizando vínculos. */
function rewriteWeek(week, list, rows) {
  const before = new Map();
  [...Array(WEEK_SLOTS).keys()].forEach(i => { const r = weekList(week, list)[i]; if (r) before.set(r, weekPath(week, list, i)); });
  // Primero se marcan con una ruta temporal para evitar choques al intercambiar posiciones.
  const temp = new Map();
  rows.forEach((row, i) => { const old = before.get(row); if (old) { const t = `tmp.${week}.${list}.${i}`; relink(old, t); temp.set(t, weekPath(week, list, i)); } });
  for (const [row, path] of before) if (!rows.includes(row)) relink(path, null);
  writeWeek(week, list, rows);
  for (const [t, final] of temp) relink(t, final);
}

export function addWeekTask(week, list, value) {
  const t = String(value || '').trim();
  if (!t) return { error: tr('Escribe una tarea.', 'Write a task.') };
  const rows = weekTasks(week, list).map(x => x.row);
  if (rows.length >= WEEK_SLOTS) return { error: list === 'a' ? tr('El foco de la semana tiene cinco tareas. Menos es más.', 'Your weekly focus already has five tasks. Less is more.') : tr('Ya tienes cinco tareas más esta semana.', 'You already have five more tasks this week.') };
  rows.push({ t, c: false });
  rewriteWeek(week, list, rows);
  save();
  return { i: rows.length - 1 };
}

export function renameWeekTask(week, list, i, value) {
  const row = weekList(week, list)[i];
  if (!row) return;
  const t = String(value ?? '');
  if (t.trim() !== text(row)) relink(weekPath(week, list, i), null);
  row.t = t;
  save();
}

export function setWeekDone(week, list, i, value) {
  const row = weekList(week, list)[i];
  if (!row) return;
  row.c = !!value;
  syncLinked(weekPath(week, list, i), row.c);
  save();
}

export function removeWeekTask(week, list, i) {
  const row = weekList(week, list)[i];
  if (!row) return;
  rewriteWeek(week, list, weekTasks(week, list).map(x => x.row).filter(r => r !== row));
  save();
}

/** Pasa una tarea entre «foco» (a) y «otras» (b). */
export function toggleWeekFocus(week, list, i) {
  const row = weekList(week, list)[i], other = list === 'a' ? 'b' : 'a';
  if (!row) return { error: tr('La tarea ya no existe.', 'This task no longer exists.') };
  const dest = weekTasks(week, other).map(x => x.row);
  if (dest.length >= WEEK_SLOTS) return { error: tr('Esa lista ya tiene cinco tareas.', 'That list already has five tasks.') };
  // Los días vinculados se marcan con una ruta temporal y luego reciben la ruta nueva.
  const moving = `tmp.${week}.move`;
  relink(weekPath(week, list, i), moving);
  rewriteWeek(week, list, weekTasks(week, list).map(x => x.row).filter(r => r !== row));
  dest.push(row);
  rewriteWeek(week, other, dest);
  relink(moving, weekPath(week, other, dest.length - 1));
  save();
  return { list: other, i: dest.length - 1 };
}

/** Programa o desprograma una tarea semanal en un día (alterna). */
export function toggleWeekDay(week, list, i, date) {
  const path = weekPath(week, list, i), row = weekList(week, list)[i];
  if (!row || !text(row)) return { error: tr('Escribe la tarea primero.', 'Write the task first.') };
  const existing = Object.entries(S.d[date]?.k || {}).find(([, r]) => r?.source === path);
  if (existing) { removeTask(date, +existing[0]); return { removed: true }; }
  addTask(date, row.t, { focus: list === 'a', source: path });
  const key = keyOf(date, Object.values(S.d[date].k).find(r => r?.source === path));
  if (row.c) getTask(date, key).c = true;
  save();
  return { added: true };
}

/** Marca hecha la tarea semanal y todas sus copias vinculadas. */
function syncLinked(source, value) {
  if (!source || !/^w\./.test(source)) return;
  const [, week, list, i] = source.split('.');
  const weekly = S.w[week]?.[list]?.[i];
  if (weekly) weekly.c = value;
  for (const day of Object.values(S.d)) for (const row of Object.values(day.k || {})) if (row?.source === source) row.c = value;
}

/**
 * Lleva una tarea semanal pendiente a la misma lista de la semana siguiente, sin día asignado.
 * Sus copias pendientes en los días de esta semana se quitan; las ya hechas quedan, sin vínculo.
 */
export function moveWeekTaskToNext(week, list, i) {
  const row = weekList(week, list)[i];
  if (!row || !text(row)) return { error: tr('La tarea ya no existe.', 'This task no longer exists.') };
  const next = shiftDate(week, 7);
  if (weekTasks(next, list).length >= WEEK_SLOTS) return { error: list === 'a' ? tr('El foco de la próxima semana ya tiene cinco tareas.', 'Next week’s focus already has five tasks.') : tr('La próxima semana ya tiene cinco tareas en esa lista.', 'Next week already has five tasks in that list.') };
  const path = weekPath(week, list, i);
  // Al quitar una tarea el día se reescribe sin huecos, así que se busca de nuevo después de cada una.
  const pendingCopy = date => Object.entries(S.d[date]?.k || {}).find(([, r]) => r?.source === path && !r.c)?.[0];
  for (const date of Object.keys(S.d)) for (let key = pendingCopy(date); key !== undefined; key = pendingCopy(date)) removeTask(date, +key);
  removeWeekTask(week, list, i);
  addWeekTask(next, list, row.t);
  return { week: next };
}
