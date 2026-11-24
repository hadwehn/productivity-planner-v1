// Reglas de tareas (día y semana). Sin DOM: se puede probar aislado.
//
// Formato guardado (compatible con la versión anterior):
//   d[fecha].k: claves 0, 501, 502 = tareas en foco (máx. 3); 1…500 = el resto, en orden.
//   w[lunes].a / .b: índices 0…4 = foco de la semana / otras tareas de la semana.
//   Una tarea del día traída de la semana guarda source = 'w.LUNES.a|b.i'. Cada día es una copia
//   independiente: marcarla hecha no marca las de otros días. La tarea semanal queda hecha cuando
//   todas sus copias lo están (o al marcarla en Plan, que marca todas). Un día no tiene dos copias
//   de la misma tarea semanal: al moverla a un día que ya la tiene, quedan en una.
//   Si una copia pendiente sale de su semana (a otro día fuera de ella o a «Sin fecha»), la semanal
//   guarda moved = true y ya no se da por hecha sola: ese trabajo no se hizo en su semana.
//   Una tarea semanal puede ser un objetivo (goal = true): no se reparte en días y se marca a mano.
//   Pendientes de más de 21 días pasan solos a «Sin fecha» (archiveOverdue, al abrir la app).
//   Horizontes: un día → la semana → «Algún día». Una tarea sube o baja de a un peldaño
//   (taskToWeek, undatedToWeek).
//   nd: tareas «Algún día» (antes «Sin fecha») [{ t, from? }]: hay que hacerlas, pero aún no se sabe cuándo (from = día de donde salió).
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
  if (row.source && t.trim() !== text(row)) { const old = row.source; delete row.source; refreshWeekly(old); }
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
  refreshWeekly(row.source);
  save();
}

export function removeTask(date, key) {
  const row = getTask(date, key);
  if (!row) return;
  const { focus, rest } = rowsOf(date);
  writeDay(date, focus.filter(r => r !== row), rest.filter(r => r !== row));
  refreshWeekly(row.source);
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
  return { days: Object.fromEntries(dates.map(d => [d, S.d[d] ? structuredClone(S.d[d]) : null])), weeks: structuredClone(S.w), nd: structuredClone(S.nd || []) };
}
export function restore(snap) {
  for (const [date, day] of Object.entries(snap.days)) { if (day) S.d[date] = day; else delete S.d[date]; }
  S.w = snap.weeks;
  if (snap.nd) { if (snap.nd.length) S.nd = snap.nd; else delete S.nd; }
  save();
}

/** Mueve una tarea pendiente a otro día (conserva foco si hay espacio). Devuelve { undo } o { error }. */
export function moveTask(date, key, target) {
  const row = getTask(date, key);
  if (!row || !text(row)) return { error: tr('Escribe una tarea antes de moverla.', 'Write a task before moving it.') };
  if (target === date) return { error: tr('La tarea ya está en ese día.', 'The task is already on that day.') };
  const undo = snapshot([date, target]);
  // Si ese día ya tiene esta misma tarea semanal, no se agrega otra: queda la de ese día.
  if (row.source && Object.values(S.d[target]?.k || {}).some(r => r?.source === row.source)) {
    removeTask(date, key);
    return { undo, merged: true };
  }
  if (!inWeekOf(row.source, target)) leavesWeek(row);
  const copy = { ...row, c: false };
  delete copy.drop;
  delete copy.carriedFrom;
  if (!inWeekOf(copy.source, target)) delete copy.source; // fuera de su semana deja de ser una copia
  const dest = rowsOf(target);
  if (isFocusKey(key) && dest.focus.length < MAX_FOCUS) dest.focus.push(copy); else dest.rest.push(copy);
  writeDay(target, dest.focus, dest.rest);
  removeTask(date, key);
  refreshWeekly(copy.source);
  return { undo };
}

