// Vista Calendario: mes, eventos del día elegido y foco mensual.
import { S } from '../state.js';
import { U } from '../ui.js';
import { categoryColor } from '../categories.js';
import { DAYS, MONTHS, daysInMonth, esc, p2, parseDate, today, weekday } from '../util.js';
import { field, monthNav, pageTitle } from './common.js';

const byTime = (a, b) => (a.h || '99').localeCompare(b.h || '99');
export const eventsOn = date => (S.ev[date] || []).filter(e => e.t?.trim() || e.h);

export function calendarView() {
  const m = U.cm, [y, mo] = m.split('-').map(Number), offset = weekday(new Date(y, mo - 1, 1)), n = daysInMonth(m), T = today();
  let grid = DAYS.map(d => `<div class="sub">${d[0]}</div>`).join('');
  for (let i = 0; i < Math.ceil((offset + n) / 7) * 7; i++) {
    const d = i - offset + 1;
    if (d < 1 || d > n) { grid += '<div></div>'; continue; }
    const k = `${m}-${p2(d)}`, events = eventsOn(k), selected = k === U.cd;
    const dots = events.slice(0, 4).map(e => `<u style="background:${selected ? '#fff' : categoryColor(e.c)}"></u>`).join('');
    grid += `<button class="cd${selected ? ' sel' : ''}${k === T ? ' today' : ''}${events.length ? ' has' : ''}" data-a="cd" data-k="${k}">${d}<span class="dts${events.length >= 4 ? ' four' : ''}">${dots}</span></button>`;
  }
  const t = parseDate(U.cd);
  const list = (S.ev[U.cd] || []).map((x, i) => ({ x, i })).sort((a, b) => byTime(a.x, b.x)).map(({ x, i }) =>
    `<button class="ev" style="--c:${categoryColor(x.c ?? -1)}" data-a="eventedit" data-i="${i}" aria-label="Editar evento ${esc(x.t || 'Sin título')}"><b>${esc(x.h || 'Todo el día')}</b><span>${esc(x.t) || 'Sin título'}</span></button>`).join('');
  const three = k => [0, 1, 2].map(i => `<div class="row"><span class="num">${i + 1}</span>${field(`m.${m}.${k}.${i}`)}</div>`).join('');
  return `<div class="sticky-page-head">${pageTitle('Calendario')}${monthNav('cm', m)}</div>`
    + '<button class="btn add-top" data-a="eva">＋ Nuevo evento</button>'
    + `<div class="card"><div class="cal">${grid}</div></div>`
    + `<div class="card"><h2>${DAYS[weekday(t)]} ${t.getDate()} de ${MONTHS[t.getMonth()]}</h2>${list || '<p class="sub">Día libre. Agrega lo que quieras recordar.</p>'}</div>`
    + `<div class="card"><h2>3 prioridades del mes</h2>${three('p')}</div><div class="card"><h2>3 highlights del mes</h2>${three('h')}</div>`;
}

/** Contexto en el día: intención semanal y eventos del calendario. */
export function eventsCard(date) {
  const events = eventsOn(date).slice().sort(byTime);
  return events.length ? `<div class="card"><h2>En tu calendario</h2>${events.map(e => `<div class="habit-row"><b>${esc(e.h || 'Todo el día')}</b><span>${esc(e.t)}</span></div>`).join('')}</div>` : '';
}
