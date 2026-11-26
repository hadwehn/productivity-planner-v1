// Eventos de la agenda. Se guardan en el día en que empiezan (S.ev[inicio]); los de varios días
// llevan además `to` (último día, 'AAAA-MM-DD') y se muestran en cada día del rango.
import { S } from './state.js';
import { categoryColor } from './categories.js';
import { dayMonthShort, tr } from './i18n.js';
import { esc, parseDate, shiftDate } from './util.js';

export const MAX_EVENT_DAYS = 366;

/** Eventos visibles en `date`: { e, i, start } (start = día donde está guardado). */
export function eventsOn(date) {
  const out = [];
  for (const [start, list] of Object.entries(S.ev)) {
    if (start > date) continue;
    list.forEach((e, i) => {
      if (!e?.t?.trim()) return;
      if (start === date || (e.to && e.to >= date)) out.push({ e, i, start });
    });
  }
  // Primero los que duran varios días (son de «todo el día»), luego por hora.
  const rank = ({ e, start }) => (e.to && e.to > start ? '0' : '1') + (e.h || '99');
  return out.sort((a, b) => rank(a).localeCompare(rank(b)));
}

/** «Hasta» de un evento cuyo inicio pasa de `from` a `day`: se corre igual y conserva la duración. */
export const shiftEnd = (to, from, day) => (to ? shiftDate(to, Math.round((parseDate(day) - parseDate(from)) / 864e5)) : '');

/**
 * Guarda un evento nuevo (index null) o editado. Si su día cambió de `date` a `day`, sale de la
 * lista del día anterior (que se quita si queda vacía) y entra al final de la del día nuevo.
 */
export function putEvent(date, index, day, event) {
  if (index !== null && day === date) { S.ev[date][index] = event; return; }
  if (index !== null) {
    S.ev[date].splice(index, 1);
    if (!S.ev[date].length) Reflect.deleteProperty(S.ev, date);
  }
  (S.ev[day] = S.ev[day] || []).push(event);
}

/** «14 – 16 nov» */
export function rangeLabel(start, end) {
  const a = parseDate(start), b = parseDate(end);
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    ? tr(`${a.getDate()} – ${dayMonthShort(b)}`, `${dayMonthShort(a)} – ${b.getDate()}`)
    : `${dayMonthShort(a)} – ${dayMonthShort(b)}`;
}

/** Fila de evento para la agenda de un día (Hoy y Mes). */
export function eventRow({ e, i, start }, date, locked = false) {
  const multi = e.to && e.to > start;
  const time = multi ? (date === start && e.h ? e.h : tr('Todo', 'All day')) : (e.h || tr('Todo', 'All day'));
  const range = multi ? `<small class="event-range">${rangeLabel(start, e.to)}</small>` : '';
  if (locked) return `<div class="event still" style="--c:${categoryColor(e.c ?? -1)}"><time>${esc(time)}</time><i class="bar"></i><span>${esc(e.t)}${range}</span></div>`; // día cerrado: solo se lee
  return `<button class="event" data-a="eventedit" data-i="${i}" data-k="${start}" style="--c:${categoryColor(e.c ?? -1)}"><time>${esc(time)}</time><i class="bar"></i><span>${esc(e.t)}${range}</span></button>`;
}
