// «Semana»: dirección (intención y foco), reparto en los días y revisión. Incluye la vista «Mes».
import { S, get } from '../state.js';
import { U } from '../ui.js';
import { dayTasks, weekTasks } from '../tasks.js';
import { categoryColor } from '../categories.js';
import { weekQuestions } from '../prefs.js';
import { icon } from '../icons.js';
import { dayMonthShort, monthYear, tr } from '../i18n.js';
import { DAYS, DAY_SHORT, daysInMonth, esc, iso, monday, p2, parseDate, shiftDate, today, weekday } from '../util.js';
import { checkButton, field, foldable, pageHead, sectionHead, segmented, stickyHead } from './common.js';

function overview(week) {
  const T = today();
  return `<div class="week-overview">${DAY_SHORT.map((label, i) => {
    const d = shiftDate(week, i), { focus, rest } = dayTasks(d), all = [...focus, ...rest], left = all.filter(x => !x.row.c).length;
    const events = (S.ev[d] || []).filter(e => e.t?.trim()).length;
    const info = all.length ? (left ? `${left} ${tr('pend.', 'left')}` : tr('✓ listo', '✓ done')) : events ? `${events} ev.` : '';
    return `<button class="wo-day${d === T ? ' today' : ''}${d < T ? ' past' : ''}" data-a="openday" data-k="${d}" aria-label="${tr('Abrir', 'Open')} ${DAYS[i]} ${parseDate(d).getDate()}"><span>${label}</span><b>${parseDate(d).getDate()}</b><small>${info}</small></button>`;
  }).join('')}</div>`;
}

function weekList(week, list, title, hint) {
  const T = today(), items = weekTasks(week, list);
  const rows = items.map(({ i, row, days }) => {
    const toggles = DAY_SHORT.map((label, w) => {
      const d = shiftDate(week, w), on = days.includes(d), what = on ? tr('Quitar de', 'Remove from') : tr('Llevar a', 'Move to');
      return `<button class="day-toggle${on ? ' on' : ''}${d < T ? ' past' : ''}" data-a="weekday" data-list="${list}" data-i="${i}" data-k="${d}" aria-pressed="${on}" aria-label="${what} ${DAYS[w]}" title="${what} ${DAYS[w]}">${label.slice(0, 1)}</button>`;
    }).join('');
    return `<div class="wtask"><div class="task${list === 'a' ? ' focus' : ''}${row.c ? ' done' : ''}">
      ${checkButton(row.c, `data-a="weekdone" data-list="${list}" data-i="${i}"`, tr('Marcar como hecha', 'Mark as done'))}
      <div class="task-main"><textarea data-week-text="${list}.${i}" rows="1" enterkeyhint="done" autocapitalize="none" aria-label="${tr('Tarea de la semana', 'Weekly task')}">${esc(row.t)}</textarea></div>
      <button class="task-btn" data-a="weekmenu" data-list="${list}" data-i="${i}" aria-label="${tr('Más opciones', 'More options')}">${icon('more')}</button>
    </div><div class="day-toggles" aria-label="${tr('Días', 'Days')}">${toggles}</div></div>`;
  }).join('');
  const full = items.length >= 5;
  const placeholder = list === 'a' ? tr('Añadir al foco de la semana', 'Add to this week’s focus') : tr('Añadir otra tarea', 'Add another task');
  return `<section class="section">${sectionHead(title, `<span class="muted small">${items.length}/5</span>`, list === 'a' ? 'gold' : '')}
    <div class="card tasks">${rows || `<p class="empty-note" style="padding:6px 8px">${hint}</p>`}
      ${full ? '' : `<form class="add-row" data-form="addweek" data-list="${list}">${icon('plus')}<input name="task" autocomplete="off" autocapitalize="none" enterkeyhint="done" placeholder="${placeholder}" aria-label="${placeholder}"></form>`}
    </div></section>`;
}

function progress(week) {
  const all = [...weekTasks(week, 'a'), ...weekTasks(week, 'b')], done = all.filter(x => x.row.c).length;
  if (!all.length) return '';
  return `<div class="progress-line" style="margin:14px 4px 0"><div class="bar"><i style="width:${Math.round(done / all.length * 100)}%"></i></div><span class="muted small">${done} ${tr('de', 'of')} ${all.length}</span></div>`;
}

function weekView() {
  const week = U.week, W = `w.${week}.`, thisWeek = iso(monday(new Date())), questions = weekQuestions();
  const monthFocus = Object.values(S.m[week.slice(0, 7)]?.p || {}).filter(x => typeof x === 'string' && x.trim());
  const answered = questions.filter((_, i) => String(get(`${W}r.${i}`)).trim()).length;
  const reviewDay = weekday(new Date()) >= 4 && week === thisWeek;
  const summary = answered ? tr(`${answered} de ${questions.length} respuestas`, `${answered} of ${questions.length} answered`)
    : reviewDay ? tr('Buen momento para mirar tu semana', 'A good moment to look at your week') : tr('Cuatro preguntas para cerrar la semana', 'Four questions to close the week');
  return `${monthFocus.length ? `<p class="muted small" style="margin:14px 4px 0">${tr('Foco del mes', 'Month focus')}: <span style="color:var(--ink)">${monthFocus.map(esc).join(' · ')}</span></p>` : ''}
    <section class="section">${sectionHead(tr('Intención de la semana', 'Intention for the week'))}<div class="card week-intent">${field(W + 'i', tr('¿Qué quieres que defina esta semana?', 'What do you want this week to be about?'))}</div>${progress(week)}</section>
    ${weekList(week, 'a', `${icon('star')}${tr('Foco de la semana', 'Weekly focus')}`, tr('Lo que, si lo logras, hará que la semana valga la pena. Hasta cinco.', 'What would make this week worth it. Up to five.'))}
    ${weekList(week, 'b', tr('También esta semana', 'Also this week'), tr('Pendientes que conviene resolver, sin que sean el centro.', 'Things worth getting done, without being the center.'))}
    <section class="section">${sectionHead(tr('Tu semana día a día', 'Your week, day by day'))}${overview(week)}<p class="muted small" style="margin:8px 4px 0">${tr('Toca las letras bajo cada tarea para llevarla a un día. Toca un día para abrirlo.', 'Tap the letters under each task to move it to a day. Tap a day to open it.')}</p></section>
    <div class="section">${foldable({
      key: 'review', open: U.review, iconName: 'leaf', title: tr('Revisión semanal', 'Weekly review'), summary,
      body: questions.map((q, i) => `<div class="prompt"><label for="rv${i}">${q}</label>${field(`${W}r.${i}`, '', '', ` id="rv${i}"`)}</div>`).join(''),
    })}</div>`;
}

