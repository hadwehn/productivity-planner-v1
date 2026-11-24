// Pruebas de lógica (sin backend). Corren en Node (`npm test`) o en el navegador (tests/run.html).
import { S, checkedState, onSave, setState, summary, setPath } from '../public/js/state.js';
import { migrate } from '../public/js/migrate.js';
import {
  addTask, addWeekTask, bringOverdue, dayTasks, dropTask, moveTask, overdue, removeTask, removeWeekTask, renameTask, moveWeekTaskToNext, snapshot,
  renameWeekTask, reorderTask, restore, scheduledDays, setDone, setWeekDone, toggleFocus, toggleWeekDay, toggleWeekFocus, weekTasks,
  addUndated, leaveUndated, noDate, removeUndated, scheduleUndated, movePendingTo, archiveOverdue, setWeekGoal, taskToWeek, undatedToWeek, weekForDay,
} from '../public/js/tasks.js';
import { consistency, isDue, saveHabit, streak, toggle, weekCount } from '../public/js/habits.js';
import { QUOTES, quoteFor } from '../public/js/quotes.js';
import { U, tomorrowCard } from '../public/js/ui.js';
import { todayView } from '../public/js/views/today.js';
import { planView } from '../public/js/views/week.js';
import { habitsView } from '../public/js/views/habits.js';
import { journalView } from '../public/js/views/journal.js';
import { shiftDate, today, weekdayOf } from '../public/js/util.js';
import { eventsOn } from '../public/js/events.js';
import { canEditRitual, finishRitual, reopenReview, reopenRitual, reviewState, ritualState } from '../public/js/rituals.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const json = v => JSON.stringify(v);
const eq = (actual, expected, what = '') => { if (json(actual) !== json(expected)) throw Error(`${what} esperado ${json(expected)}, obtenido ${json(actual)}`); };
const ok = (value, what = 'condición falsa') => { if (!value) throw Error(what); };
const throws = (fn, what = 'debía fallar') => { try { fn(); } catch { return; } throw Error(what); };

const DAY = '2026-10-28', NEXT = '2026-10-29', WEEK = '2026-10-26';
const fixture = () => ({
  h: [{ id: 'habit-1', name: 'Caminar', days: [0, 1, 2, 3, 4, 5, 6], createdOn: '2026-10-01' }],
  hl: { [DAY]: { 'habit-1': 1 } },
  m: { '2026-10': { p: ['Una prioridad'], h: ['Un logro'] } },
  ev: { [DAY]: [{ t: 'Clase', h: '10:00', c: 1 }] },
  w: { [WEEK]: { i: 'Mi semana', a: [{ t: 'Estudiar', c: false }], b: [], r: ['Aprendí'] } },
  d: { [DAY]: { i: 'Intención', g: 'Gracias', n: 'Notas', r: 'Reflexión', c: { h6: 'Café' }, k: { 1: { t: 'Estudiar', c: false, s: 2, source: `w.${WEEK}.a.0` } }, otherCount: 2 } },
  cfg: { acc: 2, hide: { d_gr_wk: false }, days: { 6: { d_hab: false } } },
});
function load(data) { setState(checkedState(data)); migrate(); onSave(() => true); }
const texts = date => { const { focus, rest } = dayTasks(date); return { focus: focus.map(x => x.row.t), rest: rest.map(x => x.row.t) }; };
const keyOf = (date, t) => [...dayTasks(date).focus, ...dayTasks(date).rest].find(x => x.row.t === t)?.key;

/**
 * Validador de la versión anterior (v1, en producción en main): mismas reglas de forma.
 * Si v2 guarda algo que v1 no acepta, v1 no podría abrir la cuenta.
 */
function v1Accepts(state) {
  const o = structuredClone(state);
  for (const [, day] of Object.entries(o.d)) {
    for (const [i, t] of Object.entries(day.k || {})) {
      if (!/^\d+$/.test(i) || +i > 502) return 'índice de tarea ' + i;
      if (t && t.source !== undefined && !/^w\.\d{4}-\d{2}-\d{2}\.[ab]\.[0-4]$/.test(t.source)) return 'source ' + t.source;
    }
    if (day.otherCount !== undefined && (day.otherCount < 0 || day.otherCount > 500)) return 'otherCount';
    if (day.priorityCount !== undefined && (day.priorityCount < 1 || day.priorityCount > 3)) return 'priorityCount';
  }
  for (const w of Object.values(o.w)) for (const k of ['a', 'b']) for (const i of Object.keys(w[k] || {})) if (+i > 4) return 'índice semanal';
  for (const h of o.h) if (h.days !== undefined && !Array.isArray(h.days)) return 'días de hábito';
  return true;
}

