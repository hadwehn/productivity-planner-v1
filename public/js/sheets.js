// Hojas inferiores: opciones de tarea, pendientes, hábito, evento, bienvenida.
// Todas usan el mismo <dialog id="sheet">; los ajustes tienen su propio diálogo en index.html.
import { S, save } from './state.js';
import { U, toast, toastUndo } from './ui.js';
import {
  bringOverdue, dayTasks, dropTask, getTask, isFocusKey, moveTask, movePendingTo, moveWeekTaskToNext, overdue, removeTask, removeWeekTask, restore,
  snapshot, toggleFocus, toggleWeekFocus,
} from './tasks.js';
import { consistency, deleteHabit, frequencyLabel, isDone, isWeekly, saveHabit, streak, toggle } from './habits.js';
import { CATEGORY_ORDER, categoryColor, categoryName } from './categories.js';
import { icon } from './icons.js';
import { render } from './render.js';
import { MAX_EVENT_DAYS, rangeLabel } from './events.js';
import { dayClosed, weekClosed } from './rituals.js';
import { dayMonth, monthYear, plural, tr } from './i18n.js';
import { $, $$, DAYS, DAY_SHORT, daysInMonth, esc, iso, monday, p2, parseDate, shiftDate, shiftMonth, today, weekday } from './util.js';

const sheet = () => $('#sheet');
export function openSheet(title, body, onMount) {
  const dlg = sheet();
  dlg.innerHTML = `<div class="sheet-grip" aria-hidden="true"></div><div class="sheet-head"><h2>${title}</h2><button class="icon-btn" data-a="dismiss" aria-label="${tr('Cerrar', 'Close')}">${icon('close')}</button></div><div class="sheet-body">${body}</div>`;
  if (!dlg.open) dlg.showModal();
  onMount?.(dlg);
}
export const closeSheet = () => { if (sheet().open) sheet().close(); };

// ——— Selector de día (próximas dos semanas + calendario) ———
function datePicker(action, attrs, from = today()) {
  const T = today();
  const buttons = Array.from({ length: 14 }, (_, i) => {
    const d = shiftDate(T, i), pd = parseDate(d);
    return `<button data-a="${action}" ${attrs} data-date="${d}" class="${d === T ? 'today' : ''}"${d === from ? ' disabled' : ''}>${DAY_SHORT[weekday(pd)]}<b>${pd.getDate()}</b></button>`;
  }).join('');
  return `<div class="date-grid">${buttons}</div><div class="field" style="margin-top:10px"><label for="pickDate">${tr('Otra fecha', 'Another date')}</label><input id="pickDate" class="input" type="date" min="${T}"></div><button class="btn secondary" data-a="${action}" ${attrs} data-date="" data-from-input="1">${tr('Mover a esa fecha', 'Move to that date')}</button>`;
}

// ——— Tarea del día ———
export function taskMenu(date, key) {
  const row = getTask(date, key);
  if (!row) return;
  const focus = isFocusKey(key), tomorrow = shiftDate(date, 1), closed = dayClosed(date), T = today();
  // En un día pasado solo se puede mover la tarea (a hoy o a otro día); no se edita ni se borra.
  const moveFirst = closed
    ? `<button data-a="taskmove" data-k="${key}" data-date="${T}">${icon('tomorrow')}${tr('Pasar a hoy', 'Move to today')}</button>`
    : `<button data-a="taskmove" data-k="${key}" data-date="${tomorrow}">${icon('tomorrow')}${tr('Pasar a mañana', 'Move to tomorrow')}</button>`;
  openSheet(`<span class="caps">${esc(row.t)}</span>`, `<div class="menu">
    ${moveFirst}
    <button data-a="taskpick" data-k="${key}">${icon('calendar')}${tr('Elegir otro día', 'Pick another day')}</button>
    ${closed ? '' : `<button data-a="taskfocus" data-k="${key}" data-close="1">${icon(focus ? 'starOff' : 'star')}${focus ? tr('Quitar del foco', 'Remove from focus') : tr('Poner en foco', 'Add to focus')}</button>
    <button class="danger" data-a="taskdelete" data-k="${key}">${icon('trash')}${tr('Eliminar', 'Delete')}</button>`}
  </div>${row.source ? `<p class="muted small" style="margin:14px 2px 0">${tr('Viene de tu semana: al marcarla como hecha también se marca allí. Si cambias su nombre, dejan de estar vinculadas.', 'This comes from your week: marking it done also marks it there. If you rename it, they are no longer linked.')}</p>` : ''}`);
}
export function taskPick(date, key) {
  const row = getTask(date, key);
  if (row) openSheet(tr('¿A qué día?', 'Which day?'), datePicker('taskmove', `data-k="${key}"`, date));
}
export function doMoveTask(date, key, target) {
  if (!target) { toast(tr('Elige una fecha.', 'Pick a date.')); return; }
  const result = moveTask(date, key, target);
  closeSheet();
  if (result.error) { toast(result.error); return; }
  render();
  const pd = parseDate(target);
  const message = target === shiftDate(date, 1) ? tr('Pasada a mañana', 'Moved to tomorrow') : tr(`Movida al ${DAYS[weekday(pd)].toLowerCase()} ${pd.getDate()}`, `Moved to ${DAYS[weekday(pd)]} ${pd.getDate()}`);
  toastUndo(message, () => { restore(result.undo); render(); });
}
export function doDeleteTask(date, key) {
  const undo = snapshot([date]);
  removeTask(date, key);
  closeSheet();
  render();
  toastUndo(tr('Tarea eliminada', 'Task deleted'), () => { restore(undo); render(); });
}
export function doToggleFocus(date, key) {
  const result = toggleFocus(date, key);
  if (result.error) toast(result.error);
  render();
}

