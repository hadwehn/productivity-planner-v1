// «Semana»: dirección (intención y foco), reparto en los días y revisión. Incluye la vista «Mes».
import { S, get } from '../state.js';
import { U } from '../ui.js';
import { dayTasks, weekTasks } from '../tasks.js';
import { categoryColor } from '../categories.js';
import { WEEK_QUESTIONS } from '../prefs.js';
import { icon } from '../icons.js';
import { DAYS, DAY_SHORT, MONTHS, daysInMonth, esc, iso, monday, monthTitle, p2, parseDate, shiftDate, today, weekday } from '../util.js';
import { checkButton, field, foldable, pageHead, sectionHead, segmented, stickyHead } from './common.js';

const short = d => `${parseDate(d).getDate()} ${MONTHS[parseDate(d).getMonth()].slice(0, 3)}`;

function overview(week) {
  const T = today();
  return `<div class="week-overview">${DAY_SHORT.map((label, i) => {
    const d = shiftDate(week, i), { focus, rest } = dayTasks(d), all = [...focus, ...rest], left = all.filter(x => !x.row.c).length;
    const events = (S.ev[d] || []).filter(e => e.t?.trim()).length;
    const info = all.length ? (left ? `${left} pend.` : '✓ listo') : events ? `${events} ev.` : '';
    return `<button class="wo-day${d === T ? ' today' : ''}${d < T ? ' past' : ''}" data-a="openday" data-k="${d}" aria-label="Abrir ${DAYS[i]} ${parseDate(d).getDate()}"><span>${label}</span><b>${parseDate(d).getDate()}</b><small>${info}</small></button>`;
  }).join('')}</div>`;
}

function weekList(week, list, title, hint) {
  const T = today(), items = weekTasks(week, list);
  const rows = items.map(({ i, row, days }) => {
    const toggles = DAY_SHORT.map((label, w) => {
      const d = shiftDate(week, w), on = days.includes(d);
      return `<button class="day-toggle${on ? ' on' : ''}${d < T ? ' past' : ''}" data-a="weekday" data-list="${list}" data-i="${i}" data-k="${d}" aria-pressed="${on}" aria-label="${on ? 'Quitar de' : 'Llevar a'} ${DAYS[w]}" title="${on ? 'Quitar de' : 'Llevar a'} ${DAYS[w].toLowerCase()}">${label.slice(0, 1)}</button>`;
    }).join('');
    return `<div class="wtask"><div class="task${list === 'a' ? ' focus' : ''}${row.c ? ' done' : ''}">
      ${checkButton(row.c, `data-a="weekdone" data-list="${list}" data-i="${i}"`)}
      <div class="task-main"><textarea data-week-text="${list}.${i}" rows="1" enterkeyhint="done" autocapitalize="none" aria-label="Tarea de la semana">${esc(row.t)}</textarea></div>
      <button class="task-btn" data-a="weekmenu" data-list="${list}" data-i="${i}" aria-label="Más opciones">${icon('more')}</button>
    </div><div class="day-toggles" aria-label="Días">${toggles}</div></div>`;
  }).join('');
  const full = items.length >= 5;
  return `<section class="section">${sectionHead(title, `<span class="muted small">${items.length}/5</span>`, list === 'a' ? 'gold' : '')}
    <div class="card tasks">${rows || `<p class="empty-note" style="padding:6px 8px">${hint}</p>`}
      ${full ? '' : `<form class="add-row" data-form="addweek" data-list="${list}">${icon('plus')}<input name="task" autocomplete="off" autocapitalize="none" enterkeyhint="done" placeholder="${list === 'a' ? 'Añadir al foco de la semana' : 'Añadir otra tarea'}" aria-label="Añadir tarea a la semana"></form>`}
    </div></section>`;
}

function progress(week) {
  const all = [...weekTasks(week, 'a'), ...weekTasks(week, 'b')], done = all.filter(x => x.row.c).length;
  if (!all.length) return '';
  return `<div class="progress-line" style="margin:14px 4px 0"><div class="bar"><i style="width:${Math.round(done / all.length * 100)}%"></i></div><span class="muted small">${done} de ${all.length}</span></div>`;
}