/** Pasa todas las tareas sin terminar de `date` a `target` (las de foco, al foco si cabe). */
export function movePendingTo(date, target) {
  const undo = snapshot([date, target]);
  let count = 0, merged = 0;
  // Al mover una, el día se reescribe sin huecos: se busca la siguiente pendiente cada vez.
  for (let next = pendingOf(date); next; next = pendingOf(date)) {
    const r = moveTask(date, next.key, target);
    if (r.error) break;
    count++;
    if (r.merged) merged++; // ese día ya la tenía (tarea semanal programada): no se duplicó
  }
  return { count, merged, undo };
}
const pendingOf = date => { const { focus, rest } = dayTasks(date); return [...focus, ...rest].find(t => !t.row.c); };

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
/** Pasa a «Sin fecha» las pendientes de días anteriores a la ventana de avisos. Devuelve cuántas. */
export function archiveOverdue(date) {
  const limit = shiftDate(date, -LOOKBACK_DAYS);
  const stale = d => { const { focus, rest } = dayTasks(d); return [...focus, ...rest].find(t => !t.row.c && !t.row.drop); };
  let count = 0;
  for (const d of Object.keys(S.d).filter(d => d < limit).sort()) {
    for (let next = stale(d); next; next = stale(d)) {
      if (leaveUndated(d, next.key).error) return count; // «Sin fecha» llena: el resto sigue en su día
      count++;
    }
  }
  return count;
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
  return [...Array(WEEK_SLOTS).keys()].filter(i => text(rows[i])).map(i => { const path = weekPath(week, list, i); return { i, row: rows[i], path, days: scheduledDays(path), done: doneDays(path) }; });
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
  if (row.c) delete row.moved; // marcarla en Plan la da por hecha, aunque parte saliera de la semana
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
  if (row.goal) return { error: tr('Es un objetivo: no se reparte en días.', 'It’s a goal: it isn’t split into days.') };
  const existing = Object.entries(S.d[date]?.k || {}).find(([, r]) => r?.source === path);
  if (existing) { removeTask(date, +existing[0]); return { removed: true }; }
  delete row.moved; // se vuelve a programar dentro de su semana
  addTask(date, row.t, { focus: list === 'a', source: path });
  refreshWeekly(path); // la copia nueva llega pendiente: la semanal deja de estar hecha si lo estaba
  save();
  return { added: true };
}

/** Marca hecha (o no) la tarea semanal y todas sus copias de los días: se usa al marcarla en Plan. */
function syncLinked(source, value) {
  if (!source || !/^w\./.test(source)) return;
  const [, week, list, i] = source.split('.');
  const weekly = S.w[week]?.[list]?.[i];
  if (weekly) weekly.c = value;
  for (const day of Object.values(S.d)) for (const row of Object.values(day.k || {})) if (row?.source === source) row.c = value;
}
/** Copias de los días de una tarea semanal. */
const copiesOf = source => Object.values(S.d).flatMap(day => Object.values(day.k || {})).filter(r => r?.source === source && text(r));
const weeklyOf = source => { if (!source || !/^w\./.test(source)) return null; const [, week, list, i] = source.split('.'); return S.w[week]?.[list]?.[i] || null; };
/**
 * La tarea semanal está hecha cuando todas sus copias de los días lo están (si no tiene copias, no
 * cambia). Si parte de ella salió de la semana sin hacerse (moved), queda pendiente.
 */
function refreshWeekly(source) {
  const weekly = weeklyOf(source), copies = copiesOf(source);
  if (weekly?.goal) return; // un objetivo se marca a mano
  if (weekly && (copies.length || weekly.moved)) weekly.c = !weekly.moved && copies.every(r => r.c);
}
/** Una copia pendiente sale de su semana: la semanal ya no puede darse por hecha sola. */
function leavesWeek(row) {
  const weekly = row.c ? null : weeklyOf(row.source);
  if (weekly) weekly.moved = true;
}
/** ¿`date` cae en la semana de la tarea semanal `source`? (sin `source`, sí: no hay semana que dejar) */
const inWeekOf = (source, date) => { if (!source) return true; const week = source.split('.')[1]; return date >= week && date <= shiftDate(week, 6); };
/** Días de esta tarea semanal ya hechos. */
export function doneDays(path) {
  const out = [];
  for (const [date, day] of Object.entries(S.d)) for (const row of Object.values(day.k || {})) if (row?.source === path && text(row) && row.c) out.push(date);
  return out.sort();
}

