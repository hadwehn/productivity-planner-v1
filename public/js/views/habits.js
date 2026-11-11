// «Hábitos»: la semana de cada hábito de un vistazo. Marcar cualquier día ya vivido de la semana
// (se olvida marcar; no debería costar la racha). El detalle se abre en una hoja.
import { S } from '../state.js';
import { consistency, frequencyLabel, isDone, isDue, isWeekly, streak, weekCount } from '../habits.js';
import { categoryColor } from '../categories.js';
import { icon } from '../icons.js';
import { tr } from '../i18n.js';
import { DAY_SHORT, esc, iso, monday, shiftDate, today } from '../util.js';
import { pageHead, stickyHead } from './common.js';

function habitCard(h, week, T) {
  const c = categoryColor(h.color ?? 0), s = streak(h, T), pct = consistency(h, T), name = esc(h.name);
  const dots = DAY_SHORT.map((label, i) => {
    const d = shiftDate(week, i), on = isDone(h, d), due = isDue(h, d), future = d > T, isToday = d === T;
    return `<button class="week-dot${on ? ' on' : ''}${due ? ' due' : ''}${isToday ? ' today' : ''}" data-a="habittoggle" data-id="${esc(h.id)}" data-date="${d}" aria-pressed="${on}" aria-label="${name}, ${label}${isToday ? ` (${tr('hoy', 'today')})` : ''}"${future ? ' disabled' : ''}><i>${icon('check')}</i><span>${label.slice(0, 1)}</span>${isToday ? `<em class="today-tag">${tr('hoy', 'today')}</em>` : ''}</button>`;
  }).join('');
  const weekly = isWeekly(h) ? weekCount(h, T) : null;
  const sub = isWeekly(h) ? `${frequencyLabel(h)} · ${weekly} ${tr('de', 'of')} ${h.perWeek} ${tr('esta semana', 'this week')}` : frequencyLabel(h);
  const progress = weekly !== null
    ? `<div class="habit-progress"><i style="width:${Math.min(100, Math.round(weekly / h.perWeek * 100))}%"></i></div>`
    : pct !== null ? `<p class="muted small">${tr('Constancia en 4 semanas', 'Consistency, last 4 weeks')}: <b style="color:var(--ink)">${pct}%</b></p>` : '<span></span>';
  return `<article class="card habit" style="--c:${c}" data-habit="${esc(h.id)}">
    <div class="habit-top">
      <span class="handle" data-habit-drag="${esc(h.id)}" aria-hidden="true">${icon('grip')}</span>
      <button class="name" data-a="habitopen" data-id="${esc(h.id)}"><strong>${name}</strong><small>${sub}</small></button>
      <div class="habit-stat"><b>${s.n}</b><small>${s.unit} ${tr('de racha', 'streak')}</small></div>
    </div>
    <div class="week-dots">${dots}</div>
    <div class="habit-foot">${progress}<button class="task-btn" data-a="habitmenu" data-id="${esc(h.id)}" aria-label="${tr('Opciones de', 'Options for')} ${name}" title="${tr('Editar o eliminar', 'Edit or delete')}">${icon('more')}</button></div>
  </article>`;
}

export function habitsView() {
  const T = today(), week = iso(monday(new Date()));
  const cards = S.h.map(h => habitCard(h, week, T)).join('');
  const dueToday = S.h.filter(h => isDue(h, T)), doneToday = dueToday.filter(h => isDone(h, T)).length;
  const motto = tr('Constancia, no perfección.', 'Consistency, not perfection.');
  const subtitle = S.h.length ? (dueToday.length ? `${tr('Hoy', 'Today')}: ${doneToday} ${tr('de', 'of')} ${dueToday.length}. ${motto}` : tr('Hoy no hay hábitos previstos.', 'No habits planned for today.')) : motto;
  return `<div class="view">${stickyHead(pageHead({ title: tr('Hábitos', 'Habits'), subtitle }))}
    ${cards ? `<div style="display:grid;gap:12px">${cards}</div>` : `<div class="card"><p class="empty-note">${tr('Empieza con uno solo, tan pequeño que sea difícil no hacerlo: leer una página, caminar 10 minutos, tomar agua al despertar.', 'Start with just one, so small it’s hard not to do: read one page, walk 10 minutes, drink water when you wake up.')}</p></div>`}
    <button class="btn secondary" data-a="habitnew" style="margin-top:16px">${icon('plus')}${tr('Nuevo hábito', 'New habit')}</button>
    ${S.h.length ? `<p class="muted small" style="text-align:center;margin:14px 8px 0">${tr('Si un día no pudiste, no pasa nada: la racha se retoma cuando vuelves. Toca un hábito para ver su historial, o ⋯ para editarlo o eliminarlo.', 'Missed a day? That’s fine: your streak picks up when you come back. Tap a habit to see its history, or ⋯ to edit or delete it.')}</p>` : ''}
  </div>`;
}
