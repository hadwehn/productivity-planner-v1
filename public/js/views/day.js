// Vista Día: al partir el día → durante el día → hábitos → al terminar el día.
import { S, get } from '../state.js';
import { U } from '../ui.js';
import { dayVisible } from '../prefs.js';
import { PRIORITY_KEYS, isPriority, otherCount, priorityCount } from '../tasks.js';
import { quoteFor } from '../quotes.js';
import { DAYS, MONTHS, esc, iso, monday, parseDate, range, today, weekday } from '../util.js';
import { check, emptyState, field, pagerHeader, segmented } from './common.js';
import { dailyHabits } from './habits.js';
import { eventsCard } from './calendar.js';
import { notesEditor } from './notes.js';

const CARRY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 18v-2.7c0-4.7 3.8-8.5 8.5-8.5H19"/><path d="m14.4 2.8 4.6 4.6-4.6 4.6"/></svg>';
const HOURS = Array.from({ length: 34 }, (_, i) => ({ key: 'h' + (6 + (i >> 1)) + (i % 2 ? 'b' : ''), label: (6 + (i >> 1)) + ':' + (i % 2 ? '30' : '00') }));

const phase = (key, title, open, content) =>
  `<section class="day-phase"><button class="phase-toggle" data-a="phase" data-k="${key}" aria-expanded="${open}"><span>${title}</span><span aria-hidden="true">${open ? '−' : '+'}</span></button>${open ? content : ''}</section>`;

function taskRow(date, key, priorities) {
  const P = `d.${date}.k.${key}.`, row = S.d[date]?.k?.[key] || {}, priority = isPriority(key);
  const filled = !!String(row.t ?? '').trim(), sessions = row.s || 0;
  // Con una sola prioridad vacía no hay nada que borrar.
  const removable = !priority || priorities > 1 || filled;
  const handle = priority ? '' : `<button type="button" class="drag-handle" data-drag-index="${key}" aria-label="Mover tarea. Mantén presionado y arrastra, o usa las flechas arriba y abajo." title="Arrastrar para ordenar" aria-keyshortcuts="ArrowUp ArrowDown">⠿</button>`;
  const dots = range(0, 4).map(j => `<button class="dot${j < sessions ? ' on' : ''}" data-a="dot" data-p="${P}s" data-j="${j}" aria-pressed="${j < sessions}" aria-label="Registrar ${j + 1} sesiones de 30 minutos"></button>`).join('');
  return `<div class="task-line${row.c ? ' done' : ''}"${priority ? '' : ` data-task-index="${key}"`}>
    <div class="row">${handle}${check(P + 'c')}${field(P + 't', priority ? '¿Qué merece tu atención hoy?' : 'Tarea secundaria')}
      <div class="task-actions">
        <button class="tiny-action remove-action" data-a="taskremove" data-k="${key}" title="Eliminar tarea" aria-label="Eliminar tarea"${removable ? '' : ' hidden'}>×</button>
        <button class="tiny-action carry-action" data-a="carrytask" data-k="${key}" title="Pasar al día siguiente" aria-label="Pasar tarea al día siguiente"${filled ? '' : ' hidden'}>${CARRY_ICON}</button>
      </div></div>
    <details class="effort"><summary>${sessions ? sessions + ' sesiones registradas' : 'Registrar sesiones de enfoque'}</summary><div class="dots">${dots}<span class="sub">× 30 min</span></div></details>
  </div>`;
}

function prioritiesCard(date) {
  const count = priorityCount(date);
  return `<div class="card hi"><h2>★ ${count === 1 ? 'Tarea más importante' : 'Tareas más importantes'}</h2>`
    + PRIORITY_KEYS.slice(0, count).map(k => taskRow(date, k, count)).join('')
    + (count < 3 ? '<button class="task-add" data-a="priorityadd">＋ Añadir prioridad</button>' : '')
    + '</div>';
}

