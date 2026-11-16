// «Semana»: dirección (intención y foco), reparto en los días y revisión. Incluye la vista «Mes».
import { S, get } from '../state.js';
import { U } from '../ui.js';
import { dayTasks, weekTasks } from '../tasks.js';
import { categoryColor } from '../categories.js';
import { weekQuestions } from '../prefs.js';
import { icon } from '../icons.js';
import { dayMonthShort, monthYear, tr } from '../i18n.js';
import { DAYS, DAY_SHORT, daysInMonth, esc, iso, monday, p2, parseDate, shiftDate, shiftMonth, today, weekday } from '../util.js';
import { eventRow, eventsOn } from '../events.js';
import { reviewState, weekClosed } from '../rituals.js';
import { checkButton, field, foldable, sectionHead, segmented, settingsButton, stickyHead } from './common.js';

function overview(week, side = false) {
  const T = today();
  return `<div class="week-overview"${side ? ' aria-hidden="true"' : ''}>${DAY_SHORT.map((label, i) => {
    const d = shiftDate(week, i), { focus, rest } = dayTasks(d), all = [...focus, ...rest], left = all.filter(x => !x.row.c).length;
    const events = eventsOn(d).length;
    const lines = [...eventsOn(d).map(({ e }) => `<li class="ev">${e.h ? `<time>${esc(e.h)}</time> ` : ''}${esc(e.t)}</li>`), ...all.map(x => `<li class="${x.row.c ? 'done' : ''}">${esc(x.row.t)}</li>`)];
    const list = lines.length ? `<ul class="wo-list">${lines.slice(0, 5).join('')}${lines.length > 5 ? `<li class="more">+${lines.length - 5}</li>` : ''}</ul>` : '';
    const info = all.length ? (left ? `${left} ${tr('pend.', 'left')}` : tr('✓ listo', '✓ done')) : events ? `${events} ev.` : '';
    return `<button class="wo-day${d === T ? ' today' : ''}${d < T ? ' past' : ''}" data-a="openday" data-k="${d}" aria-label="${tr('Abrir', 'Open')} ${DAYS[i]} ${parseDate(d).getDate()}"${side ? ' tabindex="-1"' : ''}><span class="wo-date"><span>${label}</span><b>${parseDate(d).getDate()}</b></span><small>${info}</small>${list}</button>`;
  }).join('')}</div>`;
}

function weekList(week, list, title, hint) {
  const T = today(), items = weekTasks(week, list), closed = weekClosed(week);
  // En una semana ya pasada las tareas solo se marcan o se mueven (desde ⋯); no se añaden ni se editan.
  const rows = items.map(({ i, row, days }) => {
    const toggles = DAY_SHORT.map((label, w) => {
      const d = shiftDate(week, w), on = days.includes(d), what = on ? tr('Quitar de', 'Remove from') : tr('Llevar a', 'Move to');
      return closed ? `<span class="day-toggle${on ? ' on' : ''} past" aria-hidden="true">${label.slice(0, 1)}</span>`
        : `<button class="day-toggle${on ? ' on' : ''}${d < T ? ' past' : ''}" data-a="weekday" data-list="${list}" data-i="${i}" data-k="${d}" aria-pressed="${on}" aria-label="${what} ${DAYS[w]}" title="${what} ${DAYS[w]}">${label.slice(0, 1)}</button>`;
    }).join('');
    const text = closed ? `<span>${esc(row.t)}</span>` : `<textarea data-week-text="${list}.${i}" rows="1" enterkeyhint="done" autocapitalize="none" aria-label="${tr('Tarea de la semana', 'Weekly task')}">${esc(row.t)}</textarea>`;
    return `<div class="wtask"><div class="task${list === 'a' ? ' focus' : ''}${row.c ? ' done' : ''}">
      ${checkButton(row.c, `data-a="weekdone" data-list="${list}" data-i="${i}"`, tr('Marcar como hecha', 'Mark as done'))}
      <div class="task-main">${text}</div>
      <button class="task-btn" data-a="weekmenu" data-list="${list}" data-i="${i}" aria-label="${tr('Más opciones', 'More options')}">${icon('more')}</button>
    </div><div class="day-toggles" aria-label="${tr('Días', 'Days')}">${toggles}</div></div>`;
  }).join('');
  const full = items.length >= 5;
  const placeholder = list === 'a' ? tr('Añadir al foco de la semana', 'Add to this week’s focus') : tr('Añadir otra tarea', 'Add another task');
  const empty = closed ? tr('No hubo tareas en esta lista.', 'No tasks in this list.') : hint;
  return `<section class="section">${sectionHead(title, `<span class="muted small">${items.length}/5</span>`, list === 'a' ? 'gold' : '')}
    <div class="card tasks">${rows || `<p class="empty-note" style="padding:6px 8px">${empty}</p>`}
      ${full || closed ? '' : `<form class="add-row" data-form="addweek" data-list="${list}"><button type="submit" class="add-btn" aria-label="${tr('Añadir', 'Add')}" title="${tr('Añadir', 'Add')}">${icon('plus')}</button><input name="task" autocomplete="off" autocapitalize="none" enterkeyhint="done" placeholder="${placeholder}" aria-label="${placeholder}"></form>`}
    </div></section>`;
}

