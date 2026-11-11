// «Hoy»: lo que importa del día en una sola pantalla.
// Orden pensado para el uso real: empezar (intención, gratitud) → tareas → agenda → hábitos → cerrar (ánimo, reflexión) → notas.
import { S, get } from '../state.js';
import { U, showToday } from '../ui.js';
import { dayTasks, overdue } from '../tasks.js';
import { isDue, isDone, isWeekly, weekCount } from '../habits.js';
import { categoryColor, MOODS, moodColor } from '../categories.js';
import { quoteFor } from '../quotes.js';
import { icon } from '../icons.js';
import { DAYS, MONTHS, DAY_SHORT, esc, iso, monday, parseDate, shiftDate, today } from '../util.js';
import { checkButton, field, foldable, pageHead, sectionHead, stickyHead } from './common.js';
import { notesEditor } from './notes.js';

const greeting = () => { const h = new Date().getHours(); return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'; };
const preview = (value, max = 70) => { const t = String(value || '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };

function weekStrip(date) {
  const mon = iso(monday(parseDate(date))), T = today();
  const days = DAY_SHORT.map((label, i) => {
    const d = shiftDate(mon, i), { focus, rest } = dayTasks(d), all = [...focus, ...rest];
    const mark = all.length ? `<i class="${all.every(x => x.row.c) ? 'full' : ''}"></i>` : '';
    return `<button class="day-pill${d === date ? ' on' : ''}${d === T ? ' today' : ''}" data-a="date" data-k="${d}" aria-label="${DAYS[i]} ${parseDate(d).getDate()}" aria-current="${d === date ? 'date' : 'false'}"><span>${label.slice(0, 1)}</span><b>${parseDate(d).getDate()}</b>${mark}</button>`;
  }).join('');
  return `<div class="week-strip"><button class="nav" data-a="shiftweek" data-n="-1" aria-label="Semana anterior">${icon('left')}</button><div class="days">${days}</div><button class="nav" data-a="shiftweek" data-n="1" aria-label="Semana siguiente">${icon('right')}</button></div>`;
}

function taskItem(date, { key, row }, focus) {
  const linked = row.source ? `<span class="task-meta">De tu semana</span>` : '';
  return `<div class="task${focus ? ' focus' : ''}${row.c ? ' done' : ''}" data-task="${key}">
    ${focus ? '' : `<span class="handle" data-drag="${key}" aria-hidden="true">${icon('grip')}</span>`}
    ${checkButton(row.c, `data-a="taskdone" data-k="${key}"`)}
    <div class="task-main"><textarea data-task-text="${key}" rows="1" enterkeyhint="done" aria-label="Tarea">${esc(row.t)}</textarea>${linked}</div>
    <button class="task-btn star${focus ? ' on' : ''}" data-a="taskfocus" data-k="${key}" aria-pressed="${focus}" aria-label="${focus ? 'Quitar del foco' : 'Poner en foco'}" title="${focus ? 'Quitar del foco' : 'Poner en foco'}">${icon('star')}</button>
    <button class="task-btn" data-a="taskmenu" data-k="${key}" aria-label="Más opciones" title="Más opciones">${icon('more')}</button>
  </div>`;
}

function tasksSection(date) {
  const { focus, rest } = dayTasks(date), T = today();
  const late = date === T ? overdue(T) : [];
  const banner = late.length ? `<div class="banner">${icon('inbox')}<p>${late.length === 1 ? 'Quedó 1 tarea pendiente' : `Quedaron ${late.length} tareas pendientes`} de días anteriores.</p><button class="btn small" data-a="overdue">Revisar</button></div>` : '';
  const doneCount = [...focus, ...rest].filter(x => x.row.c).length, total = focus.length + rest.length;
  const focusBlock = `<div class="group-label"><span class="label gold">${icon('star')}En foco</span><span class="muted small">${focus.length}/3</span></div>`
    + (focus.length ? focus.map(t => taskItem(date, t, true)).join('') : '<p class="empty-note" style="padding:0 8px 6px">Marca con ★ hasta tres tareas que harían de este un buen día.</p>');
  const restBlock = rest.length ? `<div class="divider"></div>${rest.map(t => taskItem(date, t, false)).join('')}` : '';
  return `<section class="section">${banner}${sectionHead('Tareas', total ? `<span class="muted small">${doneCount} de ${total}</span>` : '')}
    <div class="card tasks">${focusBlock}${restBlock}
      <form class="add-row" data-form="addtask">${icon('plus')}<input name="task" autocomplete="off" enterkeyhint="done" placeholder="Añadir tarea" aria-label="Añadir tarea"></form>
    </div></section>`;
}

function agendaSection(date) {
  const events = (S.ev[date] || []).map((e, i) => ({ e, i })).filter(({ e }) => e.t?.trim()).sort((a, b) => (a.e.h || '99').localeCompare(b.e.h || '99'));
  const add = `<button class="link" data-a="eventnew">${icon('plus')}Evento</button>`;
  if (!events.length) return `<section class="section">${sectionHead('Agenda', add)}</section>`;
  return `<section class="section">${sectionHead('Agenda', add)}<div class="card" style="padding:6px 8px">${events.map(({ e, i }) =>
    `<button class="event" data-a="eventedit" data-i="${i}" style="--c:${categoryColor(e.c ?? -1)}"><time>${esc(e.h || 'Todo')}</time><i class="bar"></i><span>${esc(e.t)}</span></button>`).join('')}</div></section>`;
}

function habitsSection(date) {
  const list = S.h.filter(h => isDue(h, date));
  const manage = `<button class="link" data-a="go" data-k="habits">Ver todo</button>`;
  if (!S.h.length) return `<section class="section">${sectionHead('Hábitos', '')}<div class="card"><p class="empty-note">Un hábito pequeño, repetido, cambia mucho. </p><button class="btn secondary" data-a="habitnew" style="margin-top:10px">${icon('plus')}Crear un hábito</button></div></section>`;
  if (!list.length) return `<section class="section">${sectionHead('Hábitos', manage)}<p class="empty-note" style="margin-left:4px">Hoy es un día libre de hábitos.</p></section>`;
  const chips = list.map(h => {
    const on = isDone(h, date), extra = isWeekly(h) ? `<small>${weekCount(h, date)}/${h.perWeek}</small>` : '';
    return `<button class="habit-chip${on ? ' on' : ''}" data-a="habittoggle" data-id="${esc(h.id)}" data-date="${date}" aria-pressed="${on}" style="--c:${categoryColor(h.color ?? 0)}"><span class="dot">${icon('check')}</span><span>${esc(h.name)}</span>${extra}</button>`;
  }).join('');
  return `<section class="section">${sectionHead('Hábitos', manage)}<div class="habit-chips">${chips}</div></section>`;
}

function morning(date) {
  const Z = `d.${date}.`, intent = get(Z + 'i'), grat = get(Z + 'g');
  const parts = [];
  if (showToday('intention')) parts.push(`<div class="prompt"><label for="f-intent">¿Cómo quieres vivir este día?</label>${field(Z + 'i', 'Con calma, presente…', 'serif', ' id="f-intent"')}</div>`);
  if (showToday('gratitude')) parts.push(`<div class="prompt"><label for="f-grat">Gratitud</label>${field(Z + 'g', 'Agradece a tu manera…', '', ' id="f-grat"')}<p class="prompt-hint">Una persona, un momento, algo simple. No hace falta más.</p></div>`);
  if (!parts.length) return '';
  const summary = intent.trim() ? `“${esc(preview(intent))}”` : grat.trim() ? 'Gratitud escrita' : 'Intención y gratitud · 1 minuto';
  return foldable({ key: 'morning', open: U.morning, iconName: 'sunrise', title: 'Empieza tu día', summary, written: !!intent.trim(), body: parts.join('') });
}

function evening(date) {
  const Z = `d.${date}.`, mood = S.d[date]?.mood, reflection = get(Z + 'r');
  const parts = [];
  if (showToday('mood')) parts.push(`<div class="prompt"><span class="prompt-label">¿Cómo estuvo tu día?</span><div class="moods" role="radiogroup" aria-label="Estado de ánimo">${MOODS.map(([n, label]) =>
    `<button class="mood${mood === n ? ' on' : ''}" role="radio" aria-checked="${mood === n}" data-a="mood" data-k="${n}" style="--c:${moodColor(n)}"><i></i>${label}</button>`).join('')}</div></div>`);
  if (showToday('reflection')) {
    const legacy = [['hl', 'Momento que guardaste'], ['learn', 'Lo que aprendiste'], ['remember', 'Lo que quisiste recordar'], ['p', 'Planes del día']].filter(([k]) => String(get(Z + k)).trim());
    parts.push(`<div class="prompt"><label for="f-refl">¿Qué te dejó este día?</label>${field(Z + 'r', 'Algo que aprendiste, sentiste o quieres recordar…', '', ' id="f-refl"')}</div>`
      + legacy.map(([k, label]) => `<div class="prompt"><label>${label} <span class="muted small">(versión anterior)</span></label>${field(Z + k, label)}</div>`).join(''));
  }
  if (!parts.length) return '';
  const summary = reflection.trim() ? `“${esc(preview(reflection))}”` : mood ? MOODS.find(([n]) => n === mood)[1] : 'Ánimo y reflexión · 1 minuto';
  return foldable({ key: 'evening', open: U.evening, iconName: 'moon', iconCls: 'evening', title: 'Cierra tu día', summary, written: !!reflection.trim(), body: parts.join('') });
}

function notes(date) {
  const text = get(`d.${date}.n`, '');
  return foldable({ key: 'notes', open: U.notes, iconName: 'note', title: 'Notas', summary: text.trim() ? esc(preview(text)) : 'Ideas, apuntes, lo que no cabe en otro lugar', body: notesEditor(date) });
}

export function todayView() {
  const date = U.date, d = parseDate(date), T = today(), isToday = date === T;
  const eyebrow = `${DAYS[(d.getDay() + 6) % 7]} · ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  const title = isToday ? greeting() : date < T ? 'Mirando atrás' : 'Planificando';
  const back = isToday ? '' : ` · <button class="link" data-a="date" data-k="${T}" style="min-height:0">Volver a hoy</button>`;
  const [q, author] = quoteFor(date);
  const rituals = [morning(date), evening(date), notes(date)];
  return `<div class="view">${stickyHead(pageHead({ eyebrow: eyebrow, title, subtitle: back ? back.slice(3) : '' }) + weekStrip(date))}
    ${showToday('quote') ? `<blockquote class="quote">“${q}”<cite>${author}</cite></blockquote>` : ''}
    ${rituals[0] ? `<div class="section">${rituals[0]}</div>` : ''}
    ${tasksSection(date)}
    ${agendaSection(date)}
    ${showToday('habits') ? habitsSection(date) : ''}
    <div class="section">${rituals[1]}${rituals[1] ? '<div style="height:12px"></div>' : ''}${rituals[2]}</div>
  </div>`;
}
