// Hojas inferiores: opciones de tarea, pendientes, hábito, evento, bienvenida.
// Todas usan el mismo <dialog id="sheet">; los ajustes tienen su propio diálogo en index.html.
import { S, save } from './state.js';
import { U, toast, toastUndo } from './ui.js';
import {
  bringOverdue, dropTask, getTask, isFocusKey, moveTask, overdue, removeTask, removeWeekTask, restore,
  snapshot, toggleFocus, toggleWeekFocus,
} from './tasks.js';
import { consistency, deleteHabit, frequencyLabel, isDone, isWeekly, saveHabit, streak, toggle } from './habits.js';
import { CATEGORY_ORDER, categoryColor, categoryName } from './categories.js';
import { icon } from './icons.js';
import { render } from './render.js';
import { $, $$, DAYS, DAY_SHORT, MONTHS, daysInMonth, esc, monthTitle, p2, parseDate, shiftDate, shiftMonth, today, weekday } from './util.js';

const sheet = () => $('#sheet');
export function openSheet(title, body, onMount) {
  const dlg = sheet();
  dlg.innerHTML = `<div class="sheet-grip" aria-hidden="true"></div><div class="sheet-head"><h2>${title}</h2><button class="icon-btn" data-a="dismiss" aria-label="Cerrar">${icon('close')}</button></div><div class="sheet-body">${body}</div>`;
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
  return `<div class="date-grid">${buttons}</div><div class="field" style="margin-top:10px"><label for="pickDate">Otra fecha</label><input id="pickDate" class="input" type="date" min="${T}"></div><button class="btn secondary" data-a="${action}" ${attrs} data-date="" data-from-input="1">Mover a esa fecha</button>`;
}

