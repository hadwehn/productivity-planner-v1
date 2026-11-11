// Pruebas de lógica (sin backend). Corren en Node (`npm test`) o en el navegador (tests/run.html).
import { S, checkedState, onSave, setState, summary, setPath } from '../public/js/state.js';
import { migrate } from '../public/js/migrate.js';
import {
  addTask, addWeekTask, bringOverdue, dayTasks, dropTask, moveTask, overdue, removeTask, removeWeekTask, renameTask,
  renameWeekTask, reorderTask, restore, scheduledDays, setDone, setWeekDone, toggleFocus, toggleWeekDay, toggleWeekFocus, weekTasks,
} from '../public/js/tasks.js';
import { consistency, isDue, saveHabit, streak, toggle, weekCount } from '../public/js/habits.js';
import { QUOTES, quoteFor } from '../public/js/quotes.js';
import { U } from '../public/js/ui.js';
import { todayView } from '../public/js/views/today.js';
import { planView } from '../public/js/views/week.js';
import { habitsView } from '../public/js/views/habits.js';
import { journalView } from '../public/js/views/journal.js';
import { shiftDate, today } from '../public/js/util.js';

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