// ——— Pendientes de días anteriores ———
export function overdueSheet() {
  const T = today(), items = overdue(T);
  if (!items.length) { closeSheet(); render(); return; }
  const rows = items.map(({ date, key, row }) => {
    const pd = parseDate(date);
    return `<div class="task" style="padding-left:0"><div class="task-main"><span style="padding:8px 0 2px;overflow-wrap:anywhere">${esc(row.t)}</span><span class="task-meta" style="margin:0 0 6px">${DAYS[weekday(pd)]} ${pd.getDate()}</span></div>
      <button class="btn small secondary" data-a="overduebring" data-date="${date}" data-k="${key}">${tr('Traer', 'Bring')}</button>
      <button class="btn small quiet" data-a="overduedrop" data-date="${date}" data-k="${key}" title="${tr('Ya no es pendiente; queda guardada en su día', 'No longer pending; it stays saved on its day')}">${tr('Soltar', 'Let go')}</button></div>`;
  }).join('<div class="divider" style="margin:0"></div>');
  openSheet(tr('Pendientes', 'Left over'), `<p class="muted small" style="margin:0 0 12px">${tr('Trae a hoy lo que sigue importando. Suelta lo que ya no: queda guardado en su día, sin culpa.', 'Bring to today what still matters. Let go of what doesn’t: it stays saved on its day, no guilt.')}</p>${rows}
    <div class="row-actions"><button class="btn" data-a="overdueall">${tr('Traer todo a hoy', 'Bring all to today')}</button></div>`);
}
export function overdueAction(kind, date, key) {
  const T = today();
  if (kind === 'all') {
    const { undo, count } = bringOverdue(T);
    closeSheet();
    render();
    toastUndo(tr(`${count} ${count === 1 ? 'tarea traída' : 'tareas traídas'} a hoy`, `${count} ${plural(count, '', '', 'task', 'tasks')} brought to today`), () => { restore(undo); render(); });
    return;
  }
  if (kind === 'bring') moveTask(date, key, T); else dropTask(date, key);
  overdueSheet();
  render();
}

