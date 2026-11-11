// Pruebas de lógica (sin backend). Corren en Node (`npm test`) o en el navegador (tests/run.html).
import { S, checkedState, onSave, setState, summary, setPath } from '../public/js/state.js';
import { migrate } from '../public/js/migrate.js';
import {
  addOther, addPriority, carryToTomorrow, detachEditedTask, moveOther, otherCount, planWeeklyTask,
  priorityCount, removeOther, removePriority, restore, syncTask,
} from '../public/js/tasks.js';
import { QUOTES, quoteFor } from '../public/js/quotes.js';
import { U } from '../public/js/ui.js';
import { dayView } from '../public/js/views/day.js';
import { weekView } from '../public/js/views/week.js';
import { calendarView } from '../public/js/views/calendar.js';

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
/** Carga datos como lo hace la app al iniciar sesión. */
function load(data) { setState(checkedState(data)); migrate(); onSave(() => true); }
const task = (date, key) => S.d[date]?.k?.[key];

// ——— Datos y validación ———
test('un respaldo completo conserva todas sus entidades', () => {
  const data = fixture();
  eq(checkedState(data), { ...data, cfg: { ...data.cfg, theme: 'modern', appearance: 'light' } });
  const s = summary(data);
  eq([s.habitos, s.eventos, s.vinculos, s.origenesAusentes], [1, 1, 1, 0]);
});
test('los eventos antiguos en texto se normalizan sin perder el texto', () => {
  const data = fixture();
  data.ev[DAY] = ['Evento antiguo'];
  eq(checkedState(data).ev[DAY], [{ t: 'Evento antiguo', c: 0, h: '' }]);
});
test('se rechazan claves peligrosas, fechas inválidas, índices enormes y horas inyectadas', () => {
  for (const modify of [d => { d.d['2026-02-31'] = {}; }, d => { d.d[DAY].k[999999] = { t: 'x' }; }, d => { d.ev[DAY][0].h = '" onmouseover=alert(1)'; }]) {
    const data = fixture();
    modify(data);
    throws(() => checkedState(data));
  }
  throws(() => checkedState(JSON.parse('{"h":[],"__proto__":{"polluted":true}}')));
  load(fixture());
  throws(() => setPath('__proto__.polluted', 1));
});

// ——— Migraciones ———
test('la gratitud antigua de tres espacios se une en uno solo', () => {
  const data = fixture();
  Object.assign(data.d[DAY], { g: 'Uno', g2: ' Dos ', g3: '' });
  load(data);
  eq(S.d[DAY].g, 'Uno\nDos');
  ok(!('g2' in S.d[DAY]) && !('g3' in S.d[DAY]), 'g2/g3 eliminados');
});
test('las tareas guardadas como lista con huecos pasan a objeto', () => {
  const data = fixture();
  const list = [];
  list[0] = { t: 'Prioridad' };
  list[501] = { t: 'Segunda' };
  data.d[DAY].k = JSON.parse(JSON.stringify(list)); // como quedaba en la nube: con null
  load(data);
  eq(Object.keys(S.d[DAY].k), ['0', '501']);
  eq(priorityCount(DAY), 2);
});
test('el conteo antiguo de secundarias se descarta una sola vez', () => {
  const data = fixture();
  data.d[DAY].otherCount = 7;
  load(data);
  eq(otherCount(DAY), 2, 'tras migrar');
  removeOther(DAY, 2);
  setState(checkedState(S));
  migrate();
  eq(otherCount(DAY), 1, 'la segunda migración respeta el conteo nuevo');
  ok(!('order' in S.cfg), 'sin orden de módulos');
});