function progress(week) {
  const all = [...weekTasks(week, 'a'), ...weekTasks(week, 'b')], done = all.filter(x => x.row.c).length;
  if (!all.length) return '';
  return `<div class="progress-line" style="margin:14px 4px 0"><div class="bar"><i style="width:${Math.round(done / all.length * 100)}%"></i></div><span class="muted small">${done} ${tr('de', 'of')} ${all.length}</span></div>`;
}

/** Pie de la revisión: desde el domingo se puede dar por terminada; terminada, se puede volver a editar. */
function reviewFoot(state) {
  if (state === 'ready') return `<button class="btn ritual-finish" data-a="reviewdone">${icon('check')}${tr('Terminar la revisión', 'Finish the review')}</button>`;
  if (state === 'done') return `<p class="ritual-note">${icon('check')}${tr('Terminaste la revisión de esta semana.', 'You finished this week’s review.')}<button class="link" data-a="reviewedit">${tr('Editar', 'Edit')}</button></p>`;
  const note = state === 'open' ? tr('Desde el domingo podrás darla por terminada.', 'From Sunday you can mark it as finished.') : tr('Podrás escribirla cuando llegue esa semana.', 'You can write it when that week comes.');
  return `<p class="ritual-note">${icon('calendar')}${note}</p>`;
}

function weekView() {
  const week = U.week, W = `w.${week}.`, thisWeek = iso(monday(new Date())), questions = weekQuestions();
  const monthFocus = Object.values(S.m[week.slice(0, 7)]?.p || {}).filter(x => typeof x === 'string' && x.trim());
  const answered = questions.filter((_, i) => String(get(`${W}r.${i}`)).trim()).length;
  const reviewDay = weekday(new Date()) >= 4 && week === thisWeek;
  const state = reviewState(week), editable = state === 'open' || state === 'ready';
  const summary = state === 'done' ? tr(`Revisión terminada · ${answered} de ${questions.length}`, `Review done · ${answered} of ${questions.length}`)
    : answered ? tr(`${answered} de ${questions.length} respuestas`, `${answered} of ${questions.length} answered`)
      : state === 'future' ? tr('Disponible durante esa semana', 'Available during that week')
        : week < thisWeek ? tr('Sin revisión · puedes completarla', 'No review · you can still fill it in') : reviewDay ? tr('Buen momento para mirar tu semana', 'A good moment to look at your week') : tr('Cuatro preguntas para cerrar la semana', 'Four questions to close the week');
  return `<div class="cols"><div class="col">${monthFocus.length ? `<p class="muted small" style="margin:14px 4px 0">${tr('Foco del mes', 'Month focus')}: <span style="color:var(--ink)">${monthFocus.map(esc).join(' · ')}</span></p>` : ''}
    <section class="section">${sectionHead(tr('Intención de la semana', 'Intention for the week'))}<div class="card week-intent">${field(W + 'i', tr('¿Qué quieres que defina esta semana?', 'What do you want this week to be about?'))}</div>${progress(week)}</section>
    ${weekList(week, 'a', `${icon('star')}${tr('Foco de la semana', 'Weekly focus')}`, tr('Lo que, si lo logras, hará que la semana valga la pena. Hasta cinco.', 'What would make this week worth it. Up to five.'))}
    ${weekList(week, 'b', tr('También esta semana', 'Also this week'), tr('Pendientes que conviene resolver, sin que sean el centro.', 'Things worth getting done, without being the center.'))}
    ${weekClosed(week) ? `<p class="muted small" style="margin:8px 4px 0">${tr('Es una semana pasada: puedes marcar sus tareas o moverlas a esta semana desde ⋯.', 'This week has passed: you can check off its tasks or move them to this week from ⋯.')}</p>` : ''}
    </div><div class="col">
    <section class="section">${sectionHead(tr('Tu semana día a día', 'Your week, day by day'))}<div class="ov-swipe" data-swipe="plan"><div class="strip-track">${[-1, 0, 1].map(o => overview(shiftDate(week, 7 * o), o !== 0)).join('')}</div></div><p class="muted small" style="margin:8px 4px 0">${weekClosed(week) ? tr('Toca un día para abrirlo.', 'Tap a day to open it.') : tr('Toca las letras bajo cada tarea para llevarla a un día. Toca un día para abrirlo.', 'Tap the letters under each task to move it to a day. Tap a day to open it.')}</p></section>
    <div class="section">${foldable({
      key: 'review', open: U.review, iconName: state === 'done' ? 'check' : 'leaf', iconCls: state === 'done' ? 'done' : '', title: tr('Revisión semanal', 'Weekly review'), summary, written: state === 'done',
      body: questions.map((q, i) => {
        if (editable) return `<div class="prompt"><label for="rv${i}">${q}</label>${field(`${W}r.${i}`, '', '', ` id="rv${i}"`)}</div>`;
        const text = String(get(`${W}r.${i}`)).trim();
        return text ? `<div class="prompt"><span class="prompt-label">${q}</span><p class="ritual-read">${esc(text)}</p></div>` : '';
      }).join('') + reviewFoot(state),
    })}</div></div></div>`;
}