// ——— Tarea de la semana ———
export function weekMenu(list, i) {
  const row = S.w[U.week]?.[list]?.[i];
  if (!row) return;
  // Semana pasada: solo se puede traer la tarea a esta semana (no cambiarla de lista ni borrarla).
  if (weekClosed(U.week)) {
    openSheet(`<span class="caps">${esc(row.t)}</span>`, `<div class="menu">
      <button data-a="weekthis" data-list="${list}" data-i="${i}">${icon('arrowRight')}${tr('Pasar a esta semana', 'Move to this week')}</button></div>`);
    return;
  }
  openSheet(`<span class="caps">${esc(row.t)}</span>`, `<div class="menu">
    <button data-a="weekmove" data-list="${list}" data-i="${i}">${icon(list === 'a' ? 'starOff' : 'star')}${list === 'a' ? tr('Pasar a «También esta semana»', 'Move to “Also this week”') : tr('Pasar al foco de la semana', 'Move to weekly focus')}</button>
    <button data-a="weeknext" data-list="${list}" data-i="${i}">${icon('arrowRight')}${tr('Pasar a la próxima semana', 'Move to next week')}</button>
    <button class="danger" data-a="weekdelete" data-list="${list}" data-i="${i}">${icon('trash')}${tr('Eliminar', 'Delete')}</button></div>
    <p class="muted small" style="margin:14px 2px 0">${tr('Eliminarla de la semana deja sus copias en los días, sin vínculo.', 'Deleting it from the week keeps its copies on the days, unlinked.')}</p>`);
}
export function weekAction(kind, list, i) {
  const undo = snapshot(Object.keys(S.d));
  if (kind === 'move') { const r = toggleWeekFocus(U.week, list, i); if (r.error) toast(r.error); closeSheet(); render(); return; }
  if (kind === 'this') {
    const r = moveWeekTaskToNext(U.week, list, i, iso(monday(new Date())));
    closeSheet();
    if (r.error) { toast(r.error); return; }
    render();
    toastUndo(tr('Pasó a esta semana', 'Moved to this week'), () => { restore(undo); render(); });
    return;
  }
  if (weekClosed(U.week)) { closeSheet(); return; }
  if (kind === 'next') {
    const r = moveWeekTaskToNext(U.week, list, i);
    closeSheet();
    if (r.error) { toast(r.error); return; }
    render();
    toastUndo(tr('Pasó a la próxima semana', 'Moved to next week'), () => { restore(undo); render(); });
    return;
  }
  removeWeekTask(U.week, list, i);
  closeSheet();
  render();
  toastUndo(tr('Tarea eliminada de la semana', 'Task deleted from the week'), () => { restore(undo); render(); });
}

