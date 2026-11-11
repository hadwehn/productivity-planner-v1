// Vista Hábitos y la tarjeta de seguimiento del día.
import { S } from '../state.js';
import { U } from '../ui.js';
import { categoryColor, categoryName } from '../categories.js';
import { DAYS, addDays, daysInMonth, esc, iso, p2, parseDate, today, weekdayOf } from '../util.js';
import { monthNav, pageTitle, ring } from './common.js';

export const habitDue = (h, date) => (!h.createdOn || date >= h.createdOn) && (!Array.isArray(h.days) || h.days.includes(weekdayOf(date)));
const doneOn = (date, id) => (S.hl[date] || {})[id] === 1;

function streak(h, T) {
  let n = 0;
  for (let back = 0; back < 370; back++) {
    const date = iso(addDays(parseDate(T), -back));
    if (h.createdOn && date < h.createdOn) break;
    if (!habitDue(h, date)) continue;
    if (doneOn(date, h.id)) n++;
    else if (date !== T) break;
  }
  return n;
}

function habitCard(h, dates, T) {
  let done = 0, scheduled = 0, cells = '';
  for (const date of dates) {
    const v = doneOn(date, h.id);
    if (date <= T && habitDue(h, date)) { scheduled++; if (v) done++; }
    cells += `<i class="${v ? 'c1' : ''}${date === T ? ' t' : ''}"></i>`;
  }
  const s = streak(h, T), pc = scheduled ? Math.round(done / scheduled * 100) : 0, on = doneOn(U.hd, h.id), id = esc(h.id), name = esc(h.name);
  return { done, html: `<div class="card habit-card" data-habit-id="${id}" style="--habit-color:${categoryColor(h.color ?? 0)}" title="${categoryName(h.color ?? 0)}">
    <div class="row"><button type="button" class="drag-handle" data-habit-drag="${id}" aria-label="Mover ${name}. Usa las flechas arriba y abajo, o mantén presionado y arrastra." title="Arrastrar para ordenar · flechas ↑ ↓" aria-keyshortcuts="ArrowUp ArrowDown">⠿</button>
    <button class="hb${on ? ' s1' : ''}" data-a="hab" data-id="${id}" aria-label="Marcar ${name}" aria-pressed="${on}">${on ? '✓' : ''}</button>
    <div class="grow"><b>${name}</b><div class="sub">${done} de ${scheduled} días previstos · ${s} ${s === 1 ? 'día' : 'días'} de racha</div></div>
    ${ring(pc, pc + '%')}<button class="ib" data-a="hen" data-id="${id}" aria-label="Editar ${name}">✎</button></div>
    <div class="grid">${cells}</div></div>` };
}

export function habitsView() {
  const m = U.hm, n = daysInMonth(m), T = today();
  if (U.hd.slice(0, 7) !== m) U.hd = m === T.slice(0, 7) ? T : m + '-01';
  const dates = Array.from({ length: n }, (_, i) => `${m}-${p2(i + 1)}`);
  const strip = dates.map((k, i) => `<button class="chip${k === U.hd ? ' on' : ''}" data-a="hd" data-k="${k}"><span>${DAYS[weekdayOf(k)][0]}</span><b>${i + 1}</b></button>`).join('');
  const cards = S.h.map(h => habitCard(h, dates, T));
  const ok = cards.reduce((sum, c) => sum + c.done, 0);
  const total = S.h.reduce((sum, h) => sum + dates.filter(k => k <= T && habitDue(h, k)).length, 0);
  const pc = total ? Math.round(ok / total * 100) : 0;
  return `<div class="sticky-page-head">${pageTitle('Hábitos', 'Pequeños pasos. Siempre puedes retomar.')}${monthNav('hm', m)}</div>`
    + (S.h.length ? `<div class="card"><div class="row">${ring(pc, pc + '%', true)}<div><b>Tu mes</b><div class="sub">${ok} registros. Los días futuros no cuentan.</div></div></div></div>` : '')
    + '<button class="btn add-top" data-a="hadd">＋ Nuevo hábito</button>'
    + `<div class="strip">${strip}</div>`
    + (cards.map(c => c.html).join('') || '<p class="sub">Aún no tienes hábitos. Crea el primero.</p>')
    + '<p class="habit-tip">Cada marca cuenta. La racha solo considera tus días programados y puedes retomarla cuando quieras.</p>';
}

/** Tarjeta compacta para marcar los hábitos previstos en un día. */
export function dailyHabits(date) {
  const list = S.h.filter(h => habitDue(h, date));
  const rows = list.map(h => {
    const done = doneOn(date, h.id);
    return `<div class="habit-row" style="--habit-color:${categoryColor(h.color ?? 0)}"><button class="chk${done ? ' on' : ''}" data-a="dailyhab" data-id="${esc(h.id)}" aria-label="${esc(h.name)}" aria-pressed="${done}">${done ? '✓' : ''}</button><span>${esc(h.name)}</span></div>`;
  }).join('');
  const empty = `<p class="sub">${S.h.length ? 'Hoy no tienes hábitos previstos.' : 'Empieza con algo pequeño que te haga bien.'}</p>`;
  return `<div class="card"><div class="row spread"><h2 class="flush">Tu seguimiento</h2><button class="link" data-a="go" data-k="h">Ver progreso</button></div>${rows || empty}<button class="task-add" data-a="hadd">＋ Nuevo hábito</button></div>`;
}
