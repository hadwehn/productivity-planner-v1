// «Hoy»: lo que importa del día en una sola pantalla.
// Orden pensado para el uso real: empezar (intención, gratitud) → tareas → agenda → hábitos → cerrar (ánimo, reflexión) → notas.
import { S, get } from '../state.js';
import { U, planningTime, showToday } from '../ui.js';
import { dayTasks, overdue } from '../tasks.js';
import { isDue, isDone, isWeekly, weekCount } from '../habits.js';
import { categoryColor, MOOD_LEVELS, moodColor, moodName } from '../categories.js';
import { quoteFor } from '../quotes.js';
import { icon } from '../icons.js';
import { dayMonth, tr } from '../i18n.js';
import { DAYS, DAY_SHORT, esc, iso, monday, parseDate, shiftDate, today } from '../util.js';
import { checkButton, field, foldable, pageHead, sectionHead, settingsButton, stickyHead } from './common.js';
import { notesEditor } from './notes.js';
import { eventRow, eventsOn } from '../events.js';
import { hasContent, isFinished, ritualState } from '../rituals.js';

const wide = () => typeof matchMedia === 'function' && matchMedia('(min-width: 1200px)').matches;
const greeting = () => {
  const h = new Date().getHours();
  return h < 6 ? tr('Buenas noches', 'Good night') : h < 13 ? tr('Buenos días', 'Good morning') : h < 20 ? tr('Buenas tardes', 'Good afternoon') : tr('Buenas noches', 'Good evening');
};
const preview = (value, max = 90) => { const t = String(value || '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };

/**
 * Una semana de la franja. `offset` ≠ 0: semana vecina. En el celular su día más cercano asoma cortado
 * en el borde (el domingo anterior a la izquierda, el lunes siguiente a la derecha), para que se note
 * que la franja se desliza; tocarlo pasa a esa semana.
 */
function weekPanel(mon, selected, offset) {
  const T = today(), side = offset !== 0;
  const days = DAY_SHORT.map((label, i) => {
    const d = shiftDate(mon, i), { focus, rest } = dayTasks(d), all = [...focus, ...rest];
    const mark = all.length ? `<i class="${all.every(x => x.row.c) ? 'full' : ''}"></i>` : '';
    const attrs = side ? `data-a="shiftweek" data-n="${offset}" tabindex="-1"`
      : `data-a="date" data-k="${d}" aria-label="${DAYS[i]} ${parseDate(d).getDate()}" aria-current="${d === selected ? 'date' : 'false'}"`;
    return `<button class="day-pill${d === selected ? ' on' : ''}${d === T ? ' today' : ''}" ${attrs}><span>${label.slice(0, 1)}</span><b>${parseDate(d).getDate()}</b>${mark}</button>`;
  }).join('');
  return `<div class="days"${side ? ' aria-hidden="true"' : ''}>${days}</div>`;
}

// Se cambia de día tocándolo y de semana deslizando la franja, que sigue al dedo (ver interactions.js).
// Las flechas se ven en el computador; en el celular quedan solo para el teclado y los lectores de pantalla.
function weekStrip(date) {
  const mon = iso(monday(parseDate(date)));
  const panels = [-1, 0, 1].map(o => weekPanel(shiftDate(mon, 7 * o), o ? '' : date, o)).join('');
  const arrow = (n, label, name) => `<button class="strip-nav" data-a="shiftweek" data-n="${n}" aria-label="${label}" title="${label}">${icon(name)}</button>`;
  return `<div class="strip-wrap">${arrow(-1, tr('Semana anterior', 'Previous week'), 'left')}<div class="week-strip" data-swipe="week" aria-label="${tr('Días de la semana. Desliza para cambiar de semana.', 'Days of the week. Swipe to change week.')}"><div class="strip-track">${panels}</div></div>${arrow(1, tr('Semana siguiente', 'Next week'), 'right')}</div>`;
}

function taskItem(date, { key, row }, focus) {
  const linked = row.source ? `<span class="task-meta">${tr('De tu semana', 'From your week')}</span>` : '';
  const star = focus ? tr('Quitar del foco', 'Remove from focus') : tr('Poner en foco', 'Add to focus');
  const text = `<textarea data-task-text="${key}" rows="1" enterkeyhint="done" autocapitalize="none" aria-label="${tr('Tarea', 'Task')}">${esc(row.t)}</textarea>`;
  const starBtn = `<button class="task-btn star${focus ? ' on' : ''}" data-a="taskfocus" data-k="${key}" aria-pressed="${focus}" aria-label="${star}" title="${star}">${icon('star')}</button>`;
  return `<div class="task${focus ? ' focus' : ''}${row.c ? ' done' : ''}" data-task="${key}" data-sort>
    ${checkButton(row.c, `data-a="taskdone" data-k="${key}"`, tr('Marcar como hecha', 'Mark as done'))}
    <div class="task-main">${text}${linked}</div>
    ${starBtn}
    <button class="task-btn" data-a="taskmenu" data-k="${key}" aria-label="${tr('Más opciones', 'More options')}" title="${tr('Más opciones', 'More options')}">${icon('more')}</button>
  </div>`;
}

// Las tareas hechas se muestran al final de su grupo (sin cambiar el orden guardado: al desmarcar
// una tarea vuelve a su lugar). La recién marcada espera un momento antes de bajar (U.settling).
const pendingFirst = list => [...list].sort((a, b) => done(a) - done(b));
const done = t => (t.row.c && t.key !== U.settling ? 1 : 0);

function tasksSection(date) {
  const { focus: focusRaw, rest: restRaw } = dayTasks(date);
  const focus = pendingFirst(focusRaw), rest = pendingFirst(restRaw);
  const doneCount = [...focus, ...rest].filter(x => x.row.c).length, total = focus.length + rest.length;
  const items = (list, focus) => list.map(t => taskItem(date, t, focus)).join('');
  const focusBlock = `<div class="group-label"><span class="label gold">${icon('star')}${tr('En foco', 'In focus')}</span><span class="muted small">${focus.length && focus.every(t => t.row.c) ? tr('✓ hecho', '✓ done') : `${focus.length}/3`}</span></div>`
    + (focus.length ? items(focus, true)
      : `<p class="empty-note" style="padding:0 8px 6px">${tr('Marca con ★ hasta tres tareas que harían de este un buen día.', 'Star up to three tasks that would make this a good day.')}</p>`);
  const restBlock = rest.length ? `<div class="divider"></div>${items(rest, false)}` : '';
  const add = `<form class="add-row" data-form="addtask"><button type="submit" class="add-btn" aria-label="${tr('Añadir', 'Add')}" title="${tr('Añadir', 'Add')}">${icon('plus')}</button><input name="task" autocomplete="off" autocapitalize="none" enterkeyhint="done" placeholder="${tr('Añadir tarea', 'Add a task')}" aria-label="${tr('Añadir tarea', 'Add a task')}"></form>`;
  const card = `<div class="card tasks">${focusBlock}${restBlock}${add}</div>`;
  return `<section class="section">${sectionHead(tr('Tareas', 'Tasks'), total ? `<span class="muted small">${doneCount} ${tr('de', 'of')} ${total}</span>` : '')}
    ${card}</section>`;
}

function agendaSection(date) {
  const events = eventsOn(date);
  const add = `<button class="link" data-a="eventnew">${icon('plus')}${tr('Evento', 'Event')}</button>`;
  if (!events.length) return `<section class="section">${sectionHead(tr('Agenda', 'Schedule'), add)}<p class="empty-note" style="margin-left:4px">${tr('Sin eventos.', 'No events.')}</p></section>`;
  return `<section class="section">${sectionHead(tr('Agenda', 'Schedule'), add)}<div class="card" style="padding:6px 8px">${events.map(x => eventRow(x, date)).join('')}</div></section>`;
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

// Campo editable o, si el ritual ya está terminado (o el día aún no llega), el texto para leer.
const ritualField = (editable, path, label, placeholder, cls = '', id = '', hint = '') => {
  if (editable) return `<div class="prompt"><label for="${id}">${label}</label>${field(path, placeholder, cls, ` id="${id}"`)}${hint}</div>`;
  const text = String(get(path)).trim();
  return text ? `<div class="prompt"><span class="prompt-label">${label}</span><p class="ritual-read ${cls}">${esc(text)}</p></div>` : '';
};

/** Pie del ritual: botón para terminarlo o, ya terminado, la opción de volver a editarlo. */
function ritualFoot(date, which, state) {
  if (state === 'open') {
    const label = which === 'e' ? tr('Cerrar el día', 'Close the day') : date < today() ? tr('Listo', 'Done') : tr('Listo, empezar el día', 'Done, start the day');
    return `<button class="btn ritual-finish" data-a="ritualdone" data-k="${which}">${icon('check')}${label}</button>`;
  }
  if (state === 'future') return `<p class="ritual-note">${icon('calendar')}${tr('Podrás escribirlo cuando llegue ese día.', 'You can write it when that day comes.')}</p>`;
  const note = which === 'm' ? tr('Empezaste este día.', 'You started this day.') : tr('Cerraste este día.', 'You closed this day.');
  return `<p class="ritual-note">${icon('check')}${note}<button class="link" data-a="ritualedit" data-k="${which}">${tr('Editar', 'Edit')}</button></p>`;
}

function morning(date) {
  const Z = `d.${date}.`, intent = get(Z + 'i'), grat = get(Z + 'g'), state = ritualState(date, 'm'), editable = state === 'open';
  const parts = [];
  if (showToday('intention')) parts.push(ritualField(editable, Z + 'i', tr('¿Cómo quieres vivir este día?', 'How do you want to live today?'), tr('Con calma, presente…', 'Calm, present…'), '', 'f-intent'));
  // Mismo formato que «Cierra tu día»: dos preguntas, sin texto de ayuda aparte.
  if (showToday('gratitude')) parts.push(ritualField(editable, Z + 'g', tr('¿Qué agradeces hoy?', 'What are you grateful for today?'), tr('Una persona, un momento, algo simple…', 'A person, a moment, something simple…'), '', 'f-grat'));
  if (!showToday('intention') && !showToday('gratitude')) return '';
  const done = state === 'done';
  const summary = done ? tr('Listo', 'Done') + (intent.trim() ? ` · “${esc(preview(intent, 70))}”` : '')
    : intent.trim() ? `“${esc(preview(intent))}”` : grat.trim() ? tr('Gratitud escrita', 'Gratitude written')
      : state === 'future' ? tr('Disponible ese día', 'Available on that day') : date < today() ? tr('Sin escribir · puedes completarlo', 'Not written · you can still fill it in') : tr('Intención y gratitud · 1 minuto', 'Intention and gratitude · 1 minute');
  return foldable({ key: 'morning', open: U.morning, iconName: done ? 'check' : 'sunrise', iconCls: 'evening', title: tr('Empieza tu día', 'Start your day'), summary, written: !done && !!intent.trim(), body: parts.join('') + ritualFoot(date, 'm', state) });
}

function evening(date) {
  const Z = `d.${date}.`, mood = S.d[date]?.mood, reflection = get(Z + 'r'), state = ritualState(date, 'e'), editable = state === 'open';
  const parts = [];
  if (showToday('mood')) {
    const levels = editable ? MOOD_LEVELS : MOOD_LEVELS.filter(n => n === mood);
    if (levels.length) parts.push(`<div class="prompt"><span class="prompt-label">${tr('¿Cómo estuvo tu día?', 'How was your day?')}</span><div class="moods${editable ? '' : ' read'}" role="radiogroup" aria-label="${tr('Estado de ánimo', 'Mood')}">${levels.map(n =>
      `<button class="mood${mood === n ? ' on' : ''}" role="radio" aria-checked="${mood === n}" ${editable ? `data-a="mood" data-k="${n}"` : 'disabled'} style="--c:${moodColor(n)}">${icon('mood' + n, 'icon face')}${moodName(n)}</button>`).join('')}</div></div>`);
  }
  if (showToday('reflection')) {
    const legacy = [['hl', tr('Momento que guardaste', 'A moment you kept')], ['learn', tr('Lo que aprendiste', 'What you learned')], ['remember', tr('Lo que quisiste recordar', 'What you wanted to remember')], ['p', tr('Planes del día', 'Plans for the day')]]
      .filter(([k]) => String(get(Z + k)).trim());
    parts.push(ritualField(editable, Z + 'r', tr('¿Qué te dejó este día?', 'What did today leave you?'), tr('Algo que aprendiste, sentiste o quieres recordar…', 'Something you learned, felt or want to remember…'), '', 'f-refl')
      + legacy.map(([k, label]) => ritualField(editable, Z + k, `${label} <span class="muted small">(${tr('versión anterior', 'previous version')})</span>`, label, '', `f-${k}`)).join(''));
  }
  if (!showToday('mood') && !showToday('reflection')) return '';
  const done = state === 'done';
  const summary = done ? tr('Listo', 'Done') + (reflection.trim() ? ` · “${esc(preview(reflection, 70))}”` : mood ? ` · ${moodName(mood)}` : '')
    : reflection.trim() ? `“${esc(preview(reflection))}”` : mood ? moodName(mood)
      : state === 'future' ? tr('Disponible ese día', 'Available on that day') : date < today() ? tr('Sin escribir · puedes completarlo', 'Not written · you can still fill it in') : tr('Ánimo y reflexión · 1 minuto', 'Mood and reflection · 1 minute');
  return foldable({ key: 'evening', open: U.evening, iconName: done ? 'check' : 'moon', iconCls: 'evening', title: tr('Cierra tu día', 'Close your day'), summary, written: !done && !!reflection.trim(), body: parts.join('') + ritualFoot(date, 'e', state) });
}

/**
 * Avisos de hoy, juntos en un solo bloque discreto:
 * - por la mañana, si ayer se usó pero quedó sin cerrar, se ofrece cerrarlo (p. ej., al llegar tarde
 *   a casa); desaparece solo al mediodía o al escribir algo en el cierre de ayer;
 * - tareas pendientes de días anteriores.
 */
function notices(T) {
  const rows = [];
  const Y = shiftDate(T, -1), { focus, rest } = dayTasks(Y);
  const unclosed = new Date().getHours() < 12 && (showToday('mood') || showToday('reflection'))
    && !isFinished(Y, 'e') && !hasContent(Y, 'e') && (hasContent(Y, 'm') || focus.length || rest.length);
  if (unclosed) rows.push([icon('moon'), tr('Ayer quedó sin cerrar.', 'Yesterday wasn’t closed.'), 'closeyesterday', tr('Cerrarlo', 'Close it')]);
  const late = overdue(T);
  if (late.length) rows.push([icon('inbox'), late.length === 1 ? tr('Quedó 1 tarea pendiente de días anteriores.', '1 task left over from previous days.')
    : tr(`Quedaron ${late.length} tareas pendientes de días anteriores.`, `${late.length} tasks left over from previous days.`), 'overdue', tr('Revisar', 'Review')]);
  if (!rows.length) return '';
  return `<div class="notices">${rows.map(([ic, text, action, label]) => `<div class="notice">${ic}<p>${text}</p><button class="btn small" data-a="${action}">${label}</button></div>`).join('')}</div>`;
}

/** De noche, estando en hoy o en mañana: elegir cuál de los dos días organizar. */
function planSwitch(date, T) {
  const next = shiftDate(T, 1);
  if (!planningTime() || (date !== T && date !== next)) return '';
  const option = (k, label, on) => `<button role="tab" class="${on ? 'on' : ''}" data-a="planday" data-k="${k}" aria-selected="${on}">${label}</button>`;
  return `<div class="plan-switch">${icon('moon')}<span>${tr('¿Qué día quieres organizar?', 'Which day do you want to plan?')}</span>
    <div class="seg" role="tablist">${option('today', tr('Hoy', 'Today'), date === T)}${option('tomorrow', tr('Mañana', 'Tomorrow'), date === next)}</div></div>`;
}

function notes(date) {
  const text = get(`d.${date}.n`, '');
  return foldable({ key: 'notes', open: U.notes, iconName: 'note', title: tr('Notas', 'Notes'), summary: text.trim() ? esc(preview(text)) : tr('Ideas y apuntes del día', 'Ideas and notes for the day'), body: notesEditor(date) });
}

export function todayView() {
  const date = U.date, d = parseDate(date), T = today(), isToday = date === T;
  // La fecha va bajo el saludo, como las fechas bajo el título en Plan y Diario: así el título queda a la misma altura en todas las pantallas.
  const subtitle = `<span class="period">${DAYS[(d.getDay() + 6) % 7]}, ${dayMonth(d)}</span>`;
  const title = isToday ? greeting() : date < T ? tr('Mirando atrás', 'Looking back') : tr('Planificando', 'Planning ahead');
  // «Volver a hoy» va junto a Ajustes (no en una línea extra), para que la cabecera fija mida lo mismo cualquier día.
  const side = `<div class="head-actions">${isToday ? '' : `<button class="pill" data-a="date" data-k="${T}">${icon('left')}${tr('Hoy', 'Today')}</button>`}${settingsButton()}</div>`;
  // La frase del día se ve siempre. Con «Ver la frase de los días futuros» apagado, un día futuro
  // repite la de hoy (no se adelantan las frases que vienen).
  const [q, author] = quoteFor(date > T && !showToday('futureQuotes') ? T : date);
  const quote = `<figure class="quote"><span class="quote-mark" aria-hidden="true">“</span><blockquote>${q}</blockquote><figcaption>${author}</figcaption></figure>`;
  const section = html => (html ? `<div class="section">${html}</div>` : '');
  const start = section(morning(date)), close = evening(date), pad = notes(date);
  const nudge = isToday ? notices(T) : '', habits = showToday('habits') ? habitsSection(date) : '';
  // Pantalla amplia: la franja de días y la frase ocupan todo el ancho. Debajo, a la izquierda el
  // recorrido del día (avisos → empezar → tareas → cerrar) y a la derecha, más angosto, lo que
  // acompaña (hábitos, agenda y notas). En el resto, una sola columna.
  const body = wide()
    ? `${quote.replace('class="quote"', 'class="quote quote-wide"')}<div class="cols today-cols"><div class="col">${nudge}${start}${tasksSection(date)}${section(close)}</div>
        <div class="col">${habits}${agendaSection(date)}${section(pad)}</div></div>`
    : `${quote}${nudge}${start}${tasksSection(date)}${agendaSection(date)}${habits}
        <div class="section">${close}${close ? '<div style="height:12px"></div>' : ''}${pad}</div>`;
  return `<div class="view">${stickyHead(pageHead({ title, subtitle, side }) + weekStrip(date))}${planSwitch(date, T)}${body}</div>`;
}