// ——— Datos y validación ———
test('un respaldo completo conserva todas sus entidades', () => {
  const data = fixture();
  eq(checkedState(data), { ...data, cfg: { ...data.cfg, theme: 'modern', appearance: 'auto' } });
  const s = summary(data);
  eq([s.habitos, s.eventos, s.vinculos, s.origenesAusentes], [1, 1, 1, 0]);
});
test('se rechazan claves peligrosas, fechas inválidas, índices enormes y valores nuevos inválidos', () => {
  for (const modify of [d => { d.d['2026-02-31'] = {}; }, d => { d.d[DAY].k[999999] = { t: 'x' }; }, d => { d.ev[DAY][0].h = '" onmouseover=alert(1)'; },
    d => { d.d[DAY].mood = 9; }, d => { d.h[0].perWeek = 0; }, d => { d.cfg.today = { quote: 'sí' }; }]) {
    const data = fixture();
    modify(data);
    throws(() => checkedState(data));
  }
  throws(() => checkedState(JSON.parse('{"h":[],"__proto__":{"polluted":true}}')));
  load(fixture());
  throws(() => setPath('__proto__.polluted', 1));
});

// ——— Migraciones ———
test('migración: gratitud unida, tareas sin huecos y preferencias de Hoy desde las antiguas', () => {
  const data = fixture();
  Object.assign(data.d[DAY], { g: 'Uno', g2: 'Dos', g3: '', priorityCount: 2 });
  data.cfg.hide.d_gr_wk = true; // en el formato antiguo, hide=true significa oculto
  data.d[DAY].k = { 0: { t: 'A' }, 3: { t: '' }, 7: { t: 'B' }, 502: { t: 'Oculta' } };
  load(data);
  eq(S.d[DAY].g, 'Uno\nDos');
  eq(texts(DAY), { focus: ['A', 'Oculta'], rest: ['B'] });
  eq(Object.keys(S.d[DAY].k), ['0', '1', '501']);
  eq([S.d[DAY].priorityCount, S.d[DAY].otherCount], [2, 1]);
  eq(S.cfg.today.gratitude, false, 'la gratitud estaba oculta de lunes a viernes');
  eq(v1Accepts(S), true);
});

// ——— Tareas del día ———
test('añadir: foco hasta tres, luego al resto', () => {
  load(fixture());
  S.d[DAY].k = {};
  for (const t of ['A', 'B', 'C', 'D']) addTask(DAY, t, { focus: true });
  eq(texts(DAY), { focus: ['A', 'B', 'C'], rest: ['D'] });
  eq(addTask(DAY, '   '), null, 'no agrega vacías');
});
test('poner y quitar del foco respeta el máximo de tres', () => {
  load(fixture());
  S.d[DAY].k = {};
  ['A', 'B', 'C', 'D'].forEach(t => addTask(DAY, t, { focus: true }));
  ok(toggleFocus(DAY, keyOf(DAY, 'D')).error, 'cuarta en foco');
  toggleFocus(DAY, keyOf(DAY, 'B'));
  eq(texts(DAY), { focus: ['A', 'C'], rest: ['B', 'D'] });
  toggleFocus(DAY, keyOf(DAY, 'D'));
  eq(texts(DAY).focus, ['A', 'C', 'D']);
  eq(v1Accepts(S), true);
});
test('eliminar y reordenar mantienen el orden sin huecos', () => {
  load(fixture());
  S.d[DAY].k = {};
  ['A', 'B', 'C'].forEach(t => addTask(DAY, t));
  removeTask(DAY, keyOf(DAY, 'A'));
  eq(texts(DAY).rest, ['B', 'C']);
  reorderTask(DAY, keyOf(DAY, 'C'), keyOf(DAY, 'B'));
  eq(texts(DAY).rest, ['C', 'B']);
  eq(S.d[DAY].otherCount, 2);
});
test('mover a otro día conserva el foco si cabe y se puede deshacer', () => {
  load(fixture());
  S.d[DAY].k = {};
  addTask(DAY, 'Mover', { focus: true });
  setDone(DAY, keyOf(DAY, 'Mover'), false);
  const r = moveTask(DAY, keyOf(DAY, 'Mover'), NEXT);
  eq([texts(DAY).focus, texts(NEXT).focus], [[], ['Mover']]);
  restore(r.undo);
  eq([texts(DAY).focus, S.d[NEXT]], [['Mover'], undefined]);
});
test('pendientes de días anteriores: traer, soltar y traer todo', () => {
  load(fixture());
  const T = today(), y1 = shiftDate(T, -1), y2 = shiftDate(T, -2);
  S.d = {};
  addTask(y2, 'Vieja');
  addTask(y1, 'Ayer');
  addTask(y1, 'Hecha');
  setDone(y1, keyOf(y1, 'Hecha'), true);
  eq(overdue(T).map(x => x.row.t), ['Vieja', 'Ayer']);
  dropTask(y2, keyOf(y2, 'Vieja'));
  eq(overdue(T).map(x => x.row.t), ['Ayer']);
  const r = bringOverdue(T);
  eq([r.count, texts(T).rest, texts(y1).rest], [1, ['Ayer'], ['Hecha']]);
});
test('renombrar una tarea traída de la semana rompe el vínculo', () => {
  load(fixture());
  renameTask(DAY, 1, 'Estudiar química');
  eq(S.d[DAY].k[1].source, undefined);
  setWeekDone(WEEK, 'a', 0, true);
  eq(S.d[DAY].k[1].c, false);
});

