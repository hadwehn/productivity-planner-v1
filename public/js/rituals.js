// «Empieza tu día» y «Cierra tu día»: se escriben el mismo día o cualquier día ya vivido, sin límite
// de hora (un día futuro todavía no). El botón los da por terminados: quedan plegados y solo para
// leer, y «Editar» los vuelve a abrir. Se guarda en d[fecha].closed = { m: true, e: true }
// (m = mañana, e = cierre).
import { S, save, get } from './state.js';
import { iso, parseDate, shiftDate } from './util.js';

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

// ——— Revisión semanal ———
// Se escribe durante su semana o después. Desde el domingo aparece el botón para darla por
// terminada; terminada queda solo para leer, y «Editar» la vuelve a abrir. Se guarda en w[lunes].closed.
/** 'open' (se escribe, aún no es domingo) | 'ready' (se puede terminar) | 'done' | 'future' */
export function reviewState(week, now = new Date()) {
  if (S.w[week]?.closed === true) return 'done';
  if (now < parseDate(week)) return 'future';
  return now >= parseDate(shiftDate(week, 6)) ? 'ready' : 'open';
}
export const canEditReview = (week, now) => ['open', 'ready'].includes(reviewState(week, now));
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
