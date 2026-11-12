// «Empieza tu día» y «Cierra tu día»: se escriben solo en su día (hasta las 3 de la madrugada
// siguiente) y se pueden dar por terminados con un botón. Terminado o pasado el plazo, quedan
// solo para leer. Se guarda en d[fecha].closed = { m: true, e: true } (m = mañana, e = cierre).
import { S, save, get } from './state.js';
import { parseDate, shiftDate } from './util.js';

export const LOCK_HOUR = 3;

/** ¿Estamos dentro del día `date` (desde las 00:00 hasta las 3:00 del día siguiente)? */
export function inWindow(date, now = new Date()) {
  const end = parseDate(shiftDate(date, 1));
  end.setHours(LOCK_HOUR);
  return now >= parseDate(date) && now < end;
}
/** El día ya pasó (son más de las 3:00 del día siguiente): sus tareas solo se marcan o se mueven. */
export function dayClosed(date, now = new Date()) {
  const end = parseDate(shiftDate(date, 1));
  end.setHours(LOCK_HOUR);
  return now >= end;
}
export const isFinished = (date, which) => S.d[date]?.closed?.[which] === true;
export const canEditRitual = (date, which) => !isFinished(date, which) && inWindow(date);
/** 'open' | 'done' | 'past' (ya cerró el plazo) | 'future' (todavía no llega el día) */
export function ritualState(date, which, now = new Date()) {
  if (isFinished(date, which)) return 'done';
  if (inWindow(date, now)) return 'open';
  return parseDate(date) > now ? 'future' : 'past';
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
// Se escribe durante su semana; solo el domingo (hasta las 3:00 del lunes) aparece el botón para
// darla por terminada. Terminada, o pasado ese plazo, queda solo para leer. Se guarda en w[lunes].closed.
/** 'open' (se escribe, aún no es domingo) | 'sunday' (se puede terminar) | 'done' | 'past' | 'future' */
export function reviewState(week, now = new Date()) {
  if (S.w[week]?.closed === true) return 'done';
  const end = parseDate(shiftDate(week, 7));
  end.setHours(LOCK_HOUR);
  if (now >= end) return 'past';
  if (now < parseDate(week)) return 'future';
  return now >= parseDate(shiftDate(week, 6)) ? 'sunday' : 'open';
}
export const canEditReview = (week, now) => ['open', 'sunday'].includes(reviewState(week, now));
export const hasReview = week => Object.values(S.w[week]?.r || {}).some(v => clean(v));
export function finishReview(week) {
  const w = S.w[week] = S.w[week] || {};
  w.closed = true;
  save();
  return () => { if (S.w[week]) delete S.w[week].closed; save(); };
}