// ——— Hábitos ———
const FREQ_PRESETS = () => [['all', tr('Todos los días', 'Every day'), [0, 1, 2, 3, 4, 5, 6]], ['wk', tr('Lunes a viernes', 'Weekdays'), [0, 1, 2, 3, 4]], ['we', tr('Fin de semana', 'Weekends'), [5, 6]]];
export function habitEditor(id) {
  const h = S.h.find(x => x.id === id);
  const draft = { name: h?.name || '', color: h?.color ?? 2, mode: h && isWeekly(h) ? 'week' : 'days', days: h?.days || [0, 1, 2, 3, 4, 5, 6], perWeek: h?.perWeek || 3 };
  const draw = () => {
    const days = DAY_SHORT.map((d, i) => `<button type="button" class="choice${draft.days.includes(i) ? ' on' : ''}" data-day="${i}" aria-pressed="${draft.days.includes(i)}">${d.slice(0, 1)}</button>`).join('');
    const presets = FREQ_PRESETS().map(([k, label, list]) => `<button type="button" class="choice${draft.days.join() === list.join() ? ' on' : ''}" data-preset="${k}">${label}</button>`).join('');
    const times = tr(`${draft.perWeek === 1 ? 'vez' : 'veces'} por semana, cualquier día`, `${draft.perWeek === 1 ? 'time' : 'times'} a week, any day`);
    openSheet(h ? tr('Editar hábito', 'Edit habit') : tr('Nuevo hábito', 'New habit'), `<form id="habitForm">
      <div class="field"><label for="habitName">${tr('¿Qué quieres hacer?', 'What do you want to do?')}</label><input id="habitName" class="input" required maxlength="100" autocapitalize="none" placeholder="${tr('Leer 10 páginas, caminar, meditar…', 'Read 10 pages, walk, meditate…')}" value="${esc(draft.name)}"></div>
      <div class="field"><span class="field-label">${tr('Frecuencia', 'Frequency')}</span><div class="seg" style="margin-bottom:10px"><button type="button" class="${draft.mode === 'days' ? 'on' : ''}" data-mode="days">${tr('Días fijos', 'Set days')}</button><button type="button" class="${draft.mode === 'week' ? 'on' : ''}" data-mode="week">${tr('Veces por semana', 'Times a week')}</button></div>
        ${draft.mode === 'days' ? `<div class="choices" style="margin-bottom:8px">${presets}</div><div class="day-choices">${days}</div>`
          : `<div class="stepper"><button type="button" data-step="-1" aria-label="${tr('Menos', 'Fewer')}">−</button><b>${draft.perWeek}</b><button type="button" data-step="1" aria-label="${tr('Más', 'More')}">+</button><span class="muted">${times}</span></div>`}</div>
      <div class="field"><span class="field-label">${tr('Área de tu vida', 'Area of your life')}</span><div class="choices">${CATEGORY_ORDER.map(i => `<button type="button" class="choice${draft.color === i ? ' on' : ''}" data-color="${i}" style="--c:${categoryColor(i)}"><i></i>${categoryName(i)}</button>`).join('')}</div></div>
      <button class="btn" type="submit">${h ? tr('Guardar cambios', 'Save changes') : tr('Crear hábito', 'Create habit')}</button>
      ${h ? `<button class="btn danger" type="button" data-a="habitdelete" data-id="${esc(h.id)}" style="margin-top:8px">${tr('Eliminar hábito', 'Delete habit')}</button>` : ''}
    </form>`, dlg => {
      const form = $('#habitForm', dlg);
      const keep = () => { draft.name = $('#habitName', dlg).value; };
      form.addEventListener('click', e => {
        const b = e.target.closest('button[type=button]');
        if (!b || b.dataset.a) return;
        keep();
        if (b.dataset.mode) draft.mode = b.dataset.mode;
        if (b.dataset.preset) draft.days = FREQ_PRESETS().find(([k]) => k === b.dataset.preset)[2].slice();
        if (b.dataset.day) { const d = +b.dataset.day; draft.days = draft.days.includes(d) ? draft.days.filter(x => x !== d) : [...draft.days, d].sort(); }
        if (b.dataset.step) draft.perWeek = Math.min(7, Math.max(1, draft.perWeek + +b.dataset.step));
        if (b.dataset.color) draft.color = +b.dataset.color;
        draw();
        $('#habitName', sheet())?.focus({ preventScroll: true });
      });
      form.addEventListener('submit', e => {
        e.preventDefault();
        keep();
        if (!draft.name.trim()) { toast(tr('Ponle un nombre al hábito.', 'Give the habit a name.')); return; }
        if (draft.mode === 'days' && !draft.days.length) { toast(tr('Elige al menos un día.', 'Pick at least one day.')); return; }
        saveHabit({ id: h?.id, name: draft.name, color: draft.color, days: draft.mode === 'days' ? draft.days : undefined, perWeek: draft.mode === 'week' ? draft.perWeek : undefined });
        closeSheet();
        render();
        toast(h ? tr('Hábito actualizado', 'Habit updated') : tr('Hábito creado', 'Habit created'));
      });
    });
  };
  draw();
  if (!h) setTimeout(() => $('#habitName')?.focus(), 50);
}