// ——— Prioridades (bug: se ocultaban y no dejaban agregar) ———
test('una tercera prioridad guardada nunca queda oculta', () => {
  const data = fixture();
  data.d[DAY].k = { 0: { t: 'A' }, 501: { t: 'B' }, 502: { t: 'C' } };
  data.d[DAY].priorityCount = 2;
  load(data);
  eq(priorityCount(DAY), 3);
});
test('con dos prioridades se puede añadir la tercera, y no una cuarta', () => {
  const data = fixture();
  data.d[DAY].k = { 0: { t: 'A' }, 501: { t: 'B' } };
  data.d[DAY].priorityCount = 3; // antes: se mostraban solo 2 y el botón no hacía nada
  load(data);
  eq(priorityCount(DAY), 3);
  data.d[DAY].priorityCount = 2;
  load(data);
  eq(addPriority(DAY), 502);
  eq(priorityCount(DAY), 3);
  eq(addPriority(DAY), null);
});
test('borrar una prioridad sube las siguientes; con una sola, la vacía', () => {
  const data = fixture();
  data.d[DAY].k = { 0: { t: 'A' }, 501: { t: 'B' }, 502: { t: 'C' } };
  load(data);
  removePriority(DAY, 0);
  eq([task(DAY, 0)?.t, task(DAY, 501)?.t, task(DAY, 502)], ['B', 'C', undefined]);
  eq(priorityCount(DAY), 2);
  removePriority(DAY, 1);
  removePriority(DAY, 0);
  eq([task(DAY, 0), priorityCount(DAY)], [undefined, 1]);
});

// ——— Secundarias ———
test('las dos secundarias por defecto se pueden borrar, incluso vacías', () => {
  load(fixture());
  S.d[DAY].k = {};
  eq(otherCount(DAY), 2);
  removeOther(DAY, 2);
  eq(otherCount(DAY), 1);
  removeOther(DAY, 1);
  eq(otherCount(DAY), 0);
  eq(addOther(DAY), 1);
});
test('borrar una secundaria vacía en medio sube las de abajo', () => {
  load(fixture());
  S.d[DAY].k = { 1: { t: 'A' }, 3: { t: 'C' } };
  S.d[DAY].otherCount = 3;
  removeOther(DAY, 2);
  eq([task(DAY, 1)?.t, task(DAY, 2)?.t, task(DAY, 3)], ['A', 'C', undefined]);
  eq(otherCount(DAY), 2);
});
test('reordenar secundarias mueve la tarea completa', () => {
  load(fixture());
  S.d[DAY].k = { 1: { t: 'A' }, 2: { t: 'B' }, 3: { t: 'C' } };
  moveOther(DAY, 3, 1);
  eq([1, 2, 3].map(k => task(DAY, k).t), ['C', 'A', 'B']);
});

// ——— Pasar al día siguiente ———
test('pasar una prioridad a un día con dos prioridades la deja en la tercera', () => {
  load(fixture());
  S.d[DAY].k = { 0: { t: 'Mover', c: true } };
  S.d[NEXT] = { k: { 0: { t: 'X' }, 501: { t: 'Y' } }, priorityCount: 2 };
  const r = carryToTomorrow(DAY, 0);
  ok(!r.error, r.error);
  eq([task(NEXT, 502)?.t, task(NEXT, 502)?.c, priorityCount(NEXT)], ['Mover', false, 3]);
  eq(task(DAY, 0), undefined);
});
test('si mañana ya tiene tres prioridades, la tarea no se pierde', () => {
  load(fixture());
  S.d[DAY].k = { 0: { t: 'Mover' } };
  S.d[NEXT] = { k: { 0: { t: 'X' }, 501: { t: 'Y' }, 502: { t: 'Z' } } };
  const r = carryToTomorrow(DAY, 0);
  ok(r.error, 'debía avisar');
  eq(task(DAY, 0)?.t, 'Mover');
});
test('pasar una secundaria ocupa la primera fila libre y se puede deshacer', () => {
  load(fixture());
  S.d[DAY].k = { 1: { t: 'A' }, 2: { t: 'B' } };
  const r = carryToTomorrow(DAY, 1);
  eq([task(NEXT, 1)?.t, task(DAY, 1)?.t, task(DAY, 2)], ['A', 'B', undefined]);
  restore(r.undo);
  eq([task(DAY, 1)?.t, task(DAY, 2)?.t, S.d[NEXT]], ['A', 'B', undefined]);
});