function monthView() {
  const m = U.month, [y, mo] = m.split('-').map(Number), offset = weekday(new Date(y, mo - 1, 1)), n = daysInMonth(m), T = today();
  let grid = DAY_SHORT.map(d => `<span class="wd">${d.slice(0, 1)}</span>`).join('');
  for (let i = 0; i < offset; i++) grid += '<span></span>';
  for (let d = 1; d <= n; d++) {
    const k = `${m}-${p2(d)}`, events = (S.ev[k] || []).filter(e => e.t?.trim());
    const marks = events.slice(0, 3).map(e => `<u style="--c:${categoryColor(e.c ?? -1)}"></u>`).join('');
    grid += `<button class="cal-day${k === U.calDay ? ' on' : ''}${k === T ? ' today' : ''}" data-a="calday" data-k="${k}">${d}<span class="marks">${marks}</span></button>`;
  }
  const sel = U.calDay, sd = parseDate(sel);
  const events = (S.ev[sel] || []).map((e, i) => ({ e, i })).filter(({ e }) => e.t?.trim()).sort((a, b) => (a.e.h || '99').localeCompare(b.e.h || '99'));
  const list = events.map(({ e, i }) => `<button class="event" data-a="eventedit" data-i="${i}" data-k="${sel}" style="--c:${categoryColor(e.c ?? -1)}"><time>${esc(e.h || tr('Todo', 'All day'))}</time><i class="bar"></i><span>${esc(e.t)}</span></button>`).join('');
  const three = key => `<div class="numbered">${[0, 1, 2].map(i => `<div class="line"><span>${i + 1}</span>${field(`m.${m}.${key}.${i}`, i === 0 ? (key === 'p' ? tr('Lo más importante este mes', 'The most important thing this month') : tr('Algo que valió la pena', 'Something that was worth it')) : '')}</div>`).join('')}</div>`;
  return `<div class="week-strip" style="margin-top:14px"><button class="nav" data-a="shiftmonth" data-n="-1" aria-label="${tr('Mes anterior', 'Previous month')}">${icon('left')}</button><div style="flex:1;text-align:center;font:500 20px/1.2 var(--serif);text-transform:capitalize">${monthYear(m)}</div><button class="nav" data-a="shiftmonth" data-n="1" aria-label="${tr('Mes siguiente', 'Next month')}">${icon('right')}</button></div>
    <div class="card"><div class="cal">${grid}</div></div>
    <section class="section">${sectionHead(`${DAYS[weekday(sd)]} ${sd.getDate()}`, `<span class="pill-actions"><button class="pill" data-a="openday" data-k="${sel}">${tr('Abrir día', 'Open day')}${icon('right')}</button><button class="pill" data-a="eventnew" data-k="${sel}">${icon('plus')}${tr('Evento', 'Event')}</button></span>`)}
      ${list ? `<div class="card" style="padding:6px 8px">${list}</div>` : `<p class="empty-note" style="margin-left:4px">${tr('Sin eventos.', 'No events.')}</p>`}</section>
    <section class="section">${sectionHead(tr('Foco del mes', 'Month focus'))}<div class="card">${three('p')}</div></section>
    <section class="section">${sectionHead(tr('Lo mejor del mes', 'Best of the month'))}<div class="card">${three('h')}</div></section>`;
}

export function planView() {
  const isWeek = U.weekMode === 'week', thisWeek = iso(monday(new Date()));
  const subtitle = isWeek
    ? `<span class="range"><button class="mini" data-a="shiftplan" data-n="-1" aria-label="${tr('Semana anterior', 'Previous week')}">${icon('left')}</button>${dayMonthShort(parseDate(U.week))} – ${dayMonthShort(parseDate(shiftDate(U.week, 6)))}<button class="mini" data-a="shiftplan" data-n="1" aria-label="${tr('Semana siguiente', 'Next week')}">${icon('right')}</button>${U.week !== thisWeek ? `<button class="link" data-a="thisweek">${tr('Esta semana', 'This week')}</button>` : ''}</span>`
    : tr('Lo que viene, de un vistazo', 'What’s ahead, at a glance');
  return `<div class="view">${stickyHead(pageHead({ title: isWeek ? tr('Semana', 'Week') : tr('Mes', 'Month'), subtitle }) + segmented('planmode', [['week', tr('Semana', 'Week')], ['month', tr('Mes', 'Month')]], U.weekMode))}
    ${isWeek ? weekView() : monthView()}</div>`;
}
