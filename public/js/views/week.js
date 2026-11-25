// «Semana»: dirección (intención y foco), reparto en los días y revisión. Incluye la vista «Mes».
import { S, get } from '../state.js';
import { U } from '../ui.js';
import { WEEK_MAX, dayTasks, weekTasks } from '../tasks.js';
import { categoryColor } from '../categories.js';
import { weekHabitRate } from '../habits.js';
import { weekQuestions } from '../prefs.js';
import { icon } from '../icons.js';
import { monthYear, tr, weekRange } from '../i18n.js';
import { DAYS, DAY_SHORT, daysInMonth, esc, iso, monday, p2, parseDate, shiftDate, shiftMonth, today, weekday } from '../util.js';
import { eventRow, eventsOn } from '../events.js';
import { intentState, isPastWeek, reviewState } from '../rituals.js';
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
  const T = today(), items = weekTasks(week, list);
  const rows = items.map(({ i, row, days, done }) => {
    // Un objetivo no se reparte en días: en vez de las letras, una marca que lo distingue.
    const goal = `<div class="day-toggles"><span class="goal-tag">${icon('flag')}${tr('Objetivo', 'Goal')}</span></div>`;
    // Cada día programado es independiente: los ya hechos llevan ✓ y al lado se ve el avance («2/5»).
    const toggles = DAY_SHORT.map((label, w) => {
      const d = shiftDate(week, w), on = days.includes(d), ok = done.includes(d), what = on ? tr('Quitar de', 'Remove from') : tr('Llevar a', 'Move to');
      const cls = `day-toggle${on ? ' on' : ''}${ok ? ' ok' : ''}`, face = ok ? icon('check') : label.slice(0, 1);
      // Hecha: las letras quedan solo para ver en qué días se hizo (ya no se lleva a otros días).
      if (row.c) return `<span class="${cls}${d < T ? ' past' : ''} still" aria-label="${DAYS[w]}${ok ? ` (${tr('hecha', 'done')})` : ''}">${face}</span>`;
      return `<button class="${cls}${d < T ? ' past' : ''}" data-a="weekday" data-list="${list}" data-i="${i}" data-k="${d}" aria-pressed="${on}" aria-label="${what} ${DAYS[w]}${ok ? ` (${tr('hecha', 'done')})` : ''}" title="${what} ${DAYS[w]}">${face}</button>`;
    }).join('') + (days.length > 1 ? `<span class="day-count">${done.filter(d => days.includes(d)).length}/${days.length}</span>` : '');
    // Hecha: el nombre queda como registro (se desmarca con el círculo para corregirlo).
    const text = row.c ? `<span>${esc(row.t)}</span>`
      : `<textarea data-week-text="${list}.${i}" rows="1" enterkeyhint="done" autocapitalize="none" aria-label="${tr('Tarea de la semana', 'Weekly task')}">${esc(row.t)}</textarea>`;
    // Al deslizar (celular): pasarla a la próxima semana (o a esta, si es de una pasada) y eliminarla.
    const ids = `data-list="${list}" data-i="${i}" tabindex="-1"`, past = isPastWeek(week);
    const move = row.c ? '' : `<button type="button" class="swipe-move" data-a="${past ? 'weekthis' : 'weeknext'}" ${ids}>${icon('arrowRight')}<span>${past ? tr('Esta semana', 'This week') : tr('Próxima', 'Next week')}</span></button>`;
    const swipe = `<div class="swipe-actions" aria-hidden="true">${move}<button type="button" class="swipe-delete" data-a="weekdelete" ${ids}>${icon('trash')}<span>${tr('Eliminar', 'Delete')}</span></button></div>`;
    return `<div class="wtask"><div class="task${list === 'a' ? ' focus' : ''}${row.c ? ' done' : ''}" data-swipe-row>
      ${checkButton(row.c, `data-a="weekdone" data-list="${list}" data-i="${i}"`, tr('Marcar como hecha', 'Mark as done'))}
      <div class="task-main">${text}</div>
      <button class="task-btn" data-a="weekmenu" data-list="${list}" data-i="${i}" aria-label="${tr('Más opciones', 'More options')}">${icon('more')}</button>
      ${swipe}
    </div>${row.goal ? goal : `<div class="day-toggles" aria-label="${tr('Días', 'Days')}">${toggles}</div>`}</div>`;
  }).join('');
  const full = items.length >= WEEK_MAX[list];
  const placeholder = list === 'a' ? tr('Añadir al foco de la semana', 'Add to this week’s focus') : tr('Añadir otra tarea', 'Add another task');
  const empty = hint;
  return `<section class="section">${sectionHead(title, list === 'a' ? `<span class="muted small">${items.length}/5</span>` : items.length ? `<span class="muted small">${items.length}</span>` : '', list === 'a' ? 'gold' : '')}
    <div class="card tasks">${rows || `<p class="empty-note" style="padding:6px 8px">${empty}</p>`}
      ${full ? (list === 'a' ? `<p class="empty-note" style="padding:8px 8px 4px">${tr('Foco completo. Lo demás va en «También esta semana».', 'Focus is full. Everything else goes in “Also this week”.')}</p>` : '') : `<form class="add-row" data-form="addweek" data-list="${list}"><button type="submit" class="add-btn" aria-label="${tr('Añadir', 'Add')}" title="${tr('Añadir', 'Add')}">${icon('plus')}</button><input name="task" autocomplete="off" autocapitalize="none" enterkeyhint="done" placeholder="${placeholder}" aria-label="${placeholder}"></form>`}
    </div></section>`;
}