// ——— Semana ———
test('semana: máximo cinco por lista, programar en días y marcar hecho sincroniza', () => {
  load(fixture());
  for (const t of ['B', 'C', 'D', 'E']) addWeekTask(WEEK, 'a', t);
  ok(addWeekTask(WEEK, 'a', 'F').error, 'sexta');
  toggleWeekDay(WEEK, 'a', 1, NEXT);
  eq(scheduledDays(`w.${WEEK}.a.1`), [NEXT]);
  eq(texts(NEXT).focus, ['B'], 'el foco semanal entra al foco del día');
  setWeekDone(WEEK, 'a', 1, true);
  eq(S.d[NEXT].k[0].c, true);
  toggleWeekDay(WEEK, 'a', 1, NEXT);
  eq(scheduledDays(`w.${WEEK}.a.1`), []);
  eq(v1Accepts(S), true);
});
test('semana: una tarea programada de lunes a viernes se marca por día y no se duplica al moverla', () => {
  load(fixture());
  const MON = WEEK, days = [0, 1, 2, 3, 4].map(n => shiftDate(MON, n)), [, TUE, WED, , FRI] = days, SAT = shiftDate(MON, 5);
  addWeekTask(WEEK, 'b', 'Gimnasio');
  const i = weekTasks(WEEK, 'b').find(x => x.row.t === 'Gimnasio').i, path = `w.${WEEK}.b.${i}`;
  for (const d of days) toggleWeekDay(WEEK, 'b', i, d);
  const key = d => +Object.entries(S.d[d].k).find(([, r]) => r?.source === path)[0];
  const copies = d => Object.values(S.d[d]?.k || {}).filter(r => r?.source === path || r?.t === 'Gimnasio');
  eq(scheduledDays(path), days, 'cinco días');
  setDone(MON, key(MON), true);
  eq(days.map(d => S.d[d].k[key(d)].c), [true, false, false, false, false], 'marcar el lunes no marca los demás');
  eq(weekTasks(WEEK, 'b').find(x => x.i === i).row.c, false, 'la semanal sigue pendiente');
  eq(weekTasks(WEEK, 'b').find(x => x.i === i).done, [MON], 'el lunes queda hecho');
  // El martes no se hizo y al cerrar el día se pasa lo pendiente a mañana: el miércoles ya la tiene.
  const r = movePendingTo(TUE, WED);
  eq([copies(TUE).length, copies(WED).length], [0, 1], 'no se duplica en el miércoles');
  restore(r.undo);
  // Pasarla a mano al día siguiente, igual.
  eq(moveTask(TUE, key(TUE), WED).merged, true, 'aviso de que ya estaba');
  eq(copies(WED).length, 1);
  // Al sábado (no programado) sí se mueve, con su vínculo; a otra semana pierde el vínculo.
  moveTask(FRI, key(FRI), SAT);
  eq(scheduledDays(path).includes(SAT) && !scheduledDays(path).includes(FRI), true, 'pasa al sábado');
  const NEXT_MON = shiftDate(MON, 7);
  moveTask(SAT, key(SAT), NEXT_MON);
  eq([copies(NEXT_MON).length, Object.values(S.d[NEXT_MON].k)[0].source], [1, undefined], 'en otra semana queda suelta');
  // Traer desde «Pendientes» a un día que ya la tiene: queda una sola.
  const pending = overdue(WED).filter(x => x.row.source === path);
  bringOverdue(WED, pending);
  eq(copies(WED).length, 1, 'traer no duplica');
  // Todas hechas → la semanal queda hecha; marcarla en Plan marca todas.
  // El sábado salió pendiente a la otra semana: aunque se hagan todas las copias que quedan, la
  // semanal no se da por hecha sola (ese trabajo no se hizo en su semana). Marcarla en Plan, sí.
  for (const d of scheduledDays(path)) setDone(d, key(d), true);
  eq(weekTasks(WEEK, 'b').find(x => x.i === i).row.c, false, 'parte salió de la semana: sigue pendiente');
  setWeekDone(WEEK, 'b', i, true);
  eq(weekTasks(WEEK, 'b').find(x => x.i === i).row.c, true, 'marcarla en Plan la da por hecha');
  setWeekDone(WEEK, 'b', i, false);
  eq(scheduledDays(path).map(d => S.d[d].k[key(d)].c).some(Boolean), false, 'desmarcar en Plan desmarca todas');
  toggleWeekDay(WEEK, 'b', i, FRI);
  eq(S.d[FRI].k[key(FRI)].c, false, 'un día nuevo llega pendiente');
  eq(v1Accepts(S), true);
});
test('semana: eliminar o mover entre listas actualiza los vínculos de los días', () => {
  load(fixture());
  addWeekTask(WEEK, 'a', 'B');
  toggleWeekDay(WEEK, 'a', 1, NEXT);
  removeWeekTask(WEEK, 'a', 0); // «Estudiar»: su copia del día queda sin vínculo
  eq(S.d[DAY].k[1].source, undefined);
  eq(weekTasks(WEEK, 'a').map(x => x.row.t), ['B']);
  eq(scheduledDays(`w.${WEEK}.a.0`), [NEXT], 'B pasó al índice 0 con su vínculo');
  toggleWeekFocus(WEEK, 'a', 0);
  eq(weekTasks(WEEK, 'b').map(x => x.row.t), ['B']);
  eq(scheduledDays(`w.${WEEK}.b.0`), [NEXT]);
  renameWeekTask(WEEK, 'b', 0, 'B2');
  eq(scheduledDays(`w.${WEEK}.b.0`), [], 'renombrar rompe el vínculo');
  eq(v1Accepts(S), true);
});

