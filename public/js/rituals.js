// «Empieza tu día» y «Cierra tu día»: se escriben el mismo día o cualquier día ya vivido, sin límite
// de hora (un día futuro todavía no). El botón los da por terminados: quedan plegados y solo para
// leer, y «Editar» los vuelve a abrir. Se guarda en d[fecha].closed = { m: true, e: true }
// (m = mañana, e = cierre).
import { S, save, get } from './state.js';
import { iso, monday, parseDate, shiftDate, shiftMonth, weekday } from './util.js';

// Los días y semanas pasados se pueden editar igual que los actuales (tareas incluidas): no hay
// bloqueo por hora. Solo cambia qué se ofrece primero al mover (p. ej., «Pasar a hoy»).
/** La semana (que empieza el lunes `week`) ya terminó. */
export const isPastWeek = (week, now = new Date()) => shiftDate(week, 6) < iso(now);
export const isFinished = (date, which) => S.d[date]?.closed?.[which] === true;
/** 'open' | 'done' | 'future' (todavía no llega el día) */
export function ritualState(date, which, now = new Date()) {
  if (isFinished(date, which)) return 'done';
  return date > iso(now) ? 'future' : 'open';
}
export const canEditRitual = (date, which, now) => ritualState(date, which, now) === 'open';
/** Vuelve a abrir un ritual terminado para corregirlo o completarlo. */
export function reopenRitual(date, which) {
  const closed = S.d[date]?.closed;
  if (!closed?.[which]) return false;
  delete closed[which];
  if (!Object.keys(closed).length) delete S.d[date].closed;
  save();
  return true;
}

const clean = v => String(v || '').trim();
/** ¿Hay algo escrito para poder terminarlo? */
export function hasContent(date, which) {
  const Z = `d.${date}.`;
  return which === 'm' ? !!(clean(get(Z + 'i')) || clean(get(Z + 'g')))
    : !!(clean(get(Z + 'r')) || S.d[date]?.mood || ['hl', 'learn', 'remember', 'p'].some(k => clean(get(Z + k))));
}

/** Marca terminado. Devuelve una función para deshacer. */
export function finishRitual(date, which) {
  const day = S.d[date] = S.d[date] || {};
  day.closed = { ...(day.closed || {}), [which]: true };
  save();
  return () => {
    if (!S.d[date]?.closed) return;
    delete S.d[date].closed[which];
    if (!Object.keys(S.d[date].closed).length) delete S.d[date].closed;
    save();
  };
}

// ——— Intención de la semana ———
// Como «Empieza tu día»: se escribe y el botón la da por definida; queda solo para leer y «Editar» la
// vuelve a abrir. Se puede definir de antemano (p. ej., el domingo para la semana siguiente).
// Se guarda en w[lunes].started.
export const intentState = week => (S.w[week]?.started === true ? 'done' : 'open');
export const canEditIntent = week => intentState(week) === 'open';
export const hasIntent = week => !!clean(S.w[week]?.i);
export function finishIntent(week) {
  const w = S.w[week] = S.w[week] || {};
  w.started = true;
  save();
  return () => { if (S.w[week]) delete S.w[week].started; save(); };
}
export function reopenIntent(week) {
  if (S.w[week]?.started !== true) return false;
  delete S.w[week].started;
  save();
  return true;
}

// ——— Revisión semanal ———
// Como «Cierra tu día»: se escribe durante su semana o después, sin límite de hora, y el botón la da
// por terminada cuando se quiera; terminada queda solo para leer, y «Editar» la vuelve a abrir.
// Se guarda en w[lunes].closed.
/** 'ready' (se escribe y se puede terminar) | 'done' | 'future' (la semana aún no empieza) */
export function reviewState(week, now = new Date()) {
  if (S.w[week]?.closed === true) return 'done';
  return now < parseDate(week) ? 'future' : 'ready';
}
export const canEditReview = (week, now) => reviewState(week, now) === 'ready';
export const hasReview = week => Object.values(S.w[week]?.r || {}).some(v => clean(v));
export function finishReview(week) {
  const w = S.w[week] = S.w[week] || {};
  w.closed = true;
  save();
  return () => { if (S.w[week]) delete S.w[week].closed; save(); };
}
export function reopenReview(week) {
  if (S.w[week]?.closed !== true) return false;
  delete S.w[week].closed;
  save();
  return true;
}

// ——— Recordatorios (avisos en Hoy) ———
export const REMINDER_HOUR = 18;
/**
 * Semana cuya revisión conviene recordar: la actual el domingo desde las 18:00, o la pasada el
 * lunes antes de mediodía (mucha gente no abre la app el domingo en la noche). null si ya se cerró.
 */
export function reviewReminder(now = new Date()) {
  const wd = weekday(now), mon = iso(monday(now));
  const week = wd === 6 && now.getHours() >= REMINDER_HOUR ? mon : wd === 0 && now.getHours() < 12 ? shiftDate(mon, -7) : null;
  return week && reviewState(week, now) !== 'done' ? week : null;
}
/** ¿Tiene algo escrito «Lo mejor del mes»? */
export const hasMonthBest = ym => Object.values(S.m[ym]?.h || {}).some(v => clean(v));
/** Mes cuyo «Lo mejor del mes» conviene recordar: el último día desde las 18:00, o el anterior los días 1 y 2. */
export function monthReminder(now = new Date()) {
  const T = iso(now), ym = T.slice(0, 7);
  const lastDay = shiftDate(T, 1).slice(0, 7) !== ym;
  const month = lastDay && now.getHours() >= REMINDER_HOUR ? ym : now.getDate() <= 2 ? shiftMonth(ym, -1) : null;
  return month && !hasMonthBest(month) ? month : null;
}