function weekView() {
  const week = U.week, W = `w.${week}.`, thisWeek = iso(monday(new Date()));
  const monthFocus = Object.values(S.m[week.slice(0, 7)]?.p || {}).filter(x => typeof x === 'string' && x.trim());
  const reviewAnswered = WEEK_QUESTIONS.filter((_, i) => String(get(`${W}r.${i}`)).trim()).length;
  const reviewDay = weekday(new Date()) >= 4 && week === thisWeek;
  return `${monthFocus.length ? `<p class="muted small" style="margin:14px 4px 0">Foco del mes: <span style="color:var(--ink)">${monthFocus.map(esc).join(' · ')}</span></p>` : ''}
    <section class="section">${sectionHead('Intención de la semana')}<div class="card week-intent">${field(W + 'i', '¿Qué quieres que defina esta semana?')}</div>${progress(week)}</section>
    ${weekList(week, 'a', `${icon('star')}Foco de la semana`, 'Lo que, si lo logras, hará que la semana valga la pena. Hasta cinco.')}
    ${weekList(week, 'b', 'También esta semana', 'Pendientes que conviene resolver, sin que sean el centro.')}
    <section class="section">${sectionHead('Tu semana día a día')}${overview(week)}<p class="muted small" style="margin:8px 4px 0">Toca las letras bajo cada tarea para llevarla a un día. Toca un día para abrirlo.</p></section>
    <div class="section">${foldable({
      key: 'review', open: U.review, iconName: 'leaf', title: 'Revisión semanal',
      summary: reviewAnswered ? `${reviewAnswered} de ${WEEK_QUESTIONS.length} respuestas` : reviewDay ? 'Buen momento para mirar tu semana' : 'Cuatro preguntas para cerrar la semana',
      body: WEEK_QUESTIONS.map((q, i) => `<div class="prompt"><label for="rv${i}">${q}</label>${field(`${W}r.${i}`, '', '', ` id="rv${i}"`)}</div>`).join(''),
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
  const list = events.map(({ e, i }) => `<button class="event" data-a="eventedit" data-i="${i}" data-k="${sel}" style="--c:${categoryColor(e.c ?? -1)}"><time>${esc(e.h || 'Todo')}</time><i class="bar"></i><span>${esc(e.t)}</span></button>`).join('');
  const three = key => `<div class="numbered">${[0, 1, 2].map(i => `<div class="line"><span>${i + 1}</span>${field(`m.${m}.${key}.${i}`, i === 0 ? (key === 'p' ? 'Lo más importante este mes' : 'Algo que valió la pena') : '')}</div>`).join('')}</div>`;
  return `<div class="week-strip" style="margin-top:14px"><button class="nav" data-a="shiftmonth" data-n="-1" aria-label="Mes anterior">${icon('left')}</button><div style="flex:1;text-align:center;font:500 20px/1.2 var(--serif);text-transform:capitalize">${monthTitle(m)}</div><button class="nav" data-a="shiftmonth" data-n="1" aria-label="Mes siguiente">${icon('right')}</button></div>
    <div class="card"><div class="cal">${grid}</div></div>
    <section class="section">${sectionHead(`${DAYS[weekday(sd)]} ${sd.getDate()}`, `<span style="display:flex;gap:6px"><button class="link" data-a="openday" data-k="${sel}">Abrir día</button><button class="link" data-a="eventnew" data-k="${sel}">${icon('plus')}Evento</button></span>`)}
      ${list ? `<div class="card" style="padding:6px 8px">${list}</div>` : '<p class="empty-note" style="margin-left:4px">Sin eventos.</p>'}</section>
    <section class="section">${sectionHead('Foco del mes')}<div class="card">${three('p')}</div></section>
    <section class="section">${sectionHead('Lo mejor del mes')}<div class="card">${three('h')}</div></section>`;
}

export function planView() {
  const isWeek = U.weekMode === 'week', thisWeek = iso(monday(new Date()));
  const subtitle = isWeek
    ? `<span class="range"><button class="mini" data-a="shiftplan" data-n="-1" aria-label="Semana anterior">${icon('left')}</button>${short(U.week)} – ${short(shiftDate(U.week, 6))}<button class="mini" data-a="shiftplan" data-n="1" aria-label="Semana siguiente">${icon('right')}</button>${U.week !== thisWeek ? '<button class="link" data-a="thisweek">Esta semana</button>' : ''}</span>`
    : 'Lo que viene, de un vistazo';
  return `<div class="view">${stickyHead(pageHead({ title: isWeek ? 'Semana' : 'Mes', subtitle }) + segmented('planmode', [['week', 'Semana'], ['month', 'Mes']], U.weekMode))}
    ${isWeek ? weekView() : monthView()}</div>`;
}