export function habitDetail(id, month = today().slice(0, 7)) {
  const h = S.h.find(x => x.id === id);
  if (!h) return;
  const T = today(), [y, mo] = month.split('-').map(Number), offset = weekday(new Date(y, mo - 1, 1)), n = daysInMonth(month);
  let cells = DAY_SHORT.map(d => `<span class="wd">${d.slice(0, 1)}</span>`).join('');
  for (let i = 0; i < offset; i++) cells += '<span></span>';
  let monthDone = 0;
  for (let d = 1; d <= n; d++) {
    const k = `${month}-${p2(d)}`, on = isDone(h, k), future = k > T, before = h.createdOn && k < h.createdOn;
    if (on) monthDone++;
    cells += `<button class="${on ? 'on' : ''}${k === T ? ' today' : ''}${future ? ' off' : ''}" data-a="habitday" data-id="${esc(id)}" data-date="${k}" data-month="${month}"${future ? ' disabled' : ''} aria-pressed="${on}" aria-label="${d}"${before && !on ? ' style="opacity:.5"' : ''}>${d}</button>`;
  }
  const s = streak(h, T), pct = consistency(h, T);
  openSheet(`<span class="caps">${esc(h.name)}</span>`, `<p class="muted small" style="margin:-4px 0 14px">${frequencyLabel(h)} · ${categoryName(h.color ?? 0)}</p>
    <div class="stats"><div class="stat"><b>${s.n}</b><small>${s.unit} ${tr('de racha', 'streak')}</small></div><div class="stat"><b>${pct ?? '—'}${pct !== null ? '%' : ''}</b><small>${tr('constancia, 4 sem.', 'consistency, 4 wks')}</small></div><div class="stat"><b>${monthDone}</b><small>${tr('este mes', 'this month')}</small></div></div>
    <div class="week-strip" style="margin:0 0 10px"><button class="nav" data-a="habitmonth" data-id="${esc(id)}" data-month="${shiftMonth(month, -1)}" aria-label="${tr('Mes anterior', 'Previous month')}">${icon('left')}</button><div style="flex:1;text-align:center;font-weight:600;text-transform:capitalize">${monthYear(month)}</div><button class="nav" data-a="habitmonth" data-id="${esc(id)}" data-month="${shiftMonth(month, 1)}" aria-label="${tr('Mes siguiente', 'Next month')}"${month >= T.slice(0, 7) ? ' disabled' : ''}>${icon('right')}</button></div>
    <div class="heat" style="--c:${categoryColor(h.color ?? 0)}">${cells}</div>
    <p class="muted small" style="margin:12px 2px 18px">${tr('Toca un día para marcarlo o desmarcarlo.', 'Tap a day to mark or unmark it.')}</p>
    <button class="btn secondary" data-a="habitedit" data-id="${esc(id)}">${icon('edit')}${tr('Editar hábito', 'Edit habit')}</button>`);
}
export function habitDayToggle(id, date, month) {
  const h = S.h.find(x => x.id === id);
  if (!h) return;
  toggle(h, date);
  habitDetail(id, month);
  render();
}
/** Opciones de un hábito: historial, editar o eliminar. */
export function habitMenu(id) {
  const h = S.h.find(x => x.id === id);
  if (!h) return;
  openSheet(`<span class="caps">${esc(h.name)}</span>`, `<p class="muted small" style="margin:-4px 0 12px">${frequencyLabel(h)} · ${categoryName(h.color ?? 0)}</p><div class="menu">
    <button data-a="habitopen" data-id="${esc(id)}">${icon('calendar')}${tr('Ver historial', 'See history')}</button>
    <button data-a="habitedit" data-id="${esc(id)}">${icon('edit')}${tr('Editar', 'Edit')}</button>
    <button class="danger" data-a="habitdelete" data-id="${esc(id)}">${icon('trash')}${tr('Eliminar', 'Delete')}</button></div>`);
}
/** Elimina el hábito y su historial, con opción de deshacer. */
export function confirmDeleteHabit(id) {
  const h = S.h.find(x => x.id === id);
  if (!h) return;
  const undo = { h: structuredClone(S.h), hl: structuredClone(S.hl) };
  deleteHabit(id);
  closeSheet();
  render();
  toastUndo(tr(`«${h.name}» eliminado`, `“${h.name}” deleted`), () => { S.h = undo.h; S.hl = undo.hl; save(); render(); });
}