function othersCard(date) {
  const count = otherCount(date);
  return `<div class="card"><h2>Tareas secundarias</h2>${range(1, count).map(k => taskRow(date, k)).join('')}<button class="task-add" data-a="taskadd">＋ Añadir tarea</button></div>`;
}

function reflectionCard(date) {
  const Z = `d.${date}.`;
  const legacy = [['hl', 'Momento que guardaste'], ['learn', 'Lo que aprendiste'], ['remember', 'Lo que quisiste recordar']].filter(([k]) => String(get(Z + k)).trim());
  return `<div class="card"><label class="q" for="daily-reflection">¿Qué te dejó este día?</label>
    <p class="sub">Una idea que aprendiste, algo que sentiste o un momento que quieras conservar.</p>
    ${field(Z + 'r', 'Escribe lo que quieras llevar contigo…', 3, 'daily-reflection')}
    ${legacy.length ? `<details class="legacy"><summary>Tus respuestas anteriores (${legacy.length})</summary>${legacy.map(([k, label]) => `<label class="q">${label}</label>${field(Z + k, label, 2)}`).join('')}</details>` : ''}</div>`;
}

function context(date) {
  const intention = S.w[iso(monday(parseDate(date)))]?.i;
  return (intention ? `<div class="context"><b>Esta semana:</b> ${esc(intention)}</div>` : '') + eventsCard(date);
}

export function dayView() {
  const date = U.dd, d = parseDate(date), w = weekday(d), Z = `d.${date}.`;
  const head = `<div class="sticky-page-head page-offset">${pagerHeader({
    nav: 'data-a="dd"', title: DAYS[w], subtitle: `${d.getDate()} de ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    prev: 'Día anterior', next: 'Día siguiente', reset: date !== today() ? 'data-a="today"' : '', resetLabel: 'Hoy',
  })}${segmented('dt', [['p', 'Planificación'], ['n', 'Notas']], U.dt === 'n' ? 'n' : 'p')}</div>`;
  if (U.dt === 'n') return head + notesEditor(date);

  const show = k => dayVisible(k, w);
  const [quote, author] = quoteFor(date);
  const morning = [
    show('d_int') && `<div class="card intent"><h2>Intención del día</h2>${field(Z + 'i', '¿Cómo quieres vivir este día?', 2)}</div>`,
    show('d_gr') && `<div class="card"><h2>Gratitud</h2>${field(Z + 'g', 'Agradece a tu manera…', 2)}</div>`,
  ].filter(Boolean).join('');
  const work = [
    show('d_star') && prioritiesCard(date),
    show('d_oth') && othersCard(date),
    show('d_pl') && `<div class="card"><label class="q">Planes del día</label>${field(Z + 'p', 'Planes, actividades, compromisos…', 6)}</div>`,
    show('d_co') && `<div class="card"><button class="sh" data-a="agenda" aria-expanded="${U.agendaOpen}">Agenda por horas (opcional)<span aria-hidden="true">${U.agendaOpen ? '−' : '+'}</span></button>`
      + (U.agendaOpen ? HOURS.map(h => `<div class="row"><span class="sub hr">${h.label}</span>${field(Z + 'c.' + h.key)}</div>`).join('') : '') + '</div>',
  ].filter(Boolean).join('');

  const body = (morning ? phase('start', 'Al partir el día', U.startOpen, morning) : '')
    + (work ? `<section class="day-work"><h2 class="section-title">Durante el día</h2>${work}</section>` : '')
    + (show('d_hab') ? phase('habits', 'Hábitos del día', U.habitsOpen, dailyHabits(date)) : '')
    + (show('d_rf') ? phase('end', 'Al terminar el día', U.endOpen, reflectionCard(date)) : '');

  return head + `<blockquote class="quote">“${quote}”<footer>— ${author}</footer></blockquote>` + context(date) + (body || emptyState());
}