/** Cuadrícula de un mes. `side`: mes vecino (solo se ve al deslizar), sin foco de teclado. */
function calGrid(m, T, side) {
  const [y, mo] = m.split('-').map(Number), offset = weekday(new Date(y, mo - 1, 1)), n = daysInMonth(m);
  // En los meses vecinos se marca el día que se abrirá al pasar a ellos (hoy en el mes actual; si no, el 1).
  const selected = side ? (m === T.slice(0, 7) ? T : `${m}-01`) : U.calDay;
  let grid = DAY_SHORT.map(d => `<span class="wd">${d.slice(0, 1)}</span>`).join('');
  for (let i = 0; i < offset; i++) grid += '<span></span>';
  for (let d = 1; d <= n; d++) {
    const k = `${m}-${p2(d)}`, events = eventsOn(k);
    const marks = events.slice(0, 3).map(({ e }) => `<u style="--c:${categoryColor(e.c ?? -1)}"></u>`).join('');
    grid += `<button class="cal-day${k === selected ? ' on' : ''}${k === T ? ' today' : ''}" data-a="calday" data-k="${k}"${side ? ' tabindex="-1"' : ''}>${d}<span class="marks">${marks}</span></button>`;
  }
  return `<div class="cal"${side ? ' aria-hidden="true"' : ''}>${grid}</div>`;
}

function monthView() {
  const m = U.month, T = today();
  const panels = [-1, 0, 1].map(o => calGrid(shiftMonth(m, o), T, o !== 0)).join('');
  const sel = U.calDay, sd = parseDate(sel);
  const list = eventsOn(sel).map(x => eventRow(x, sel)).join('');
  const three = key => `<div class="numbered">${[0, 1, 2].map(i => `<div class="line"><span>${i + 1}</span>${field(`m.${m}.${key}.${i}`, i === 0 ? (key === 'p' ? tr('Lo más importante este mes', 'The most important thing this month') : tr('Algo que valió la pena', 'Something that was worth it')) : '')}</div>`).join('')}</div>`;
  return `<div class="cols"><div class="col">
    <div class="card"><div class="cal-swipe" data-swipe="month" aria-label="${tr('Calendario del mes. Desliza para cambiar de mes.', 'Month calendar. Swipe to change month.')}"><div class="strip-track">${panels}</div></div></div>
    <section class="section">${sectionHead(`${DAYS[weekday(sd)]} ${sd.getDate()}`, `<span class="pill-actions"><button class="pill" data-a="openday" data-k="${sel}">${tr('Abrir día', 'Open day')}${icon('right')}</button><button class="pill" data-a="eventnew" data-k="${sel}">${icon('plus')}${tr('Evento', 'Event')}</button></span>`)}
      ${list ? `<div class="card" style="padding:6px 8px">${list}</div>` : `<p class="empty-note" style="margin-left:4px">${tr('Sin eventos.', 'No events.')}</p>`}</section>
    </div><div class="col">
    <section class="section">${sectionHead(tr('Foco del mes', 'Month focus'))}<div class="card">${three('p')}</div></section>
    <section class="section">${sectionHead(tr('Lo mejor del mes', 'Best of the month'))}<div class="card">${three('h')}</div></section>
    </div></div>`;
}