// ——— Eventos ———
export function eventEditor(date, index = null) {
  const current = index === null ? null : S.ev[date]?.[index];
  if (index !== null && !current) return;
  const draft = current ? { ...current } : { t: '', h: '', c: -1 };
  const pd = parseDate(date), optional = `<span class="muted">(${tr('opcional', 'optional')})</span>`;
  openSheet(current ? tr('Editar evento', 'Edit event') : tr('Nuevo evento', 'New event'), `<form id="eventForm">
    <p class="muted small" style="margin:-4px 0 14px">${draft.to && draft.to > date ? rangeLabel(date, draft.to) : `${DAYS[weekday(pd)]} · ${dayMonth(pd)}`}</p>
    <div class="field"><label for="eventTitle">${tr('¿Qué tienes?', 'What do you have?')}</label><input id="eventTitle" class="input" required maxlength="200" placeholder="${tr('Reunión, cumpleaños, médico…', 'Meeting, birthday, doctor…')}" value="${esc(draft.t)}"></div>
    <div class="field"><label for="eventHour">${tr('Hora', 'Time')} ${optional}</label><input id="eventHour" class="input" type="time" step="300" value="${esc(draft.h || '')}"></div>
    <div class="field"><label for="eventTo">${tr('Hasta', 'Until')} ${optional}</label><input id="eventTo" class="input" type="date" min="${shiftDate(date, 1)}" max="${shiftDate(date, MAX_EVENT_DAYS - 1)}" value="${esc(draft.to || '')}"><p class="prompt-hint">${tr('Para algo de varios días, como un viaje o unas vacaciones.', 'For something that lasts several days, like a trip or a holiday.')}</p></div>
    <div class="field"><span class="field-label">${tr('Área', 'Area')} ${optional}</span><div class="choices">${CATEGORY_ORDER.map(i => `<label class="choice" style="--c:${categoryColor(i)}"><input type="radio" name="eventCategory" value="${i}"${draft.c === i ? ' checked' : ''}><i></i>${categoryName(i)}</label>`).join('')}</div></div>
    <button class="btn" type="submit">${current ? tr('Guardar', 'Save') : tr('Añadir evento', 'Add event')}</button>
    ${current ? `<button class="btn danger" type="button" id="eventDelete" style="margin-top:8px">${tr('Eliminar evento', 'Delete event')}</button>` : ''}</form>`, dlg => {
    const radios = $$('input[name=eventCategory]', dlg);
    // La categoría es opcional: tocar la elegida la desmarca.
    radios.forEach(r => { r.dataset.was = String(r.checked); r.addEventListener('click', () => { if (r.dataset.was === 'true') { r.checked = false; r.dataset.was = 'false'; } else radios.forEach(o => { o.dataset.was = String(o === r); }); }); });
    $('#eventForm', dlg).addEventListener('submit', e => {
      e.preventDefault();
      const t = $('#eventTitle', dlg).value.trim(), h = $('#eventHour', dlg).value, c = Number(radios.find(r => r.checked)?.value ?? -1);
      const to = $('#eventTo', dlg).value;
      if (!t) { toast(tr('Escribe qué tienes.', 'Write what you have.')); return; }
      if (to && to <= date) { toast(tr('La fecha final tiene que ser después del primer día.', 'The end date has to be after the first day.')); return; }
      if (to && to > shiftDate(date, MAX_EVENT_DAYS - 1)) { toast(tr('Un evento puede durar hasta un año.', 'An event can last up to a year.')); return; }
      const event = to ? { t, h, c, to } : { t, h, c };
      const list = S.ev[date] = S.ev[date] || [];
      if (index === null) list.push(event); else list[index] = event;
      save();
      closeSheet();
      render();
      toast(current ? tr('Evento guardado', 'Event saved') : tr('Evento añadido', 'Event added'));
    });
    $('#eventDelete', dlg)?.addEventListener('click', () => {
      const undo = structuredClone(S.ev[date]);
      S.ev[date].splice(index, 1);
      save();
      closeSheet();
      render();
      toastUndo(tr('Evento eliminado', 'Event deleted'), () => { S.ev[date] = undo; save(); render(); });
    });
    if (!current) setTimeout(() => $('#eventTitle', dlg)?.focus(), 50);
  });
}

// ——— Bienvenida (primera vez) ———
export function welcome() {
  if (S.cfg.welcomed) return;
  openSheet(tr('Te damos la bienvenida a Focus', 'Welcome to Focus'), `<p style="margin:0 0 18px;color:var(--ink-2)">${tr('Un diario para organizar lo importante, sostener tus hábitos y darte un momento para pensar cómo estás viviendo.', 'A journal to organize what matters, keep your habits and give yourself a moment to think about how you are living.')}</p>
    <div class="pillars">
      <div class="pillar"><span class="ritual-icon">${icon('today')}</span><div><strong>${tr('Hoy', 'Today')}</strong><p>${tr('Empieza con una intención, elige hasta tres tareas en foco y cierra el día con una línea.', 'Start with an intention, pick up to three focus tasks and close the day with one line.')}</p></div></div>
      <div class="pillar"><span class="ritual-icon">${icon('week')}</span><div><strong>${tr('Plan', 'Plan')}</strong><p>${tr('Tu semana y tu mes: define lo que importa y repártelo en los días con un toque.', 'Your week and month: decide what matters and spread it across the days with a tap.')}</p></div></div>
      <div class="pillar"><span class="ritual-icon">${icon('habits')}</span><div><strong>${tr('Hábitos', 'Habits')}</strong><p>${tr('Constancia, no perfección: si fallas un día, retomas al siguiente.', 'Consistency, not perfection: miss a day, pick it up the next.')}</p></div></div>
      <div class="pillar"><span class="ritual-icon evening">${icon('journal')}</span><div><strong>${tr('Diario', 'Journal')}</strong><p>${tr('Todo lo que escribes queda aquí para volver a leerlo.', 'Everything you write stays here to read again.')}</p></div></div>
    </div>${appearancePicker()}<button class="btn" data-a="welcomed">${tr('Empezar', 'Get started')}</button>`);
}

