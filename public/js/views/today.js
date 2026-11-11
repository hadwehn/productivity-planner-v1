// «Hoy»: lo que importa del día en una sola pantalla.
// Orden pensado para el uso real: empezar (intención, gratitud) → tareas → agenda → hábitos → cerrar (ánimo, reflexión) → notas.
import { S, get } from '../state.js';
import { U, showToday } from '../ui.js';
import { dayTasks, overdue } from '../tasks.js';
import { isDue, isDone, isWeekly, weekCount } from '../habits.js';
import { categoryColor, MOOD_LEVELS, moodColor, moodName } from '../categories.js';
import { quoteFor } from '../quotes.js';
import { icon } from '../icons.js';
import { dayMonth, tr } from '../i18n.js';
import { DAYS, DAY_SHORT, esc, iso, monday, parseDate, shiftDate, today } from '../util.js';
import { checkButton, field, foldable, pageHead, sectionHead, stickyHead } from './common.js';
import { notesEditor } from './notes.js';

const greeting = () => {
  const h = new Date().getHours();
  return h < 6 ? tr('Buenas noches', 'Good night') : h < 13 ? tr('Buenos días', 'Good morning') : h < 20 ? tr('Buenas tardes', 'Good afternoon') : tr('Buenas noches', 'Good evening');
};
const preview = (value, max = 90) => { const t = String(value || '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };

function weekStrip(date) {
  const mon = iso(monday(parseDate(date))), T = today();
  const days = DAY_SHORT.map((label, i) => {
    const d = shiftDate(mon, i), { focus, rest } = dayTasks(d), all = [...focus, ...rest];
    const mark = all.length ? `<i class="${all.every(x => x.row.c) ? 'full' : ''}"></i>` : '';
    return `<button class="day-pill${d === date ? ' on' : ''}${d === T ? ' today' : ''}" data-a="date" data-k="${d}" aria-label="${DAYS[i]} ${parseDate(d).getDate()}" aria-current="${d === date ? 'date' : 'false'}"><span>${label.slice(0, 1)}</span><b>${parseDate(d).getDate()}</b>${mark}</button>`;
  }).join('');
  return `<div class="week-strip"><button class="nav" data-a="shiftweek" data-n="-1" aria-label="${tr('Semana anterior', 'Previous week')}">${icon('left')}</button><div class="days">${days}</div><button class="nav" data-a="shiftweek" data-n="1" aria-label="${tr('Semana siguiente', 'Next week')}">${icon('right')}</button></div>`;
}

function taskItem(date, { key, row }, focus) {
  const linked = row.source ? `<span class="task-meta">${tr('De tu semana', 'From your week')}</span>` : '';
  const star = focus ? tr('Quitar del foco', 'Remove from focus') : tr('Poner en foco', 'Add to focus');
  return `<div class="task${focus ? ' focus' : ''}${row.c ? ' done' : ''}" data-task="${key}">
    ${focus ? '' : `<span class="handle" data-drag="${key}" aria-hidden="true">${icon('grip')}</span>`}
    ${checkButton(row.c, `data-a="taskdone" data-k="${key}"`, tr('Marcar como hecha', 'Mark as done'))}
    <div class="task-main"><textarea data-task-text="${key}" rows="1" enterkeyhint="done" autocapitalize="none" aria-label="${tr('Tarea', 'Task')}">${esc(row.t)}</textarea>${linked}</div>
    <button class="task-btn star${focus ? ' on' : ''}" data-a="taskfocus" data-k="${key}" aria-pressed="${focus}" aria-label="${star}" title="${star}">${icon('star')}</button>
    <button class="task-btn" data-a="taskmenu" data-k="${key}" aria-label="${tr('Más opciones', 'More options')}" title="${tr('Más opciones', 'More options')}">${icon('more')}</button>
  </div>`;
}

function tasksSection(date) {
  const { focus, rest } = dayTasks(date), T = today();
  const late = date === T ? overdue(T) : [];
  const lateText = late.length === 1 ? tr('Quedó 1 tarea pendiente de días anteriores.', '1 task left over from previous days.')
    : tr(`Quedaron ${late.length} tareas pendientes de días anteriores.`, `${late.length} tasks left over from previous days.`);
  const banner = late.length ? `<div class="banner">${icon('inbox')}<p>${lateText}</p><button class="btn small" data-a="overdue">${tr('Revisar', 'Review')}</button></div>` : '';
  const doneCount = [...focus, ...rest].filter(x => x.row.c).length, total = focus.length + rest.length;
  const focusBlock = `<div class="group-label"><span class="label gold">${icon('star')}${tr('En foco', 'In focus')}</span><span class="muted small">${focus.length}/3</span></div>`
    + (focus.length ? focus.map(t => taskItem(date, t, true)).join('')
      : `<p class="empty-note" style="padding:0 8px 6px">${tr('Marca con ★ hasta tres tareas que harían de este un buen día.', 'Star up to three tasks that would make this a good day.')}</p>`);
  const restBlock = rest.length ? `<div class="divider"></div>${rest.map(t => taskItem(date, t, false)).join('')}` : '';
  return `<section class="section">${banner}${sectionHead(tr('Tareas', 'Tasks'), total ? `<span class="muted small">${doneCount} ${tr('de', 'of')} ${total}</span>` : '')}
    <div class="card tasks">${focusBlock}${restBlock}
      <form class="add-row" data-form="addtask">${icon('plus')}<input name="task" autocomplete="off" autocapitalize="none" enterkeyhint="done" placeholder="${tr('Añadir tarea', 'Add a task')}" aria-label="${tr('Añadir tarea', 'Add a task')}"></form>
    </div></section>`;
}

function agendaSection(date) {
  const events = (S.ev[date] || []).map((e, i) => ({ e, i })).filter(({ e }) => e.t?.trim()).sort((a, b) => (a.e.h || '99').localeCompare(b.e.h || '99'));
  const add = `<button class="link" data-a="eventnew">${icon('plus')}${tr('Evento', 'Event')}</button>`;
  if (!events.length) return `<section class="section">${sectionHead(tr('Agenda', 'Schedule'), add)}</section>`;
  return `<section class="section">${sectionHead(tr('Agenda', 'Schedule'), add)}<div class="card" style="padding:6px 8px">${events.map(({ e, i }) =>
    `<button class="event" data-a="eventedit" data-i="${i}" style="--c:${categoryColor(e.c ?? -1)}"><time>${esc(e.h || tr('Todo', 'All day'))}</time><i class="bar"></i><span>${esc(e.t)}</span></button>`).join('')}</div></section>`;
}

function habitsSection(date) {
  const list = S.h.filter(h => isDue(h, date)), title = tr('Hábitos', 'Habits');
  const manage = `<button class="link" data-a="go" data-k="habits">${tr('Ver todo', 'See all')}</button>`;
  if (!S.h.length) return `<section class="section">${sectionHead(title, '')}<div class="card"><p class="empty-note">${tr('Un hábito pequeño, repetido, cambia mucho.', 'A small habit, repeated, changes a lot.')}</p><button class="btn secondary" data-a="habitnew" style="margin-top:10px">${icon('plus')}${tr('Crear un hábito', 'Create a habit')}</button></div></section>`;
  if (!list.length) return `<section class="section">${sectionHead(title, manage)}<p class="empty-note" style="margin-left:4px">${tr('Hoy es un día libre de hábitos.', 'No habits planned for today.')}</p></section>`;
  const chips = list.map(h => {
    const on = isDone(h, date), extra = isWeekly(h) ? `<small>${weekCount(h, date)}/${h.perWeek}</small>` : '';
    return `<button class="habit-chip${on ? ' on' : ''}" data-a="habittoggle" data-id="${esc(h.id)}" data-date="${date}" aria-pressed="${on}" style="--c:${categoryColor(h.color ?? 0)}"><span class="dot">${icon('check')}</span><span>${esc(h.name)}</span>${extra}</button>`;
  }).join('');
  return `<section class="section">${sectionHead(title, manage)}<div class="habit-chips">${chips}</div></section>`;
}

function morning(date) {
  const Z = `d.${date}.`, intent = get(Z + 'i'), grat = get(Z + 'g');
  const parts = [];
  if (showToday('intention')) parts.push(`<div class="prompt"><label for="f-intent">${tr('¿Cómo quieres vivir este día?', 'How do you want to live today?')}</label>${field(Z + 'i', tr('Con calma, presente…', 'Calm, present…'), 'serif', ' id="f-intent"')}</div>`);
  if (showToday('gratitude')) parts.push(`<div class="prompt"><label for="f-grat">${tr('Gratitud', 'Gratitude')}</label>${field(Z + 'g', tr('Agradece a tu manera…', 'Be grateful your way…'), '', ' id="f-grat"')}<p class="prompt-hint">${tr('Una persona, un momento, algo simple. No hace falta más.', 'A person, a moment, something simple. That is enough.')}</p></div>`);
  if (!parts.length) return '';
  const summary = intent.trim() ? `“${esc(preview(intent))}”` : grat.trim() ? tr('Gratitud escrita', 'Gratitude written') : tr('Intención y gratitud · 1 minuto', 'Intention and gratitude · 1 minute');
  return foldable({ key: 'morning', open: U.morning, iconName: 'sunrise', title: tr('Empieza tu día', 'Start your day'), summary, written: !!intent.trim(), body: parts.join('') });
}

function evening(date) {
  const Z = `d.${date}.`, mood = S.d[date]?.mood, reflection = get(Z + 'r');
  const parts = [];
  if (showToday('mood')) parts.push(`<div class="prompt"><span class="prompt-label">${tr('¿Cómo estuvo tu día?', 'How was your day?')}</span><div class="moods" role="radiogroup" aria-label="${tr('Estado de ánimo', 'Mood')}">${MOOD_LEVELS.map(n =>
    `<button class="mood${mood === n ? ' on' : ''}" role="radio" aria-checked="${mood === n}" data-a="mood" data-k="${n}" style="--c:${moodColor(n)}">${icon('mood' + n, 'icon face')}${moodName(n)}</button>`).join('')}</div></div>`);
  if (showToday('reflection')) {
    const legacy = [['hl', tr('Momento que guardaste', 'A moment you kept')], ['learn', tr('Lo que aprendiste', 'What you learned')], ['remember', tr('Lo que quisiste recordar', 'What you wanted to remember')], ['p', tr('Planes del día', 'Plans for the day')]]
      .filter(([k]) => String(get(Z + k)).trim());
    parts.push(`<div class="prompt"><label for="f-refl">${tr('¿Qué te dejó este día?', 'What did today leave you?')}</label>${field(Z + 'r', tr('Algo que aprendiste, sentiste o quieres recordar…', 'Something you learned, felt or want to remember…'), '', ' id="f-refl"')}</div>`
      + legacy.map(([k, label]) => `<div class="prompt"><label>${label} <span class="muted small">(${tr('versión anterior', 'previous version')})</span></label>${field(Z + k, label)}</div>`).join(''));
  }
  if (!parts.length) return '';
  const summary = reflection.trim() ? `“${esc(preview(reflection))}”` : mood ? moodName(mood) : tr('Ánimo y reflexión · 1 minuto', 'Mood and reflection · 1 minute');
  return foldable({ key: 'evening', open: U.evening, iconName: 'moon', iconCls: 'evening', title: tr('Cierra tu día', 'Close your day'), summary, written: !!reflection.trim(), body: parts.join('') });
}

function notes(date) {
  const text = get(`d.${date}.n`, '');
  return foldable({ key: 'notes', open: U.notes, iconName: 'note', title: tr('Notas', 'Notes'), summary: text.trim() ? esc(preview(text)) : tr('Ideas y apuntes del día', 'Ideas and notes for the day'), body: notesEditor(date) });
}

export function todayView() {
  const date = U.date, d = parseDate(date), T = today(), isToday = date === T;
  const eyebrow = `${DAYS[(d.getDay() + 6) % 7]} · ${dayMonth(d)}`;
  const title = isToday ? greeting() : date < T ? tr('Mirando atrás', 'Looking back') : tr('Planificando', 'Planning ahead');
  const back = isToday ? '' : `<button class="link" data-a="date" data-k="${T}" style="min-height:0">${tr('Volver a hoy', 'Back to today')}</button>`;
  const [q, author] = quoteFor(date);
  const rituals = [morning(date), evening(date), notes(date)];
  return `<div class="view">${stickyHead(pageHead({ eyebrow, title, subtitle: back }) + weekStrip(date))}
    ${showToday('quote') ? `<figure class="quote"><span class="quote-mark" aria-hidden="true">“</span><blockquote>${q}</blockquote><figcaption>${author}</figcaption></figure>` : ''}
    ${rituals[0] ? `<div class="section">${rituals[0]}</div>` : ''}
    ${tasksSection(date)}
    ${agendaSection(date)}
    ${showToday('habits') ? habitsSection(date) : ''}
    <div class="section">${rituals[1]}${rituals[1] ? '<div style="height:12px"></div>' : ''}${rituals[2]}</div>
  </div>`;
}
