// «Hábitos»: la semana de cada hábito de un vistazo. Marcar cualquier día ya vivido de la semana
// (se olvida marcar; no debería costar la racha). El detalle se abre en una hoja.
import { S } from '../state.js';
import { consistency, frequencyLabel, isDone, isDue, isWeekly, streak, weekCount } from '../habits.js';
import { categoryColor } from '../categories.js';
import { icon } from '../icons.js';
import { tr } from '../i18n.js';
import { DAYS, DAY_SHORT, esc, iso, monday, parseDate, shiftDate, today } from '../util.js';
import { emptyState, pageHead, stickyHead } from './common.js';

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
  // Un toque en el nombre abre el historial. El orden se cambia desde «Reordenar» (ver habitOrderSheet).
  return `<article class="card habit" style="--c:${c}" data-habit="${esc(h.id)}">
    <div class="habit-top">
      <button class="name" data-a="habitopen" data-id="${esc(h.id)}"><strong>${name}</strong><small>${sub}</small></button>
      <button class="task-btn" data-a="habitmenu" data-id="${esc(h.id)}" aria-label="${tr('Opciones de', 'Options for')} ${name}" title="${tr('Editar o eliminar', 'Edit or delete')}">${icon('more')}</button>
    </div>
    <div class="week-dots">${dots}</div>
    <div class="habit-foot">${progress}<span class="habit-streak"><b>${s.n}</b> ${s.unit} ${tr('de racha', 'streak')}</span></div>
  </article>`;
}

/**
 * Franja de la semana (como la de Hoy): bajo cada día, un anillo con la parte de los hábitos de ese
 * día que cumpliste. Los hábitos «N veces por semana» cuentan solo el día en que se marcaron.
 * Tocar un día lo abre en Hoy.
 */
function weekRings(week, T) {
  const days = DAY_SHORT.map((label, i) => {
    const d = shiftDate(week, i), list = S.h.filter(h => (isWeekly(h) ? isDone(h, d) : isDue(h, d)));
    const done = list.filter(h => isDone(h, d)).length, future = d > T;
    const pct = list.length && !future ? Math.round(done / list.length * 100) : 0;
    const what = list.length ? tr(`${done} de ${list.length} hábitos`, `${done} of ${list.length} habits`) : tr('sin hábitos', 'no habits');
    return `<button class="day-pill ring-day${d === T ? ' today' : ''}${future ? ' future' : ''}${list.length && done === list.length && !future ? ' full' : ''}" data-a="openday" data-k="${d}" aria-label="${DAYS[i]} ${parseDate(d).getDate()}: ${what}">
      <span>${label.slice(0, 1)}</span><b style="--p:${pct}"${list.length ? '' : ' class="none"'}>${parseDate(d).getDate()}</b></button>`;
  }).join('');
  return `<div class="days ring-days">${days}</div>`;
}

export function habitsView() {
  const T = today(), week = iso(monday(new Date()));
  const cards = S.h.map(h => habitCard(h, week, T)).join('');
  const dueToday = S.h.filter(h => isDue(h, T)), doneToday = dueToday.filter(h => isDone(h, T)).length;
  const motto = tr('Constancia, no perfección.', 'Consistency, not perfection.');
  // El avance de hoy ya se ve en el anillo del día; la línea bajo el título queda corta, así cabe en una línea.
  const subtitle = S.h.length && dueToday.length ? `${tr('Hoy', 'Today')}: ${doneToday} ${tr('de', 'of')} ${dueToday.length}` : motto;
  // Bajo la cabecera: cuántos hábitos hay y «Reordenar», que abre una lista compacta para cambiar el orden.
  const tools = S.h.length > 1 ? `<div class="habit-tools"><span class="muted small">${S.h.length} ${tr('hábitos', 'habits')}</span><button type="button" class="pill" data-a="habitorder">${icon('bars')}${tr('Reordenar', 'Reorder')}</button></div>` : '';
  return `<div class="view narrow">${stickyHead(pageHead({ title: tr('Hábitos', 'Habits'), subtitle }) + (S.h.length ? weekRings(week, T) : ''))}
    ${tools}${cards ? `<div class="habit-grid">${cards}</div>
    <button class="btn secondary" data-a="habitnew" style="margin-top:16px">${icon('plus')}${tr('Nuevo hábito', 'New habit')}</button>` : emptyState({
      iconName: 'habits', title: tr('Empieza con un hábito', 'Start with one habit'),
      text: tr('Uno solo, tan pequeño que sea difícil no hacerlo: leer una página, caminar 10 minutos, tomar agua al despertar.', 'Just one, so small it’s hard not to do: read one page, walk 10 minutes, drink water when you wake up.'),
      action: `<button class="btn" data-a="habitnew">${icon('plus')}${tr('Crear un hábito', 'Create a habit')}</button>`,
    })}
    ${S.h.length ? `<p class="muted small" style="text-align:center;margin:14px 8px 0">${tr('Si un día no pudiste, no pasa nada: la racha se retoma cuando vuelves. Toca un hábito para ver su historial y ⋯ para editarlo.', 'Missed a day? That’s fine: your streak picks up when you come back. Tap a habit to see its history and ⋯ to edit it.')}</p>` : ''}
  </div>`;
}