test('semana: pasar a la próxima semana quita las copias pendientes y se puede deshacer', () => {
  load(fixture());
  const NEXT_WEEK = shiftDate(WEEK, 7), FRI = shiftDate(WEEK, 4);
  addWeekTask(WEEK, 'b', 'Llamar al banco');
  addWeekTask(WEEK, 'b', 'Otra');
  toggleWeekDay(WEEK, 'b', 0, NEXT);
  toggleWeekDay(WEEK, 'b', 0, FRI);
  const doneCopy = Object.values(S.d[FRI].k).find(r => r.source === `w.${WEEK}.b.0`);
  doneCopy.c = true; // copia ya hecha ese día: se conserva
  const undo = snapshot(Object.keys(S.d));
  eq(moveWeekTaskToNext(WEEK, 'b', 0).week, NEXT_WEEK);
  eq(weekTasks(WEEK, 'b').map(x => x.row.t), ['Otra']);
  eq(weekTasks(NEXT_WEEK, 'b').map(x => [x.row.t, x.days]), [['Llamar al banco', []]], 'llega sin día asignado');
  eq(Object.values(S.d[NEXT]?.k || {}).some(r => r.t === 'Llamar al banco'), false, 'copia pendiente quitada');
  const kept = Object.values(S.d[FRI].k).find(r => r.t === 'Llamar al banco');
  eq([kept?.c, kept?.source], [true, undefined], 'copia hecha queda sin vínculo');
  eq(scheduledDays(`w.${WEEK}.b.0`), [], '«Otra» no hereda vínculos');
  for (let n = 0; n < 5; n++) addWeekTask(NEXT_WEEK, 'a', `F${n}`);
  addWeekTask(WEEK, 'a', 'Sin espacio');
  const i = weekTasks(WEEK, 'a').find(x => x.row.t === 'Sin espacio').i;
  eq(!!moveWeekTaskToNext(WEEK, 'a', i).error, true, 'la próxima semana llena no la recibe');
  setWeekDone(WEEK, 'b', 0, true); // «Otra», ya hecha, también se puede pasar
  eq(!!moveWeekTaskToNext(WEEK, 'b', 0).error, false);
  const D = weekTasks(shiftDate(WEEK, 7), 'b').find(x => x.row.t === 'Otra');
  eq(D?.row.c, false, 'llega pendiente');
  restore(undo);
  eq(weekTasks(WEEK, 'b').map(x => x.row.t), ['Llamar al banco', 'Otra'], 'deshacer');
  eq(scheduledDays(`w.${WEEK}.b.0`), [NEXT, FRI]);
  eq(v1Accepts(S), true);
});