/**
 * Lleva una tarea semanal a la misma lista de otra semana (por defecto, la siguiente), sin día asignado.
 * Llega pendiente (aunque estuviera hecha: se sigue trabajando en ella).
 * Sus copias pendientes en los días de esta semana se quitan; las ya hechas quedan, sin vínculo.
 */
export function moveWeekTaskToNext(week, list, i, next = shiftDate(week, 7)) {
  const row = weekList(week, list)[i];
  if (!row || !text(row)) return { error: tr('La tarea ya no existe.', 'This task no longer exists.') };
  if (next === week) return { error: tr('La tarea ya está en esa semana.', 'The task is already in that week.') };
  if (weekTasks(next, list).length >= WEEK_SLOTS) return { error: next !== shiftDate(week, 7) ? tr('Esa semana ya tiene cinco tareas en esa lista.', 'That week already has five tasks in that list.') : list === 'a' ? tr('El foco de la próxima semana ya tiene cinco tareas.', 'Next week’s focus already has five tasks.') : tr('La próxima semana ya tiene cinco tareas en esa lista.', 'Next week already has five tasks in that list.') };
  const path = weekPath(week, list, i);
  // Al quitar una tarea el día se reescribe sin huecos, así que se busca de nuevo después de cada una.
  const pendingCopy = date => Object.entries(S.d[date]?.k || {}).find(([, r]) => r?.source === path && !r.c)?.[0];
  for (const date of Object.keys(S.d)) for (let key = pendingCopy(date); key !== undefined; key = pendingCopy(date)) removeTask(date, +key);
  removeWeekTask(week, list, i);
  const added = addWeekTask(next, list, row.t);
  if (row.goal && added.i !== undefined) S.w[next][list][added.i].goal = true; // sigue siendo objetivo
  return { week: next };
}

/**
 * Convierte una tarea semanal en objetivo (sin días) o la vuelve a repartir en días.
 * Al convertirla, sus copias pendientes se quitan de los días y las hechas quedan como registro,
 * sin vínculo. Devuelve { removed } (copias quitadas) o { error }.
 */
export function setWeekGoal(week, list, i, on) {
  const row = weekList(week, list)[i];
  if (!row || !text(row)) return { error: tr('La tarea ya no existe.', 'This task no longer exists.') };
  if (!on) { delete row.goal; save(); return { removed: 0 }; }
  const path = weekPath(week, list, i);
  row.goal = true; // antes de quitar copias: un objetivo no se marca hecho solo
  delete row.moved;
  let removed = 0;
  const pendingCopy = date => Object.entries(S.d[date]?.k || {}).find(([, r]) => r?.source === path && !r.c)?.[0];
  for (const date of Object.keys(S.d)) for (let key = pendingCopy(date); key !== undefined; key = pendingCopy(date)) { removeTask(date, +key); removed++; }
  relink(path, null); // las ya hechas quedan en su día, sueltas
  save();
  return { removed };
}

// ——— Día → semana ———
/** Semana a la que «sube» una tarea de `date`: la suya, salvo que ya pasó (entonces, la actual). */
export const weekForDay = (date, T) => { const own = weekKey(date), now = weekKey(T); return own < now ? now : own; };
/** Lista semanal con espacio, empezando por la preferida (a = foco de la semana, b = también esta semana). */
const roomIn = (week, first) => [first, first === 'a' ? 'b' : 'a'].find(l => weekTasks(week, l).length < WEEK_SLOTS);
const fullWeek = () => tr('Esa semana ya tiene cinco tareas en cada lista. Quita alguna primero.', 'That week already has five tasks in each list. Remove one first.');

