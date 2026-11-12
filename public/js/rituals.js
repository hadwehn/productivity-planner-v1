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