test('eventos de varios días y rituales terminados: se ven en cada día, se validan y la versión anterior los acepta', () => {
  load(fixture());
  S.ev['2026-11-13'] = [{ t: 'Playa', h: '', c: -1, to: '2026-11-15' }, { t: 'Cena', h: '20:00', c: 1 }];
  eq(eventsOn('2026-11-14').map(x => [x.e.t, x.start, x.i]), [['Playa', '2026-11-13', 0]]);
  eq(eventsOn('2026-11-13').map(x => x.e.t), ['Playa', 'Cena'], 'varios días primero');
  eq(eventsOn('2026-11-16').length, 0);
  S.d[DAY] = { ...(S.d[DAY] || {}), closed: { m: true, e: true } };
  checkedState(JSON.parse(JSON.stringify(S)));
  eq(v1Accepts(S), true);
  for (const bad of [{ to: '2026-11-13' }, { to: '2026-11-12' }, { to: '2028-01-01' }, { to: 'mañana' }]) {
    const copy = JSON.parse(JSON.stringify(S)); Object.assign(copy.ev['2026-11-13'][0], bad);
    let failed = false; try { checkedState(copy); } catch { failed = true; }
    eq(failed, true, `fin inválido ${bad.to}`);
  }
  const copy = JSON.parse(JSON.stringify(S)); copy.d[DAY].closed = { m: 'sí' };
  let failed = false; try { checkedState(copy); } catch { failed = true; }
  eq(failed, true, 'cierre inválido');
  const W = '2026-11-09';
  eq(['2026-11-12T12:00', '2026-11-15T00:00', '2026-11-16T02:59', '2026-11-16T03:00', '2026-11-08T23:00'].map(t => reviewState(W, new Date(t))), ['open', 'ready', 'ready', 'ready', 'future'], 'revisión: se puede terminar desde el domingo, sin límite de hora');
  S.w[W] = { r: { 0: 'Bien' }, closed: true };
  eq(reviewState(W, new Date('2026-11-15T10:00')), 'done');
  eq([reopenReview(W), reviewState(W, new Date('2026-11-20T10:00'))], [true, 'ready'], '«Editar» vuelve a abrir la revisión');
  S.w[W].closed = true;
  eq(v1Accepts(S), true);
  const badW = JSON.parse(JSON.stringify(S)); badW.w[W].closed = 'sí';
  let badFailed = false; try { checkedState(badW); } catch { badFailed = true; }
  eq(badFailed, true, 'cierre de revisión inválido');
  // Rituales: se escriben el mismo día o después, sin límite de hora; un día futuro, todavía no.
  const R = '2026-11-11', at = t => new Date(t);
  delete S.d[R];
  eq(['2026-11-11T08:00', '2026-11-12T04:00', '2026-12-01T10:00', '2026-11-10T23:00'].map(t => ritualState(R, 'e', at(t))), ['open', 'open', 'open', 'future'], 'sin límite de hora');
  S.d[R] = { r: 'Buen día' };
  finishRitual(R, 'e');
  eq([ritualState(R, 'e', at('2026-11-11T22:00')), canEditRitual(R, 'e', at('2026-11-11T22:00')), canEditRitual(R, 'm', at('2026-11-11T22:00'))], ['done', false, true], 'terminado queda para leer');
  eq([reopenRitual(R, 'e'), canEditRitual(R, 'e', at('2026-11-13T09:00')), S.d[R].closed], [true, true, undefined], '«Editar» lo vuelve a abrir');
});

test('sin fecha: dejar una tarea sin fecha, deshacer, llevarla a un día y validar', () => {
  load(fixture());
  const key = addTask(DAY, 'Renovar el pasaporte');
  const r = leaveUndated(DAY, key);
  ok(!r.error, 'sin error');
  eq(noDate().map(x => [x.t, x.from]), [['Renovar el pasaporte', DAY]], 'queda sin fecha con su día de origen');
  ok(!dayTasks(DAY).rest.some(x => x.row.t === 'Renovar el pasaporte'), 'sale del día');
  checkedState(JSON.parse(JSON.stringify(S)));
  restore(r.undo);
  eq(noDate().length, 0, 'deshacer vacía la lista');
  ok(dayTasks(DAY).rest.some(x => x.row.t === 'Renovar el pasaporte'), 'y la devuelve al día');
  addUndated('Llamar al dentista');
  const s2 = scheduleUndated(0, NEXT);
  ok(dayTasks(NEXT).rest.some(x => x.row.t === 'Llamar al dentista') && noDate().length === 0, 'llevar a un día');
  restore(s2.undo);
  eq(noDate().map(x => x.t), ['Llamar al dentista'], 'deshacer la vuelve a dejar sin fecha');
  removeUndated(0);
  eq(S.nd, undefined, 'lista vacía no se guarda');
  for (const bad of [{ nd: 'x' }, { nd: [{ t: 3 }] }, { nd: [{ t: 'a', from: 'ayer' }] }]) {
    let failed = false; try { checkedState({ ...JSON.parse(JSON.stringify(S)), ...bad }); } catch { failed = true; }
    eq(failed, true, 'inválido ' + JSON.stringify(bad));
  }
  eq(v1Accepts(S), true);
});