// ——— Semana ↔ día ———
test('llevar una tarea semanal al día la vincula una sola vez', () => {
  load(fixture());
  const path = `w.${WEEK}.a.0`;
  eq(planWeeklyTask(path, '2026-10-30', 'other').key, 1);
  eq(task('2026-10-30', 1).source, path);
  ok(planWeeklyTask(path, '2026-10-30', 'other').error, 'duplicado');
  eq(planWeeklyTask(path, '2026-10-31', 'priority').key, 0);
});
test('marcar como hecha se comparte entre semana y días vinculados', () => {
  load(fixture());
  S.d[NEXT] = structuredClone(S.d[DAY]);
  setPath(`d.${DAY}.k.1.c`, true);
  syncTask(`d.${DAY}.k.1.c`, true);
  eq([S.w[WEEK].a[0].c, task(NEXT, 1).c], [true, true]);
});
test('renombrar la tarea del día rompe el vínculo con la semana', () => {
  load(fixture());
  setPath(`d.${DAY}.k.1.t`, 'Estudiar química');
  detachEditedTask(`d.${DAY}.k.1.t`, 'Estudiar', 'Estudiar química');
  eq(task(DAY, 1).source, undefined);
  syncTask(`w.${WEEK}.a.0.c`, true);
  eq(task(DAY, 1).c, false, 'el día ya no sigue a la semana');
});
test('renombrar la tarea de la semana rompe el vínculo de sus copias', () => {
  load(fixture());
  detachEditedTask(`w.${WEEK}.a.0.t`, 'Estudiar', 'Leer');
  eq(task(DAY, 1).source, undefined);
});

// ——— Frases ———
test('cada frase tiene texto y autor, y la del día es estable', () => {
  ok(QUOTES.length >= 30, 'al menos 30 frases');
  ok(QUOTES.every(([q, a]) => q.trim() && a.trim()), 'texto y autor');
  eq(quoteFor(DAY), quoteFor(DAY));
  ok(quoteFor(DAY) !== quoteFor(NEXT), 'días seguidos cambian');
});

// ——— Vistas ———
test('día: hábitos después de las tareas; inicio y cierre plegados', () => {
  load(fixture());
  Object.assign(U, { tab: 'd', dd: DAY, dt: 'p', startOpen: false, endOpen: false, habitsOpen: true });
  S.cfg.hide = {};
  S.cfg.days = {};
  const html = dayView();
  ok(html.indexOf('Durante el día') < html.indexOf('Hábitos del día'), 'orden');
  ok(html.indexOf('Hábitos del día') < html.indexOf('Al terminar el día'), 'cierre al final');
  ok(!html.includes(`d.${DAY}.i"`) && !html.includes(`d.${DAY}.r"`), 'plegados');
  U.startOpen = true;
  const open = dayView();
  ok(open.includes('Agradece a tu manera') && !open.includes(`d.${DAY}.g2`), 'una sola gratitud');
});
test('semana: llevar al día usa la flecha hacia abajo a la derecha', () => {
  load(fixture());
  Object.assign(U, { tab: 'w', wk: WEEK, wt: 'p' });
  ok(weekView().includes('↘') && !weekView().includes('↗'));
});
test('calendario: el texto de los eventos se escapa', () => {
  const data = fixture();
  data.ev[DAY][0] = { t: '<img src=x onerror=alert(1)>', h: '10:15', c: 0 };
  load(data);
  Object.assign(U, { cd: DAY, cm: '2026-10' });
  const html = calendarView();
  ok(html.includes('&lt;img') && !html.includes('<img') && html.includes('10:15'));
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
