// «Hábitos»: la semana de cada hábito de un vistazo. Marcar cualquier día ya vivido de la semana
// (se olvida marcar; no debería costar la racha). El detalle se abre en una hoja.
import { S } from '../state.js';
import { consistency, frequencyLabel, isDone, isDue, isWeekly, streak, weekCount } from '../habits.js';
import { categoryColor } from '../categories.js';
import { icon } from '../icons.js';
import { DAY_SHORT, esc, iso, monday, shiftDate, today } from '../util.js';
import { pageHead } from './common.js';

function habitCard(h, week, T) {
  const c = categoryColor(h.color ?? 0), s = streak(h, T), pct = consistency(h, T);
  const dots = DAY_SHORT.map((label, i) => {
    const d = shiftDate(week, i), on = isDone(h, d), due = isDue(h, d), future = d > T;
    return `<button class="week-dot${on ? ' on' : ''}${due ? ' due' : ''}${d === T ? ' today' : ''}" data-a="habittoggle" data-id="${esc(h.id)}" data-date="${d}" aria-pressed="${on}" aria-label="${esc(h.name)}, ${label}"${future ? ' disabled' : ''}><i>${icon('check')}</i><span>${label.slice(0, 1)}</span></button>`;
  }).join('');
  const weekly = isWeekly(h) ? weekCount(h, T) : null;
  const sub = isWeekly(h) ? `${frequencyLabel(h)} · ${weekly} de ${h.perWeek} esta semana` : frequencyLabel(h);
  return `<article class="card habit" style="--c:${c}" data-habit="${esc(h.id)}">
    <div class="habit-top">
      <span class="handle" data-habit-drag="${esc(h.id)}" aria-hidden="true" style="color:var(--line-strong);touch-action:none;cursor:grab">${icon('grip')}</span>
      <button class="name" data-a="habitopen" data-id="${esc(h.id)}"><strong>${esc(h.name)}</strong><small>${sub}</small></button>
      <div class="habit-stat"><b>${s.n}</b><small>${s.unit} de racha</small></div>
    </div>
    <div class="week-dots">${dots}</div>
    ${weekly !== null ? `<div class="habit-progress"><i style="width:${Math.min(100, Math.round(weekly / h.perWeek * 100))}%"></i></div>`
      : pct !== null ? `<p class="muted small" style="margin:10px 0 0">Constancia en 4 semanas: <b style="color:var(--ink)">${pct}%</b></p>` : ''}
  </article>`;
}

export function habitsView() {
  const T = today(), week = iso(monday(new Date()));
  const cards = S.h.map(h => habitCard(h, week, T)).join('');
  const dueToday = S.h.filter(h => isDue(h, T)), doneToday = dueToday.filter(h => isDone(h, T)).length;
  const subtitle = S.h.length ? (dueToday.length ? `Hoy: ${doneToday} de ${dueToday.length}. Constancia, no perfección.` : 'Hoy no hay hábitos previstos.') : 'Constancia, no perfección.';
  return `<div class="view">${pageHead({ title: 'Hábitos', subtitle })}
    ${cards ? `<div style="display:grid;gap:12px">${cards}</div>` : `<div class="card"><p class="empty-note">Empieza con uno solo, tan pequeño que sea difícil no hacerlo: leer una página, caminar 10 minutos, tomar agua al despertar.</p></div>`}
    <button class="btn secondary" data-a="habitnew" style="margin-top:16px">${icon('plus')}Nuevo hábito</button>
    ${S.h.length ? '<p class="muted small" style="text-align:center;margin:14px 8px 0">Si un día no pudiste, no pasa nada: la racha se retoma cuando vuelves. Toca un hábito para ver su historial.</p>' : ''}
  </div>`;
}