test('semana: si una copia pendiente sale de su semana, la semanal no se marca hecha sola', () => {
  load(fixture());
  const MON = WEEK, FRI = shiftDate(MON, 4), NEXT_MON = shiftDate(MON, 7);
  addWeekTask(WEEK, 'a', 'Informe');
  const i = weekTasks(WEEK, 'a').find(x => x.row.t === 'Informe').i, path = `w.${WEEK}.a.${i}`;
  toggleWeekDay(WEEK, 'a', i, MON);
  toggleWeekDay(WEEK, 'a', i, FRI);
  const key = d => +Object.entries(S.d[d].k).find(([, r]) => r?.source === path)[0];
  const weekly = () => S.w[WEEK].a[i];
  setDone(MON, key(MON), true);
  // Traer los pendientes al lunes siguiente: el viernes se va y solo queda el lunes, hecho.
  const r = bringOverdue(NEXT_MON, overdue(NEXT_MON).filter(x => x.row.source === path));
  eq([weekly().c, weekly().moved], [false, true], 'traer pendientes a otra semana');
  eq(checkedState(S).w[WEEK].a[i].moved, true, 'se valida');
  restore(r.undo);
  eq([weekly().c, weekly().moved], [false, undefined], 'deshacer');
  // Dejarla sin fecha, igual.
  leaveUndated(FRI, key(FRI));
  eq(weekly().c, false, 'sin fecha: sigue pendiente');
  // Volver a programarla en su semana la deja completarse sola otra vez.
  toggleWeekDay(WEEK, 'a', i, FRI);
  setDone(FRI, key(FRI), true);
  eq([weekly().c, weekly().moved], [true, undefined], 'programada de nuevo y hecha');
  // Pasar una copia dentro de la misma semana no cuenta como salir.
  load(fixture());
  addWeekTask(WEEK, 'b', 'Llamar');
  const j = weekTasks(WEEK, 'b').find(x => x.row.t === 'Llamar').i, p2 = `w.${WEEK}.b.${j}`;
  toggleWeekDay(WEEK, 'b', j, MON);
  moveTask(MON, +Object.entries(S.d[MON].k).find(([, r]) => r?.source === p2)[0], FRI);
  setDone(FRI, +Object.entries(S.d[FRI].k).find(([, r]) => r?.source === p2)[0], true);
  eq(S.w[WEEK].b[j].c, true, 'dentro de la semana se completa sola');
  let bad = structuredClone(S); bad.w[WEEK].b[j].moved = 'sí';
  let failed = false; try { checkedState(bad); } catch { failed = true; }
  eq(failed, true, 'moved inválido se rechaza');
});
test('semana: objetivo (sin días) quita las copias pendientes, se marca a mano y se puede deshacer', () => {
  load(fixture());
  const MON = WEEK, TUE = shiftDate(MON, 1), WED = shiftDate(MON, 2);
  addWeekTask(WEEK, 'a', 'Avanzar tesis');
  const i = weekTasks(WEEK, 'a').find(x => x.row.t === 'Avanzar tesis').i, path = `w.${WEEK}.a.${i}`;
  for (const d of [MON, TUE, WED]) toggleWeekDay(WEEK, 'a', i, d);
  setDone(MON, +Object.entries(S.d[MON].k).find(([, r]) => r?.source === path)[0], true);
  const undo = snapshot(Object.keys(S.d));
  eq(setWeekGoal(WEEK, 'a', i, true).removed, 2, 'quita las dos pendientes');
  eq(scheduledDays(path), [], 'sin días vinculados');
  eq(dayTasks(MON).focus.map(x => [x.row.t, x.row.c, x.row.source]), [['Avanzar tesis', true, undefined]], 'la hecha queda como registro, suelta');
  eq([S.w[WEEK].a[i].goal, S.w[WEEK].a[i].c], [true, false], 'es objetivo y sigue pendiente (no la marca la copia hecha que queda)');
  eq(toggleWeekDay(WEEK, 'a', i, TUE).error !== undefined, true, 'un objetivo no se reparte en días');
  setWeekDone(WEEK, 'a', i, true);
  eq(S.w[WEEK].a[i].c, true, 'se marca a mano');
  eq(checkedState(S).w[WEEK].a[i].goal, true, 'se valida');
  const bad = structuredClone(S); bad.w[WEEK].a[i].goal = 1;
  let failed = false; try { checkedState(bad); } catch { failed = true; }
  eq(failed, true, 'goal inválido se rechaza');
  // Pasar a la próxima semana: sigue siendo objetivo.
  setWeekDone(WEEK, 'a', i, false);
  moveWeekTaskToNext(WEEK, 'a', i);
  const NEXT = shiftDate(WEEK, 7);
  eq(weekTasks(NEXT, 'a').map(x => [x.row.t, x.row.goal]), [['Avanzar tesis', true]]);
  restore(undo);
  eq([scheduledDays(path).length, S.w[WEEK].a[i].goal], [3, undefined], 'deshacer');
  // Volver a repartir en días.
  setWeekGoal(WEEK, 'a', i, true);
  setWeekGoal(WEEK, 'a', i, false);
  eq(toggleWeekDay(WEEK, 'a', i, TUE).added, true, 'se vuelve a llevar a días');
  eq(v1Accepts(S), true);
});
const keyOfText = (d, t) => +Object.entries(S.d[d].k).find(([, r]) => r?.t === t)[0];
test('horizontes: un día → la semana y algún día → esta semana', () => {
  load(fixture());
  const T = today(), thisWeek = weekForDay(T, T), lastWeekDay = shiftDate(thisWeek, -3), nextWeekDay = shiftDate(thisWeek, 9);
  eq([weekForDay(lastWeekDay, T), weekForDay(nextWeekDay, T)], [thisWeek, shiftDate(thisWeek, 7)], 'un día pasado sube a esta semana; uno futuro, a la suya');
  S.d = {}; S.w = {}; delete S.nd;
  // Tarea normal del día: va a «También esta semana»; la del foco, al foco de la semana.
  addTask(T, 'Foco', { focus: true });
  addTask(T, 'Resto');
  const r1 = taskToWeek(T, 1, T);
  eq([r1.list, weekTasks(thisWeek, 'b').map(x => x.row.t), dayTasks(T).rest.length], ['b', ['Resto'], 0]);
  eq(taskToWeek(T, 0, T).list, 'a');
  eq(weekTasks(thisWeek, 'a').map(x => x.row.t), ['Foco']);
  restore(r1.undo);
  eq(dayTasks(T).rest.map(x => x.row.t), ['Resto'], 'deshacer');
  // Lista llena: usa la otra; ambas llenas: avisa.
  S.w = {};
  for (let n = 0; n < 5; n++) addWeekTask(thisWeek, 'b', 'b' + n);
  eq(taskToWeek(T, keyOfText(T, 'Resto'), T).list, 'a', 'si «También» está llena, va al foco');
  for (let n = 1; n < 5; n++) addWeekTask(thisWeek, 'a', 'a' + n);
  addTask(T, 'Otra');
  ok(taskToWeek(T, keyOfText(T, 'Otra'), T).error, 'ambas llenas: error');
  // Copia de una tarea de esa misma semana: solo se quita del día y la semanal queda pendiente.
  S.w = {}; S.d = {};
  addWeekTask(thisWeek, 'b', 'Gimnasio');
  const MON = thisWeek, TUE = shiftDate(MON, 1), path = `w.${thisWeek}.b.0`;
  toggleWeekDay(thisWeek, 'b', 0, MON); toggleWeekDay(thisWeek, 'b', 0, TUE);
  const k = d => +Object.entries(S.d[d].k).find(([, r]) => r?.source === path)[0];
  setDone(MON, k(MON), true);
  const r2 = taskToWeek(TUE, k(TUE), T);
  eq([r2.unscheduled, scheduledDays(path), weekTasks(thisWeek, 'b').length, S.w[thisWeek].b[0].c], [true, [MON], 1, false], 'sin duplicar y sin darla por hecha');
  // Algún día → esta semana.
  S.w = {}; S.nd = [{ t: 'Pintar la reja' }];
  const r3 = undatedToWeek(0, thisWeek);
  eq([r3.list, weekTasks(thisWeek, 'b').map(x => x.row.t), noDate().length], ['b', ['Pintar la reja'], 0]);
  restore(r3.undo);
  eq([noDate().length, weekTasks(thisWeek, 'b').length], [1, 0], 'deshacer');
  eq(v1Accepts(S), true);
});
test('pendientes de más de 21 días pasan solos a «Sin fecha»', () => {
  load(fixture());
  const T = today(), old = shiftDate(T, -22), recent = shiftDate(T, -21);
  S.d = {}; delete S.nd;
  addTask(old, 'Vieja');
  addTask(old, 'Hecha');
  setDone(old, 2, true);
  addTask(old, 'Soltada');
  dropTask(old, 3);
  addTask(recent, 'Reciente');
  eq(archiveOverdue(T), 1, 'solo la pendiente vieja');
  eq(noDate().map(x => [x.t, x.from]), [['Vieja', old]]);
  eq(dayTasks(old).rest.map(x => x.row.t), ['Hecha', 'Soltada'], 'las hechas y soltadas quedan en su día');
  eq(overdue(T).map(x => x.row.t), ['Reciente'], 'la de hace 21 días sigue como aviso');
  eq(archiveOverdue(T), 0, 'no repite');
});
test('días pasados: se pueden añadir, renombrar y borrar tareas', () => {
  load(fixture());
  const past = shiftDate(today(), -10);
  const k = addTask(past, 'Olvidé anotarla');
  setDone(past, k, true);
  renameTask(past, k, 'La anoté después');
  eq(dayTasks(past).rest.map(x => [x.row.t, x.row.c]), [['La anoté después', true]]);
  removeTask(past, k);
  eq(dayTasks(past).rest.length, 0);
});