// Elegir la apariencia en la bienvenida: dos muestras (clara y oscura) y la opción de seguir al celular.
// Cada muestra usa colores fijos de su modo, para que se vea igual sin importar el modo actual.
const SWATCH = { light: ['#F4F1EB', '#FBFAF7', '#1E2321', '#2F5D4E', '#E3DDD2'], dark: ['#111413', '#191D1B', '#ECE8E1', '#F2C94C', '#2A302D'] };
function swatch(mode) {
  const [bg, card, ink, acc, line] = SWATCH[mode];
  return `<span class="swatch" style="--sb:${bg};--sc:${card};--si:${ink};--sa:${acc};--sl:${line}" aria-hidden="true">
    <i class="sw-title"></i><span class="sw-card"><i class="sw-check"></i><i class="sw-line"></i></span><span class="sw-card"><i class="sw-check on"></i><i class="sw-line short"></i></span></span>`;
}
export function appearancePicker() {
  const pref = S.cfg.appearance || 'auto';
  const card = (k, label) => `<button type="button" class="look${pref === k ? ' on' : ''}" data-a="appearance" data-k="${k}" aria-pressed="${pref === k}">${swatch(k)}<span>${label}</span></button>`;
  return `<div class="look-picker" data-looks><span class="field-label">${tr('¿Cómo prefieres verla?', 'How would you like it to look?')}</span>
    <div class="looks">${card('light', tr('Clara', 'Light'))}${card('dark', tr('Oscura', 'Dark'))}</div>
    <button type="button" class="link look-auto${pref === 'auto' ? ' on' : ''}" data-a="appearance" data-k="auto" aria-pressed="${pref === 'auto'}">${pref === 'auto' ? icon('check') : ''}${tr('Igual que mi celular', 'Same as my phone')}</button>
    <p class="prompt-hint" style="text-align:center;margin-top:2px">${tr('Puedes cambiarla cuando quieras en Ajustes.', 'You can change it anytime in Settings.')}</p></div>`;
}

// ——— Al cerrar el día: ¿pasar lo pendiente a mañana? ———
let undoClose = null;
/** Se abre al cerrar el día si quedaron tareas sin hacer. `undo` deshace el cierre. */
export function carryOverSheet(date, undo) {
  const { focus, rest } = dayTasks(date), pending = [...focus, ...rest].filter(t => !t.row.c);
  if (!pending.length) return false;
  undoClose = undo;
  const n = pending.length;
  openSheet(tr('Día cerrado. Bien hecho.', 'Day closed. Well done.'), `<p style="margin:0 0 12px;color:var(--ink-2)">${n === 1 ? tr('Te quedó una tarea sin terminar. ¿La pasas a mañana?', 'One task is left. Move it to tomorrow?') : tr(`Te quedaron ${n} tareas sin terminar. ¿Las pasas a mañana?`, `${n} tasks are left. Move them to tomorrow?`)}</p>
    <ul class="carry-list">${pending.map(t => `<li>${isFocusKey(t.key) ? icon('star', 'icon star-fill') : '<i class="dot"></i>'}<span class="caps">${esc(t.row.t)}</span></li>`).join('')}</ul>
    <button class="btn" data-a="carryover">${icon('tomorrow')}${tr('Pasar a mañana', 'Move to tomorrow')}</button>
    <button class="btn quiet" data-a="dismiss" style="margin-top:8px">${tr('Dejarlas aquí', 'Leave them here')}</button>
    <button type="button" class="link" data-a="closeundo" style="display:block;margin:12px auto 0">${tr('Deshacer el cierre del día', 'Undo closing the day')}</button>`);
  return true;
}
export function doCarryOver(date) {
  const { count, undo } = movePendingTo(date, shiftDate(date, 1));
  closeSheet();
  render();
  if (count) toastUndo(count === 1 ? tr('1 tarea pasó a mañana', '1 task moved to tomorrow') : tr(`${count} tareas pasaron a mañana`, `${count} tasks moved to tomorrow`), () => { restore(undo); render(); });
}
export function undoDayClose() {
  closeSheet();
  undoClose?.();
  undoClose = null;
}