/** Nombre relativo al presente: «Esta semana», «Semana pasada», «Hace 3 semanas», «Este mes», «Mes pasado»… */
function relativeTitle(n, unit) {
  const T = {
    week: [tr('Esta semana', 'This week'), tr('Semana pasada', 'Last week'), tr('Próxima semana', 'Next week'), k => tr(`Hace ${k} semanas`, `${k} weeks ago`), k => tr(`En ${k} semanas`, `In ${k} weeks`)],
    month: [tr('Este mes', 'This month'), tr('Mes pasado', 'Last month'), tr('Próximo mes', 'Next month'), k => tr(`Hace ${k} meses`, `${k} months ago`), k => tr(`En ${k} meses`, `In ${k} months`)],
  }[unit];
  return n === 0 ? T[0] : n === -1 ? T[1] : n === 1 ? T[2] : n < 0 ? T[3](-n) : T[4](n);
}
const monthIndex = ym => { const [y, m] = ym.split('-').map(Number); return y * 12 + m; };

/** Fila bajo el título: ‹ fechas › y, si no es el presente, el botón para volver (siempre en la misma línea). */
function rangeRow({ action, label, prev, next, n, back, backLabel, side }) {
  const skip = side ? ' tabindex="-1"' : '';
  const arrow = (dir, aria, name) => `<button class="mini" data-a="${action}" data-n="${dir}" aria-label="${aria}" title="${aria}"${skip}>${icon(name)}</button>`;
  const backBtn = n ? `<button class="pill" data-a="${back}"${skip}>${icon(n < 0 ? 'right' : 'left')}${backLabel}</button>` : '';
  return `<div class="plan-range">${arrow(-1, prev, 'left')}<b>${label}</b>${arrow(1, next, 'right')}${backBtn}</div>`;
}

/** Título y fechas de la semana (o el mes) a `o` pasos de la elegida. `o` ≠ 0: panel vecino, solo visible al deslizar. */
function headPanel(isWeek, o) {
  const thisWeek = iso(monday(new Date())), thisMonth = today().slice(0, 7);
  const week = shiftDate(U.week, 7 * o), month = shiftMonth(U.month, o), side = o !== 0;
  const n = isWeek ? Math.round((parseDate(week) - parseDate(thisWeek)) / (7 * 864e5)) : monthIndex(month) - monthIndex(thisMonth);
  const row = isWeek
    ? rangeRow({ action: 'shiftplan', label: `${dayMonthShort(parseDate(week))} – ${dayMonthShort(parseDate(shiftDate(week, 6)))}`, prev: tr('Semana anterior', 'Previous week'), next: tr('Semana siguiente', 'Next week'), n, back: 'thisweek', backLabel: tr('Esta semana', 'This week'), side })
    : rangeRow({ action: 'shiftmonth', label: `<span class="cap">${monthYear(month)}</span>`, prev: tr('Mes anterior', 'Previous month'), next: tr('Mes siguiente', 'Next month'), n, back: 'thismonth', backLabel: tr('Este mes', 'This month'), side });
  return `<div class="plan-head-panel"${side ? ' aria-hidden="true"' : ''}><h1 class="title">${relativeTitle(n, isWeek ? 'week' : 'month')}</h1>${row}</div>`;
}

export function planView() {
  const isWeek = U.weekMode === 'week';
  // Al deslizar la cabecera se ve la semana (o el mes) vecino, como la franja de días en Hoy.
  const head = `<header class="plan-head"><div class="plan-swipe" data-swipe="plan"><div class="strip-track">${[-1, 0, 1].map(o => headPanel(isWeek, o)).join('')}</div></div>${settingsButton()}</header>`;
  return `<div class="view">${stickyHead(head + segmented('planmode', [['week', tr('Semana', 'Week')], ['month', tr('Mes', 'Month')]], U.weekMode))}
    ${isWeek ? weekView() : monthView()}</div>`;
}