// ——— Hábitos ———
test('hábitos por días: racha amable (hoy sin marcar no la rompe) y constancia', () => {
  load(fixture());
  const T = today(), h = saveHabit({ name: 'Leer', color: 2, days: [0, 1, 2, 3, 4, 5, 6] });
  h.createdOn = shiftDate(T, -10);
  toggle(h, shiftDate(T, -1));
  toggle(h, shiftDate(T, -2));
  eq(streak(h, T).n, 2);
  toggle(h, T);
  eq(streak(h, T).n, 3);
  ok(consistency(h, T) > 0 && consistency(h, T) <= 100);
});
test('hábitos: cambiar la frecuencia no reescribe la racha ni la constancia pasadas', () => {
  load(fixture());
  const T = today(), h = saveHabit({ name: 'Correr', color: 1, days: [0, 1, 2, 3, 4, 5, 6] });
  h.createdOn = shiftDate(T, -30);
  // Hecho todos los días de los últimos 10 (sin hoy).
  for (let b = 1; b <= 10; b++) toggle(h, shiftDate(T, -b));
  eq(streak(h, T).n, 10);
  // Pasa a un solo día de la semana que no es ninguno de los ya marcados... la historia no cambia.
  const other = (weekdayOf(T) + 1) % 7;
  saveHabit({ id: h.id, name: 'Correr', color: 1, days: [other] });
  eq([h.past.length, h.past[0].to, h.past[0].days.length], [1, shiftDate(T, -1), 7], 'se guarda la frecuencia anterior');
  eq(isDue(h, shiftDate(T, -1)), true, 'ayer regía la frecuencia anterior');
  eq(isDue(h, T), weekdayOf(T) === other, 'hoy rige la nueva');
  eq(streak(h, T).n, 10, 'la racha no se pierde');
  // Varios cambios el mismo día cuentan como uno.
  saveHabit({ id: h.id, name: 'Correr', color: 1, days: [0, other] });
  eq(h.past.length, 1);
  // Cambiar a veces por semana: la racha cuenta desde el cambio.
  saveHabit({ id: h.id, name: 'Correr', color: 1, perWeek: 3 });
  eq([h.past.length, isDue(h, shiftDate(T, -3))], [1, true]);
  eq(checkedState(S).h.find(x => x.id === h.id).past.length, 1, 'se valida');
  const bad = structuredClone(S); bad.h.find(x => x.id === h.id).past = [{ to: 'ayer' }];
  let failed = false; try { checkedState(bad); } catch { failed = true; }
  eq(failed, true, 'frecuencia anterior inválida se rechaza');
  eq(v1Accepts(S), true);
});
test('hábitos semanales: cuentan en cualquier día y la versión anterior los ve como diarios', () => {
  load(fixture());
  const T = today(), h = saveHabit({ name: 'Nadar', color: 0, perWeek: 2 });
  ok(isDue(h, T) && h.days === undefined);
  toggle(h, T);
  eq(weekCount(h, T), 1);
  eq(v1Accepts(S), true);
});

