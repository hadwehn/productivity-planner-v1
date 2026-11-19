// Reglas de hábitos. Dos frecuencias: días fijos de la semana (h.days) o «N veces por semana» (h.perWeek).
// Al cambiar la frecuencia, la anterior se guarda en h.past [{ to: último día, days | perWeek }]
// para que la racha y la constancia de los días pasados se midan con la regla que regía entonces.
import { S, save } from './state.js';
import { DAY_SHORT, addDays, iso, newId, parseDate, shiftDate, today, weekdayOf } from './util.js';
import { plural, tr } from './i18n.js';

export const isWeekly = h => Number.isInteger(h.perWeek);
/** Frecuencia vigente ese día: { days } o { perWeek }. */
export const ruleAt = (h, date) => (h.past || []).find(x => date <= x.to) || h;
export const isDone = (h, date) => (S.hl[date] || {})[h.id] === 1;
const started = (h, date) => !h.createdOn || date >= h.createdOn;
const mondayOf = date => shiftDate(date, -weekdayOf(date));

/** ¿Tiene sentido mostrar el hábito ese día? (los semanales, todos los días). */
export function isDue(h, date) {
  if (!started(h, date)) return false;
  const rule = ruleAt(h, date);
  if (isWeekly(rule)) return true;
  return !Array.isArray(rule.days) || rule.days.includes(weekdayOf(date));
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

/** Meta semanal de la semana que empieza `mon` (null si esa semana el hábito iba por días). */
const weekGoal = (h, mon) => { const rule = ruleAt(h, shiftDate(mon, 6)); return isWeekly(rule) ? rule.perWeek : null; };

/**
 * Racha amable: días programados seguidos (o semanas que cumplieron la meta).
 * Hoy sin marcar no rompe la racha: todavía hay tiempo. Si antes el hábito tenía otro tipo de
 * frecuencia (días ↔ veces por semana), la racha cuenta desde el cambio.
 */
export function streak(h, T = today()) {
  if (isWeekly(ruleAt(h, T))) {
    let n = 0, mon = mondayOf(T);
    if (weekCount(h, mon) >= weekGoal(h, mon)) n++;
    for (let back = 1; back < 60; back++) {
      const m = shiftDate(mon, -7 * back), goal = weekGoal(h, m);
      if ((h.createdOn && shiftDate(m, 6) < h.createdOn) || goal === null) break;
      if (weekCount(h, m) >= goal) n++; else break;
    }
    return { n, unit: plural(n, 'semana', 'semanas', 'week', 'weeks') };
  }
  let n = 0;
  for (let back = 0; back < 400; back++) {
    const date = iso(addDays(parseDate(T), -back));
    if (!started(h, date) || isWeekly(ruleAt(h, date))) break;
    if (!isDue(h, date)) continue;
    if (isDone(h, date)) n++; else if (date !== T) break;
  }
  return { n, unit: plural(n, 'día', 'días', 'day', 'days') };
}

/** Constancia de los últimos 28 días (0-100). Perdona: cuenta lo hecho, no castiga lo que falta. */
export function consistency(h, T = today()) {
  let due = 0, done = 0;
  if (isWeekly(ruleAt(h, T))) {
    for (let w = 0; w < 4; w++) {
      const mon = shiftDate(mondayOf(T), -7 * w), goal = weekGoal(h, mon);
      if ((h.createdOn && shiftDate(mon, 6) < h.createdOn) || goal === null) break;
      const achieved = Math.min(goal, weekCount(h, mon));
      done += achieved;
      // La semana en curso solo suma lo que ya se hizo: todavía hay tiempo.
      due += w === 0 ? achieved : goal;
    }
    if (!due) return null;
    return Math.round(done / due * 100);
  }
  for (let back = 0; back < 28; back++) {
    const date = shiftDate(T, -back);
    if (!started(h, date) || isWeekly(ruleAt(h, date))) break;
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
  if (habit) {
    rememberRule(habit, data);
    Object.assign(habit, data);
  }
  else S.h.push(habit = { id: newId(), createdOn: today(), ...data });
  if (habit.perWeek === undefined) delete habit.perWeek;
  if (habit.days === undefined) delete habit.days;
  save();
  return habit;
}

const sameRule = (a, b) => (isWeekly(a) || isWeekly(b)
  ? a.perWeek === b.perWeek
  : (a.days || [0, 1, 2, 3, 4, 5, 6]).slice().sort().join() === (b.days || [0, 1, 2, 3, 4, 5, 6]).slice().sort().join());
export const MAX_PAST_RULES = 50;
/** Si cambia la frecuencia, guarda la anterior hasta ayer (varios cambios el mismo día cuentan como uno). */
function rememberRule(habit, next) {
  const T = today(), yesterday = shiftDate(T, -1);
  if (sameRule(habit, next) || (habit.createdOn && habit.createdOn >= T)) return;
  const past = habit.past || [];
  if (past.at(-1)?.to === yesterday) return; // ya cambió hoy: la regla que rigió hasta ayer está guardada
  const old = isWeekly(habit) ? { to: yesterday, perWeek: habit.perWeek } : { to: yesterday, ...(Array.isArray(habit.days) ? { days: habit.days.slice() } : {}) };
  habit.past = [...past, old].slice(-MAX_PAST_RULES);
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
