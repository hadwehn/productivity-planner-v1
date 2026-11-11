// Reglas de hábitos. Dos frecuencias: días fijos de la semana (h.days) o «N veces por semana» (h.perWeek).
import { S, save } from './state.js';
import { DAY_SHORT, addDays, iso, newId, parseDate, shiftDate, today, weekdayOf } from './util.js';
import { plural, tr } from './i18n.js';

export const isWeekly = h => Number.isInteger(h.perWeek);
export const isDone = (h, date) => (S.hl[date] || {})[h.id] === 1;
const started = (h, date) => !h.createdOn || date >= h.createdOn;
const mondayOf = date => shiftDate(date, -weekdayOf(date));

/** ¿Tiene sentido mostrar el hábito ese día? (los semanales, todos los días). */
export function isDue(h, date) {
  if (!started(h, date)) return false;
  if (isWeekly(h)) return true;
  return !Array.isArray(h.days) || h.days.includes(weekdayOf(date));
}

export function toggle(h, date) {
  const day = S.hl[date] = S.hl[date] || {};
  day[h.id] = day[h.id] === 1 ? 0 : 1;
  save();
  return day[h.id] === 1;
}

/** Veces hechas en la semana de `date` (lunes a domingo). */
export function weekCount(h, date) {
  const mon = mondayOf(date);
  let n = 0;
  for (let i = 0; i < 7; i++) if (isDone(h, shiftDate(mon, i))) n++;
  return n;
}

/** Texto corto de frecuencia. */
export function frequencyLabel(h) {
  if (isWeekly(h)) return tr(`${h.perWeek} ${h.perWeek === 1 ? 'vez' : 'veces'} por semana`, `${h.perWeek} ${h.perWeek === 1 ? 'time' : 'times'} a week`);
  const days = Array.isArray(h.days) ? h.days.slice().sort() : [0, 1, 2, 3, 4, 5, 6];
  if (days.length === 7) return tr('Todos los días', 'Every day');
  if (days.join() === '0,1,2,3,4') return tr('De lunes a viernes', 'Weekdays');
  if (days.join() === '5,6') return tr('Fines de semana', 'Weekends');
  return days.map(d => DAY_SHORT[d]).join(' · ');
}

/**
 * Racha amable: días programados seguidos (o semanas que cumplieron la meta).
 * Hoy sin marcar no rompe la racha: todavía hay tiempo.
 */
export function streak(h, T = today()) {
  if (isWeekly(h)) {
    let n = 0, mon = mondayOf(T);
    if (weekCount(h, mon) >= h.perWeek) n++;
    for (let back = 1; back < 60; back++) {
      const m = shiftDate(mon, -7 * back);
      if (h.createdOn && shiftDate(m, 6) < h.createdOn) break;
      if (weekCount(h, m) >= h.perWeek) n++; else break;
    }
    return { n, unit: plural(n, 'semana', 'semanas', 'week', 'weeks') };
  }
  let n = 0;
  for (let back = 0; back < 400; back++) {
    const date = iso(addDays(parseDate(T), -back));
    if (!started(h, date)) break;
    if (!isDue(h, date)) continue;
    if (isDone(h, date)) n++; else if (date !== T) break;
  }
  return { n, unit: plural(n, 'día', 'días', 'day', 'days') };
}

/** Constancia de los últimos 28 días (0-100). Perdona: cuenta lo hecho, no castiga lo que falta. */
export function consistency(h, T = today()) {
  let due = 0, done = 0;
  if (isWeekly(h)) {
    for (let w = 0; w < 4; w++) {
      const mon = shiftDate(mondayOf(T), -7 * w);
      if (h.createdOn && shiftDate(mon, 6) < h.createdOn) break;
      const achieved = Math.min(h.perWeek, weekCount(h, mon));
      done += achieved;
      // La semana en curso solo suma lo que ya se hizo: todavía hay tiempo.
      due += w === 0 ? achieved : h.perWeek;
    }
    if (!due) return null;
    return Math.round(done / due * 100);
  }
  for (let back = 0; back < 28; back++) {
    const date = shiftDate(T, -back);
    if (!started(h, date)) break;
    if (!isDue(h, date)) continue;
    if (back === 0 && !isDone(h, date)) continue;
    due++;
    if (isDone(h, date)) done++;
  }
  return due ? Math.round(done / due * 100) : null;
}

export function saveHabit({ id, name, color, days, perWeek }) {
  const data = { name: name.trim(), color };
  if (perWeek) { data.perWeek = perWeek; data.days = undefined; }
  else { data.days = days; data.perWeek = undefined; }
  let habit = S.h.find(x => x.id === id);
  if (habit) Object.assign(habit, data);
  else S.h.push(habit = { id: newId(), createdOn: today(), ...data });
  if (habit.perWeek === undefined) delete habit.perWeek;
  if (habit.days === undefined) delete habit.days;
  save();
  return habit;
}

export function deleteHabit(id) {
  S.h = S.h.filter(x => x.id !== id);
  for (const day of Object.values(S.hl)) delete day[id];
  save();
}

export function moveHabit(fromId, toId) {
  const from = S.h.findIndex(h => h.id === fromId), to = S.h.findIndex(h => h.id === toId);
  if (from < 0 || to < 0 || from === to) return false;
  const [h] = S.h.splice(from, 1);
  S.h.splice(to, 0, h);
  save();
  return true;
}