/**
 * Pasa una tarea del día a la semana, sin día. Las del foco del día van al foco de la semana (si
 * hay espacio). Si era la copia de una tarea de esa misma semana, solo se quita del día: ya está
 * en la semana. Devuelve { undo, week, list, unscheduled? } o { error }.
 */
export function taskToWeek(date, key, T) {
  const row = getTask(date, key);
  if (!row || !text(row)) return { error: tr('Escribe una tarea antes de moverla.', 'Write a task before moving it.') };
  const week = weekForDay(date, T), undo = snapshot([date]);
  if (row.source && row.source.split('.')[1] === week && weeklyOf(row.source)) {
    // Ese trabajo sigue pendiente en la semana, sin día: la semanal no se da por hecha sola
    // (se vuelve a completar sola al programarla otra vez en un día).
    if (!row.c) weeklyOf(row.source).moved = true;
    removeTask(date, key);
    return { undo, week, list: row.source.split('.')[2], unscheduled: true };
  }
  const list = roomIn(week, isFocusKey(key) ? 'a' : 'b');
  if (!list) return { error: fullWeek() };
  leavesWeek(row); // si era copia de otra semana, esa semanal ya no se da por hecha sola
  removeTask(date, key);
  addWeekTask(week, list, row.t);
  return { undo, week, list };
}

/** Lleva una tarea de «Algún día» a la semana (por defecto a «También esta semana»). */
export function undatedToWeek(i, week) {
  const row = noDate()[i];
  if (!row) return { error: tr('Esa tarea ya no está.', 'That task is no longer there.') };
  const list = roomIn(week, 'b');
  if (!list) return { error: fullWeek() };
  const undo = snapshot([]);
  addWeekTask(week, list, row.t);
  setNoDate(noDate().filter((_, j) => j !== i));
  save();
  return { undo, week, list };
}

// ——— Algún día (nd; en el código, «sin fecha») ———
export const MAX_NO_DATE = 200;
export const noDate = () => S.nd || [];
const setNoDate = list => { if (list.length) S.nd = list; else delete S.nd; };
/** Saca una tarea del día y la deja «sin fecha». Devuelve { undo } o { error }. */
export function leaveUndated(date, key) {
  const row = getTask(date, key);
  if (!row || !text(row)) return { error: tr('Escribe una tarea antes de moverla.', 'Write a task before moving it.') };
  if (noDate().length >= MAX_NO_DATE) return { error: tr('Ya tienes muchas tareas para algún día. Elimina o agenda alguna.', 'You have too many “Someday” tasks. Delete or schedule some.') };
  const undo = snapshot([date]);
  setNoDate([...noDate(), { t: text(row), from: date }]);
  leavesWeek(row);
  removeTask(date, key);
  return { undo };
}
/** Anota directamente una tarea sin fecha. */
export function addUndated(value) {
  const t = String(value || '').trim();
  if (!t) return { error: '' };
  if (noDate().length >= MAX_NO_DATE) return { error: tr('Ya tienes muchas tareas para algún día. Elimina o agenda alguna.', 'You have too many “Someday” tasks. Delete or schedule some.') };
  setNoDate([...noDate(), { t }]);
  save();
  return {};
}
/** Lleva una tarea sin fecha a un día. */
export function scheduleUndated(i, date) {
  const row = noDate()[i];
  if (!row) return { error: tr('Esa tarea ya no está.', 'That task is no longer there.') };
  const undo = snapshot([date]);
  addTask(date, row.t);
  setNoDate(noDate().filter((_, j) => j !== i));
  save();
  return { undo };
}
export function removeUndated(i) {
  if (!noDate()[i]) return null;
  const undo = snapshot([]);
  setNoDate(noDate().filter((_, j) => j !== i));
  save();
  return { undo };
}