// ——— Tarea del día ———
export function taskMenu(date, key) {
  const row = getTask(date, key);
  if (!row) return;
  const focus = isFocusKey(key), tomorrow = shiftDate(date, 1);
  openSheet(`<span class="caps">${esc(row.t)}</span>`, `<div class="menu">
    <button data-a="taskmove" data-k="${key}" data-date="${tomorrow}">${icon('tomorrow')}Pasar a mañana</button>
    <button data-a="taskpick" data-k="${key}">${icon('calendar')}Elegir otro día</button>
    <button data-a="taskfocus" data-k="${key}" data-close="1">${icon('star')}${focus ? 'Quitar del foco' : 'Poner en foco'}</button>
    <button class="danger" data-a="taskdelete" data-k="${key}">${icon('trash')}Eliminar</button>
  </div>${row.source ? '<p class="muted small" style="margin:14px 2px 0">Viene de tu semana: al marcarla como hecha también se marca allí. Si cambias su nombre, dejan de estar vinculadas.</p>' : ''}`);
}
export function taskPick(date, key) {
  const row = getTask(date, key);
  if (row) openSheet('¿A qué día?', datePicker('taskmove', `data-k="${key}"`, date));
}
export function doMoveTask(date, key, target) {
  if (!target) { toast('Elige una fecha.'); return; }
  const result = moveTask(date, key, target);
  closeSheet();
  if (result.error) { toast(result.error); return; }
  render();
  const pd = parseDate(target);
  toastUndo(target === shiftDate(date, 1) ? 'Pasada a mañana' : `Movida al ${DAYS[weekday(pd)].toLowerCase()} ${pd.getDate()}`, () => { restore(result.undo); render(); });
}
export function doDeleteTask(date, key) {
  const undo = snapshot([date]);
  removeTask(date, key);
  closeSheet();
  render();
  toastUndo('Tarea eliminada', () => { restore(undo); render(); });
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
      <button class="btn small secondary" data-a="overduebring" data-date="${date}" data-k="${key}">Traer</button>
      <button class="btn small quiet" data-a="overduedrop" data-date="${date}" data-k="${key}" title="Ya no es pendiente; queda guardada en su día">Soltar</button></div>`;
  }).join('<div class="divider" style="margin:0"></div>');
  openSheet('Pendientes', `<p class="muted small" style="margin:0 0 12px">Trae a hoy lo que sigue importando. Suelta lo que ya no: queda guardado en su día, sin culpa.</p>${rows}
    <div class="row-actions"><button class="btn" data-a="overdueall">Traer todo a hoy</button></div>`);
}
export function overdueAction(kind, date, key) {
  const T = today();
  if (kind === 'all') {
    const { undo, count } = bringOverdue(T);
    closeSheet();
    render();
    toastUndo(`${count} ${count === 1 ? 'tarea traída' : 'tareas traídas'} a hoy`, () => { restore(undo); render(); });
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
  openSheet(`<span class="caps">${esc(row.t)}</span>`, `<div class="menu">
    <button data-a="weekmove" data-list="${list}" data-i="${i}">${icon('star')}${list === 'a' ? 'Pasar a «También esta semana»' : 'Pasar al foco de la semana'}</button>
    <button class="danger" data-a="weekdelete" data-list="${list}" data-i="${i}">${icon('trash')}Eliminar</button></div>
    <p class="muted small" style="margin:14px 2px 0">Eliminarla de la semana deja sus copias en los días, sin vínculo.</p>`);
}
export function weekAction(kind, list, i) {
  const undo = snapshot(Object.keys(S.d));
  if (kind === 'move') { const r = toggleWeekFocus(U.week, list, i); if (r.error) toast(r.error); closeSheet(); render(); return; }
  removeWeekTask(U.week, list, i);
  closeSheet();
  render();
  toastUndo('Tarea eliminada de la semana', () => { restore(undo); render(); });
}

// ——— Hábitos ———
const FREQ_PRESETS = [['all', 'Todos los días', [0, 1, 2, 3, 4, 5, 6]], ['wk', 'Lunes a viernes', [0, 1, 2, 3, 4]], ['we', 'Fin de semana', [5, 6]]];
export function habitEditor(id) {
  const h = S.h.find(x => x.id === id);
  const draft = { name: h?.name || '', color: h?.color ?? 2, mode: h && isWeekly(h) ? 'week' : 'days', days: h?.days || [0, 1, 2, 3, 4, 5, 6], perWeek: h?.perWeek || 3 };
  const draw = () => {
    const days = DAY_SHORT.map((d, i) => `<button type="button" class="choice${draft.days.includes(i) ? ' on' : ''}" data-day="${i}" aria-pressed="${draft.days.includes(i)}">${d.slice(0, 1)}</button>`).join('');
    const presets = FREQ_PRESETS.map(([k, label, list]) => `<button type="button" class="choice${draft.days.join() === list.join() ? ' on' : ''}" data-preset="${k}">${label}</button>`).join('');
    openSheet(h ? 'Editar hábito' : 'Nuevo hábito', `<form id="habitForm">
      <div class="field"><label for="habitName">¿Qué quieres hacer?</label><input id="habitName" class="input" required maxlength="100" autocapitalize="none" placeholder="Leer 10 páginas, caminar, meditar…" value="${esc(draft.name)}"></div>
      <div class="field"><span class="field-label">Frecuencia</span><div class="seg" style="margin-bottom:10px"><button type="button" class="${draft.mode === 'days' ? 'on' : ''}" data-mode="days">Días fijos</button><button type="button" class="${draft.mode === 'week' ? 'on' : ''}" data-mode="week">Veces por semana</button></div>
        ${draft.mode === 'days' ? `<div class="choices" style="margin-bottom:8px">${presets}</div><div class="day-choices">${days}</div>`
          : `<div class="stepper"><button type="button" data-step="-1" aria-label="Menos">−</button><b>${draft.perWeek}</b><button type="button" data-step="1" aria-label="Más">+</button><span class="muted">${draft.perWeek === 1 ? 'vez' : 'veces'} por semana, cualquier día</span></div>`}</div>
      <div class="field"><span class="field-label">Área de tu vida</span><div class="choices">${CATEGORY_ORDER.map(i => `<button type="button" class="choice${draft.color === i ? ' on' : ''}" data-color="${i}" style="--c:${categoryColor(i)}"><i></i>${categoryName(i)}</button>`).join('')}</div></div>
      <button class="btn" type="submit">${h ? 'Guardar cambios' : 'Crear hábito'}</button>
      ${h ? `<button class="btn danger" type="button" data-a="habitdelete" data-id="${esc(h.id)}" style="margin-top:8px">Eliminar hábito</button>` : ''}
    </form>`, dlg => {
      const form = $('#habitForm', dlg);
      const keep = () => { draft.name = $('#habitName', dlg).value; };
      form.addEventListener('click', e => {
        const b = e.target.closest('button[type=button]');
        if (!b || b.dataset.a) return;
        keep();
        if (b.dataset.mode) draft.mode = b.dataset.mode;
        if (b.dataset.preset) draft.days = FREQ_PRESETS.find(([k]) => k === b.dataset.preset)[2].slice();
        if (b.dataset.day) { const d = +b.dataset.day; draft.days = draft.days.includes(d) ? draft.days.filter(x => x !== d) : [...draft.days, d].sort(); }
        if (b.dataset.step) draft.perWeek = Math.min(7, Math.max(1, draft.perWeek + +b.dataset.step));
        if (b.dataset.color) draft.color = +b.dataset.color;
        draw();
        $('#habitName', sheet())?.focus({ preventScroll: true });
      });
      form.addEventListener('submit', e => {
        e.preventDefault();
        keep();
        if (!draft.name.trim()) { toast('Ponle un nombre al hábito.'); return; }
        if (draft.mode === 'days' && !draft.days.length) { toast('Elige al menos un día.'); return; }
        saveHabit({ id: h?.id, name: draft.name, color: draft.color, days: draft.mode === 'days' ? draft.days : undefined, perWeek: draft.mode === 'week' ? draft.perWeek : undefined });
        closeSheet();
        render();
        toast(h ? 'Hábito actualizado' : 'Hábito creado');
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
    <div class="stats"><div class="stat"><b>${s.n}</b><small>${s.unit} de racha</small></div><div class="stat"><b>${pct ?? '—'}${pct !== null ? '%' : ''}</b><small>constancia, 4 sem.</small></div><div class="stat"><b>${monthDone}</b><small>este mes</small></div></div>
    <div class="week-strip" style="margin:0 0 10px"><button class="nav" data-a="habitmonth" data-id="${esc(id)}" data-month="${shiftMonth(month, -1)}" aria-label="Mes anterior">${icon('left')}</button><div style="flex:1;text-align:center;font-weight:600;text-transform:capitalize">${monthTitle(month)}</div><button class="nav" data-a="habitmonth" data-id="${esc(id)}" data-month="${shiftMonth(month, 1)}" aria-label="Mes siguiente"${month >= T.slice(0, 7) ? ' disabled' : ''}>${icon('right')}</button></div>
    <div class="heat" style="--c:${categoryColor(h.color ?? 0)}">${cells}</div>
    <p class="muted small" style="margin:12px 2px 18px">Toca un día para marcarlo o desmarcarlo.</p>
    <button class="btn secondary" data-a="habitedit" data-id="${esc(id)}">${icon('edit')}Editar hábito</button>`);
}
export function habitDayToggle(id, date, month) {
  const h = S.h.find(x => x.id === id);
  if (!h) return;
  toggle(h, date);
  habitDetail(id, month);
  render();
}
export function confirmDeleteHabit(id) {
  const h = S.h.find(x => x.id === id);
  if (!h || !confirm(`¿Eliminar «${h.name}» y todo su historial? Esta acción no se puede deshacer.`)) return;
  deleteHabit(id);
  closeSheet();
  render();
  toast('Hábito eliminado');
}