// ——— Frases ———
test('cada frase tiene autor y la del día es estable', () => {
  ok(QUOTES.length >= 30 && QUOTES.every(([q, a]) => q.trim() && a.trim()));
  eq(quoteFor(DAY), quoteFor(DAY));
});

// ——— Vistas ———
test('las cuatro vistas se dibujan con datos y vacías', () => {
  for (const data of [fixture(), { h: [], hl: {}, m: {}, ev: {}, w: {}, d: {}, cfg: { acc: 0, hide: {}, days: {} } }]) {
    load(data);
    Object.assign(U, { date: DAY, week: WEEK, weekMode: 'week', month: '2026-10', calDay: DAY, journalMonth: '2026-10' });
    ok(todayView().includes('Tareas'));
    ok(planView().includes('Foco de la semana'));
    U.weekMode = 'month';
    ok(planView().includes('Foco del mes'));
    ok(habitsView().includes('Hábitos'));
    ok(journalView().includes('Diario'));
  }
});
test('navegación única (días vecinos asomados y flechas fijas) y opción de la tarjeta «organizar mañana»', () => {
  load(fixture());
  Object.assign(U, { date: DAY, week: WEEK, weekMode: 'week', month: '2026-10', calDay: DAY, journalMonth: '2026-10' });
  const html = todayView();
  ok(html.includes('data-a="shiftweek" data-n="-1" tabindex="-1"') && html.includes('data-a="shiftweek" data-n="1" tabindex="-1"'), 'los días vecinos llevan a su semana');
  ok(!html.includes('swipe-hint'), 'sin pista de texto');
  ok(planView().includes('range-nav') && planView().includes('data-swipe="plan"') && journalView().includes('range-nav'), 'flechas y deslizado en Plan y Diario');
  eq(tomorrowCard(), true, 'tarjeta encendida por defecto');
  S.cfg.nav = 'arrows'; // cuentas que probaron el modo «Flechas»
  eq(tomorrowCard(), false, 'venía apagada con «Flechas»');
  checkedState(JSON.parse(JSON.stringify(S)));
  S.cfg.today = { ...(S.cfg.today || {}), tomorrow: true };
  eq(tomorrowCard(), true, 'la opción nueva manda');
  S.cfg.today.tomorrow = false; delete S.cfg.nav;
  eq(tomorrowCard(), false);
  checkedState(JSON.parse(JSON.stringify(S)));
});
test('Hoy: rituales plegados por defecto y texto escapado', () => {
  const data = fixture();
  data.d[DAY].k = { 0: { t: '<img src=x onerror=alert(1)>' } };
  load(data);
  Object.assign(U, { date: DAY, morning: false, evening: false });
  const html = todayView();
  ok(!html.includes('id="f-intent"') && !html.includes('id="f-refl"'), 'plegados');
  ok(html.includes('&lt;img') && !html.includes('<img'), 'escapado');
});

export function run() {
  return tests.map(({ name, fn }) => {
    try { fn(); return { name, ok: true }; } catch (error) { return { name, ok: false, error: error.message }; }
  });
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('unit.mjs')) {
  const results = run();
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ' — ' + r.error}`);
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} pruebas aprobadas`);
  process.exitCode = failed ? 1 : 0;
}