function progress(week) {
  const all = [...weekTasks(week, 'a'), ...weekTasks(week, 'b')], done = all.filter(x => x.row.c).length;
  if (!all.length) return '';
  return `<div class="progress-line" style="margin:14px 4px 0"><div class="bar"><i style="width:${Math.round(done / all.length * 100)}%"></i></div><span class="muted small">${done} ${tr('de', 'of')} ${all.length}</span></div>`;
}

/** Pie de la revisión: desde el domingo se puede dar por terminada; terminada, se puede volver a editar. */
const preview = (value, max = 90) => { const t = String(value || '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
// Pies de la intención y la revisión: mismo botón y misma nota que «Empieza/Cierra tu día» en Hoy.
function reviewFoot(state) {
  if (state === 'ready') return `<button class="btn ritual-finish" data-a="reviewdone">${icon('check')}${tr('Cerrar la semana', 'Close the week')}</button>`;
  if (state === 'done') return `<p class="ritual-note">${icon('check')}${tr('Cerraste esta semana.', 'You closed this week.')}<button class="link" data-a="reviewedit">${tr('Editar', 'Edit')}</button></p>`;
  return `<p class="ritual-note">${icon('calendar')}${tr('Podrás escribirla cuando llegue esa semana.', 'You can write it when that week comes.')}</p>`;
}
function intentFoot(week, state, thisWeek) {
  if (state === 'done') return `<p class="ritual-note">${icon('check')}${week < thisWeek ? tr('Definiste la intención de esa semana.', 'You set the intention for that week.') : tr('Empezaste esta semana.', 'You started this week.')}<button class="link" data-a="intentedit">${tr('Editar', 'Edit')}</button></p>`;
  const label = week < thisWeek ? tr('Listo', 'Done') : week > thisWeek ? tr('Listo, dejarla definida', 'Done, set it') : tr('Listo, empezar la semana', 'Done, start the week');
  return `<button class="btn ritual-finish" data-a="intentdone">${icon('check')}${label}</button>`;
}

/**
 * Antes de preguntar, la revisión muestra la semana con lo que ya está registrado: foco cumplido,
 * días cerrados y hábitos. Así la primera pregunta se responde mirando, no recordando.
 */
function weekLook(week) {
  const T = today(), end = shiftDate(week, 6) < T ? shiftDate(week, 6) : T;
  if (end < week) return '';
  const focus = weekTasks(week, 'a'), lived = Math.round((parseDate(end) - parseDate(week)) / 864e5) + 1;
  let closed = 0;
  for (let d = week; d <= end; d = shiftDate(d, 1)) if (S.d[d]?.closed?.e === true) closed++;
  const habits = weekHabitRate(week, T);
  const stat = (value, label) => `<div><b>${value}</b><span>${label}</span></div>`;
  const stats = [
    focus.length ? stat(`${focus.filter(x => x.row.c).length}/${focus.length}`, tr('Foco cumplido', 'Focus done')) : '',
    stat(`${closed}/${lived}`, tr('Días cerrados', 'Days closed')),
    habits === null ? '' : stat(`${habits} %`, tr('Hábitos', 'Habits')),
  ].join('');
  const list = focus.map(({ row }) => `<li class="${row.c ? 'done' : ''}">${row.c ? icon('check') : '<i aria-hidden="true"></i>'}<span>${esc(row.t)}</span></li>`).join('');
  return `<div class="week-look"><div class="look-stats">${stats}</div>${list ? `<ul class="look-focus" aria-label="${tr('Foco de la semana', 'Weekly focus')}">${list}</ul>` : ''}</div>`;
}

/** «Intención de la semana», con el mismo formato que «Empieza tu día». */
function weekIntent(week, thisWeek) {
  const W = `w.${week}.`, text = String(get(W + 'i')).trim(), state = intentState(week), done = state === 'done';
  const body = done
    ? `<div class="prompt"><span class="prompt-label">${tr('¿Qué quieres que defina esta semana?', 'What do you want this week to be about?')}</span><p class="ritual-read serif">${esc(text)}</p></div>`
    : `<div class="prompt"><label for="f-wintent">${tr('¿Qué quieres que defina esta semana?', 'What do you want this week to be about?')}</label>${field(W + 'i', tr('Una palabra o una frase que te guíe…', 'A word or a phrase to guide you…'), '', ' id="f-wintent"')}</div>`;
  const summary = done ? tr('Lista', 'Set') + (text ? ` · “${esc(preview(text, 70))}”` : '')
    : text ? `“${esc(preview(text))}”` : week < thisWeek ? tr('Sin escribir · puedes completarla', 'Not written · you can still fill it in') : tr('Una frase para tu semana · 1 minuto', 'A phrase for your week · 1 minute');
  return foldable({ key: 'weekIntent', open: U.weekIntent, iconName: done ? 'check' : 'sunrise', iconCls: 'evening', title: tr('Intención de la semana', 'Intention for the week'), summary, written: !done && !!text, body: body + intentFoot(week, state, thisWeek) });
}

function weekView() {
  const week = U.week, W = `w.${week}.`, thisWeek = iso(monday(new Date())), questions = weekQuestions(week);
  const monthFocus = Object.values(S.m[week.slice(0, 7)]?.p || {}).filter(x => typeof x === 'string' && x.trim());
  const answered = questions.filter((_, i) => String(get(`${W}r.${i}`)).trim()).length;
  const reviewDay = weekday(new Date()) >= 4 && week === thisWeek;
  const state = reviewState(week), editable = state === 'ready';
  const firstAnswer = questions.map((_, i) => String(get(`${W}r.${i}`)).trim()).find(Boolean);
  const summary = state === 'done' ? tr('Lista', 'Done') + (firstAnswer ? ` · “${esc(preview(firstAnswer, 70))}”` : '')
    : answered ? tr(`${answered} de ${questions.length} respuestas`, `${answered} of ${questions.length} answered`)
      : state === 'future' ? tr('Disponible durante esa semana', 'Available during that week')
        : week < thisWeek ? tr('Sin revisión · puedes completarla', 'No review · you can still fill it in') : reviewDay ? tr('Buen momento para mirar tu semana · 2 minutos', 'A good moment to look at your week · 2 minutes') : tr('Tres preguntas para cerrar la semana · 2 minutos', 'Three questions to close the week · 2 minutes');
  return `<div class="cols"><div class="col">${monthFocus.length ? `<p class="muted small" style="margin:14px 4px 0">${tr('Foco del mes', 'Month focus')}: <span style="color:var(--ink)">${monthFocus.map(esc).join(' · ')}</span></p>` : ''}
    <section class="section">${weekIntent(week, thisWeek)}${progress(week)}</section>
    ${weekList(week, 'a', `${icon('star')}${tr('Foco de la semana', 'Weekly focus')}`, tr('Lo que, si lo logras, hará que la semana valga la pena. Hasta cinco.', 'What would make this week worth it. Up to five.'))}
    ${weekList(week, 'b', tr('También esta semana', 'Also this week'), tr('Pendientes que conviene resolver, sin que sean el centro.', 'Things worth getting done, without being the center.'))}
    </div><div class="col">
    <section class="section">${sectionHead(tr('Tu semana día a día', 'Your week, day by day'))}<div class="ov-swipe" data-swipe="plan"><div class="strip-track">${[-1, 0, 1].map(o => overview(shiftDate(week, 7 * o), o !== 0)).join('')}</div></div><p class="muted small" style="margin:8px 4px 0">${tr('Toca las letras bajo cada tarea para llevarla a un día. Toca un día para abrirlo.', 'Tap the letters under each task to move it to a day. Tap a day to open it.')}</p></section>
    <div class="section" id="week-review">${foldable({
      key: 'review', open: U.review, iconName: state === 'done' ? 'check' : 'moon', iconCls: 'evening', title: tr('Revisión semanal', 'Weekly review'), summary, written: state !== 'done' && answered > 0,
      body: (state === 'future' ? '' : weekLook(week)) + questions.map((q, i) => {
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
    grid += `<button class="cal-day${events.length ? ' has-ev' : ''}${k === selected ? ' on' : ''}${k === T ? ' today' : ''}" data-a="calday" data-k="${k}"${side ? ' tabindex="-1"' : ''}>${d}<span class="marks">${marks}</span></button>`;
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
    <div class="card cal-card"><div class="cal-swipe" data-swipe="month" aria-label="${tr('Calendario del mes. Desliza para cambiar de mes.', 'Month calendar. Swipe to change month.')}"><div class="strip-track">${panels}</div></div></div>
    <section class="section">${sectionHead(`${DAYS[weekday(sd)]} ${sd.getDate()}`, `<span class="pill-actions"><button class="pill" data-a="openday" data-k="${sel}">${tr('Abrir día', 'Open day')}${icon('right')}</button><button class="pill" data-a="eventnew" data-k="${sel}">${icon('plus')}${tr('Evento', 'Event')}</button></span>`)}
      ${list ? `<div class="card" style="padding:6px 8px">${list}</div>` : `<p class="empty-note" style="margin-left:4px">${tr('Sin eventos.', 'No events.')}</p>`}</section>
    </div><div class="col">
    <section class="section">${sectionHead(tr('Foco del mes', 'Month focus'))}<div class="card">${three('p')}</div></section>
    <section class="section" id="month-best">${sectionHead(tr('Lo mejor del mes', 'Best of the month'))}<div class="card">${three('h')}</div></section>
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

/** Fila bajo el título: las fechas y, fijas a la derecha, las flechas para cambiar de semana o de mes. */
function rangeRow({ action, label, prev, next, side, short = false }) {
  const skip = side ? ' tabindex="-1"' : '';
  const arrow = (dir, aria, name) => `<button type="button" data-a="${action}" data-n="${dir}" aria-label="${aria}" title="${aria}"${skip}>${icon(name)}</button>`;
  return `<div class="plan-range${short ? ' short' : ''}"><b>${label}</b><span class="range-nav">${arrow(-1, prev, 'left')}${arrow(1, next, 'right')}</span></div>`;
}

/** Título y fechas de la semana (o el mes) a `o` pasos de la elegida. `o` ≠ 0: panel vecino, solo visible al deslizar. */
function headPanel(isWeek, o) {
  const thisWeek = iso(monday(new Date())), thisMonth = today().slice(0, 7);
  const week = shiftDate(U.week, 7 * o), month = shiftMonth(U.month, o), side = o !== 0;
  const n = isWeek ? Math.round((parseDate(week) - parseDate(thisWeek)) / (7 * 864e5)) : monthIndex(month) - monthIndex(thisMonth);
  const row = isWeek
    ? rangeRow({ action: 'shiftplan', label: weekRange(parseDate(week), parseDate(shiftDate(week, 6))), prev: tr('Semana anterior', 'Previous week'), next: tr('Semana siguiente', 'Next week'), side })
    : rangeRow({ action: 'shiftmonth', label: `<span class="cap">${monthYear(month)}</span>`, prev: tr('Mes anterior', 'Previous month'), next: tr('Mes siguiente', 'Next month'), side, short: true });
  return `<div class="plan-head-panel"${side ? ' aria-hidden="true"' : ''}><h1 class="title">${relativeTitle(n, isWeek ? 'week' : 'month')}</h1>${row}</div>`;
}

export function planView() {
  const isWeek = U.weekMode === 'week';
  // Al deslizar la cabecera se ve la semana (o el mes) vecino, como la franja de días en Hoy.
  const head = `<header class="plan-head"><div class="plan-swipe" data-swipe="plan"><div class="strip-track">${[-1, 0, 1].map(o => headPanel(isWeek, o)).join('')}</div></div>${settingsButton()}</header>`;
  // «Volver a esta semana / este mes» es el botón flotante de abajo (render.js), igual en todas las pantallas.
  const controls = `<div class="plan-controls">${segmented('planmode', [['week', tr('Semana', 'Week')], ['month', tr('Mes', 'Month')]], U.weekMode)}</div>`;
  return `<div class="view">${stickyHead(head + controls)}
    ${isWeek ? weekView() : monthView()}</div>`;
}