// ——— Eventos ———
export function eventEditor(date, index = null) {
  const current = index === null ? null : S.ev[date]?.[index];
  if (index !== null && !current) return;
  const draft = current ? { ...current } : { t: '', h: '', c: -1 };
  const pd = parseDate(date);
  openSheet(current ? 'Editar evento' : 'Nuevo evento', `<form id="eventForm">
    <p class="muted small" style="margin:-4px 0 14px">${DAYS[weekday(pd)]} ${pd.getDate()} de ${MONTHS[pd.getMonth()]}</p>
    <div class="field"><label for="eventTitle">¿Qué tienes?</label><input id="eventTitle" class="input" required maxlength="200" placeholder="Reunión, cumpleaños, médico…" value="${esc(draft.t)}"></div>
    <div class="field"><label for="eventHour">Hora <span class="muted">(opcional)</span></label><input id="eventHour" class="input" type="time" step="300" value="${esc(draft.h || '')}"></div>
    <div class="field"><span class="field-label">Área <span class="muted">(opcional)</span></span><div class="choices">${CATEGORY_ORDER.map(i => `<label class="choice" style="--c:${categoryColor(i)}"><input type="radio" name="eventCategory" value="${i}"${draft.c === i ? ' checked' : ''}><i></i>${categoryName(i)}</label>`).join('')}</div></div>
    <button class="btn" type="submit">${current ? 'Guardar' : 'Añadir evento'}</button>
    ${current ? '<button class="btn danger" type="button" id="eventDelete" style="margin-top:8px">Eliminar evento</button>' : ''}</form>`, dlg => {
    const radios = $$('input[name=eventCategory]', dlg);
    // La categoría es opcional: tocar la elegida la desmarca.
    radios.forEach(r => { r.dataset.was = String(r.checked); r.addEventListener('click', () => { if (r.dataset.was === 'true') { r.checked = false; r.dataset.was = 'false'; } else radios.forEach(o => { o.dataset.was = String(o === r); }); }); });
    $('#eventForm', dlg).addEventListener('submit', e => {
      e.preventDefault();
      const t = $('#eventTitle', dlg).value.trim(), h = $('#eventHour', dlg).value, c = Number(radios.find(r => r.checked)?.value ?? -1);
      if (!t) { toast('Escribe qué tienes.'); return; }
      const list = S.ev[date] = S.ev[date] || [];
      if (index === null) list.push({ t, h, c }); else list[index] = { t, h, c };
      save();
      closeSheet();
      render();
      toast(current ? 'Evento guardado' : 'Evento añadido');
    });
    $('#eventDelete', dlg)?.addEventListener('click', () => {
      const undo = structuredClone(S.ev[date]);
      S.ev[date].splice(index, 1);
      save();
      closeSheet();
      render();
      toastUndo('Evento eliminado', () => { S.ev[date] = undo; save(); render(); });
    });
    if (!current) setTimeout(() => $('#eventTitle', dlg)?.focus(), 50);
  });
}

// ——— Bienvenida (primera vez) ———
export function welcome() {
  if (S.cfg.welcomed) return;
  openSheet('Te damos la bienvenida', `<p style="margin:0 0 18px;color:var(--ink-2)">Un diario para organizar lo importante, sostener tus hábitos y darte un momento para pensar cómo estás viviendo.</p>
    <div class="pillars">
      <div class="pillar"><span class="ritual-icon">${icon('today')}</span><div><strong>Hoy</strong><p>Empieza con una intención, elige hasta tres tareas en foco y cierra el día con una línea.</p></div></div>
      <div class="pillar"><span class="ritual-icon">${icon('week')}</span><div><strong>Semana</strong><p>Define lo que importa y repártelo en los días con un toque.</p></div></div>
      <div class="pillar"><span class="ritual-icon">${icon('habits')}</span><div><strong>Hábitos</strong><p>Constancia, no perfección: si fallas un día, retomas al siguiente.</p></div></div>
      <div class="pillar"><span class="ritual-icon evening">${icon('journal')}</span><div><strong>Diario</strong><p>Todo lo que escribes queda aquí para volver a leerlo.</p></div></div>
    </div><button class="btn" data-a="welcomed">Empezar</button>`);
}
