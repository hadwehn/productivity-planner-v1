// Eventos de la interfaz: acciones por data-a, formularios rápidos, escritura, teclado y arrastre.
import { S, save, setPath } from './state.js';
import { U, applyTheme, runUndo, showToday, toast } from './ui.js';
import {
  addTask, addWeekTask, dayTasks, getTask, renameTask, renameWeekTask, reorderTask, setDone, setWeekDone, toggleWeekDay,
  removeTask,
} from './tasks.js';
import { moveHabit, toggle as toggleHabit } from './habits.js';
import {
  closeSheet, confirmDeleteHabit, doDeleteTask, doMoveTask, doToggleFocus, eventEditor, habitDayToggle, habitDetail, habitMenu,
  finishName, habitEditor, overdueAction, overdueSheet, taskMenu, taskPick, weekAction, weekMenu,
} from './sheets.js';
import { openSheet } from './sheets.js';
import {
  forgotHTML, keypad, lockEnabled, lockMode, pressDelete, pressDigit, relock, sendForgotCode, startFlow, verifyForgotCode,
} from './lock.js';
import { autosize, focusEnd, render, renderNav } from './render.js';
import { getLang, setLang, tr } from './i18n.js';
import { $, $$, shiftDate, shiftMonth, today, iso, monday, parseDate } from './util.js';

let canEdit = () => false;

// ——— Ajustes ———
const TODAY_PREFS = () => [['intention', tr('Intención del día', 'Daily intention')], ['gratitude', tr('Gratitud', 'Gratitude')], ['habits', tr('Hábitos', 'Habits')], ['mood', tr('Ánimo del día', 'Daily mood')], ['reflection', tr('Reflexión', 'Reflection')], ['quote', tr('Frase del día', 'Quote of the day')]];
export function drawSettings() {
  const nameField = $('#settings-name');
  if (nameField && document.activeElement !== nameField) nameField.value = S.cfg.name || '';
  $('#today-prefs').innerHTML = TODAY_PREFS().map(([k, label]) =>
    `<label class="toggle-row"><span>${label}</span><span class="switch"><input type="checkbox" data-a="todaypref" data-k="${k}"${showToday(k) ? ' checked' : ''}><i></i></span></label>`).join('');
  const pref = S.cfg.appearance || 'auto';
  $$('[data-a=appearance]').forEach(b => { const on = b.dataset.k === pref; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  for (const b of document.querySelectorAll('[data-a=lang]')) { const on = b.dataset.k === getLang(); b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }
  const locked = lockEnabled();
  $('#privacy-prefs').innerHTML = `<label class="toggle-row"><span>${tr('Proteger el Diario con código', 'Lock the Journal with a code')}</span><span class="switch"><input type="checkbox" data-a="journallock"${locked ? ' checked' : ''}><i></i></span></label>`
    + (locked ? `<div class="toggle-row"><button type="button" class="link" data-a="pinchange">${tr('Cambiar código', 'Change code')}</button></div>` : '');
}
function openSettings() { drawSettings(); $('#settings').showModal(); }

// ——— Código del Diario ———
const lockSheet = html => openSheet(tr('Código del Diario', 'Journal code'), html);
const sheetBody = html => { const body = $('#sheet .sheet-body'); if (body) body.innerHTML = html; };
document.addEventListener('planner:lock', () => {
  const body = $('#sheet[open] .sheet-body');
  if (body?.querySelector('[data-keypad]')) body.innerHTML = keypad();
  else if (U.tab === 'journal') render();
});
document.addEventListener('planner:settings', () => { if ($('#settings').open) drawSettings(); if (U.tab === 'journal') render(); });
document.addEventListener('planner:closesheet', () => closeSheet());
// Si se cierra la hoja a mitad de crear, cambiar o quitar el código, el teclado vuelve a «desbloquear».
function watchSheetClose() {
  $('#sheet').addEventListener('close', () => { if (lockMode() !== 'unlock') { relock(); if (U.tab === 'journal') render(); } });
}

// El Diario pide el código al abrir la app (o al volver a ella), no al cambiar de pestaña.
const navigate = fn => (d, b) => { fn(d, b); render(true); };
const update = fn => (d, b) => { fn(d, b); render(); };
const openDay = date => { U.date = date; U.tab = 'today'; };

const ACTIONS = {
  dismiss: (d, b) => b.closest('dialog')?.close(),
  undo: () => runUndo(),
  settings: () => openSettings(),
  welcomed: () => { S.cfg.welcomed = true; save(); closeSheet(); },
  nameskip: () => finishName(''),
  export: () => document.dispatchEvent(new CustomEvent('planner:download')),

  // Código del Diario
  journallock: (d, b) => { b.checked = lockEnabled(); lockSheet(startFlow(lockEnabled() ? 'disable' : 'create')); },
  pinchange: () => lockSheet(startFlow('change')),
  pin: d => pressDigit(d.k),
  pindel: () => pressDelete(),
  pinforgot: () => lockSheet(forgotHTML()),
  forgotsend: async () => {
    try { await sendForgotCode(); sheetBody(forgotHTML(true)); setTimeout(() => $('#forgotCode')?.focus(), 50); }
    catch (error) { sheetBody(forgotHTML(false, tr('No pudimos enviar el código: ', 'We couldn’t send the code: ') + error.message)); }
  },

  // Navegación
  // Tocar «Hoy» estando en Hoy vuelve al día de hoy.
  go: navigate(d => { if (d.k === 'today' && U.tab === 'today') U.date = today(); U.tab = d.k; }),
  date: update(d => { U.date = d.k; }),
  openday: navigate(d => openDay(d.k)),
  shiftweek: update(d => { U.date = shiftDate(U.date, 7 * d.n); }),
  fold: update(d => { U[d.k] = !U[d.k]; }),

  // Tareas del día
  taskdone: update(d => {
    const row = getTask(U.date, +d.k);
    if (!row) return;
    setDone(U.date, +d.k, !row.c);
    const { focus } = dayTasks(U.date);
    if (row.c && focus.some(t => t.key === +d.k) && focus.every(t => t.row.c)) toast(tr('Foco del día completo. Bien hecho.', 'Today’s focus is done. Well done.'));
  }),
  taskfocus: d => { doToggleFocus(U.date, +d.k); if (d.close) closeSheet(); },
  taskmenu: d => taskMenu(U.date, +d.k),
  taskpick: d => taskPick(U.date, +d.k),
  taskmove: d => doMoveTask(U.date, +d.k, d.fromInput ? $('#pickDate')?.value : d.date),
  taskdelete: d => doDeleteTask(U.date, +d.k),
  overdue: () => overdueSheet(),
  overduebring: d => overdueAction('bring', d.date, +d.k),
  overduedrop: d => overdueAction('drop', d.date, +d.k),
  overdueall: () => overdueAction('all'),

  // Ánimo
  mood: update(d => { const day = S.d[U.date] = S.d[U.date] || {}; const n = +d.k; if (day.mood === n) delete day.mood; else day.mood = n; save(); }),

  // Eventos
  eventnew: d => eventEditor(d.k || (U.tab === 'week' ? U.calDay : U.date)),
  eventedit: d => eventEditor(d.k || (U.tab === 'week' ? U.calDay : U.date), +d.i),

  // Hábitos
  habittoggle: update(d => { const h = S.h.find(x => x.id === d.id); if (h) toggleHabit(h, d.date); }),
  habitnew: () => habitEditor(),
  habitopen: d => habitDetail(d.id),
  habitmenu: d => habitMenu(d.id),
  habitedit: d => habitEditor(d.id),
  habitdelete: d => confirmDeleteHabit(d.id),
  habitday: d => habitDayToggle(d.id, d.date, d.month),
  habitmonth: d => habitDetail(d.id, d.month),

  // Semana y mes
  planmode: navigate(d => { U.weekMode = d.k; }),
  shiftplan: update(d => { U.week = shiftDate(U.week, 7 * d.n); }),
  thisweek: update(() => { U.week = iso(monday(new Date())); }),
  weekdone: update(d => { const row = S.w[U.week]?.[d.list]?.[d.i]; if (row) setWeekDone(U.week, d.list, +d.i, !row.c); }),
  weekday: update(d => { const r = toggleWeekDay(U.week, d.list, +d.i, d.k); if (r.error) toast(r.error); }),
  weekmenu: d => weekMenu(d.list, +d.i),
  weekmove: d => weekAction('move', d.list, +d.i),
  weekdelete: d => weekAction('delete', d.list, +d.i),
  calday: update(d => { U.calDay = d.k; }),
  shiftmonth: update(d => { U.month = shiftMonth(U.month, +d.n); U.calDay = U.month === today().slice(0, 7) ? today() : U.month + '-01'; }),
  shiftjournal: update(d => { U.journalMonth = shiftMonth(U.journalMonth, +d.n); }),

  // Ajustes
  appearance: d => { S.cfg.appearance = d.k; save(); applyTheme(); drawSettings(); },
  lang: d => { S.cfg.lang = d.k === 'en' ? 'en' : 'es'; save(); setLang(S.cfg.lang); renderNav(); drawSettings(); render(); },
  todaypref: (d, b) => { S.cfg.today = { ...(S.cfg.today || {}), [d.k]: b.checked }; save(); render(); },
};

function onClick(e) {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const action = ACTIONS[b.dataset.a];
  if (!action) return;
  if (!canEdit() && !['dismiss', 'undo'].includes(b.dataset.a)) return;
  if (b.tagName !== 'INPUT') e.preventDefault();
  action(b.dataset, b, e);
}

// ——— Añadir rápido ———
function onSubmit(e) {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  if (!canEdit()) return;
  if (form.dataset.form === 'forgotverify') {
    const code = $('#forgotCode')?.value.trim();
    if (!code) return;
    verifyForgotCode(code)
      .then(() => { closeSheet(); render(); toast(tr('Listo: quitamos el código. Puedes crear uno nuevo en Ajustes.', 'Done: the code was removed. You can create a new one in Settings.')); })
      .catch(() => { sheetBody(forgotHTML(true, tr('El código no es válido o ya venció. Revisa el correo más reciente.', 'The code is invalid or expired. Check the most recent email.'))); });
    return;
  }
  if (form.dataset.form === 'name') { finishName(form.querySelector('input').value); return; }
  const input = form.querySelector('input'), value = input.value.trim();
  if (!value) return;
  if (form.dataset.form === 'addtask') {
    const focusFirst = dayTasks(U.date).focus.length === 0;
    addTask(U.date, value, { focus: focusFirst });
    if (focusFirst) toast(tr('Tu primera tarea quedó en foco ★', 'Your first task is in focus ★'));
  } else {
    const r = addWeekTask(U.week, form.dataset.list, value);
    if (r.error) { toast(r.error); return; }
  }
  render();
  // Se mantiene el cursor en el mismo campo para escribir la siguiente.
  const again = form.dataset.form === 'addtask' ? $('[data-form="addtask"] input') : $(`[data-form="addweek"][data-list="${form.dataset.list}"] input`);
  again?.focus({ preventScroll: true });
}

// ——— Escritura ———
function onInput(e) {
  const el = e.target;
  autosize(el);
  if (!canEdit()) return;
  if (el.id === 'settings-name') {
    const name = el.value.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (name) S.cfg.name = name; else delete S.cfg.name;
    S.cfg.nameAsked = true;
    save();
    if (U.tab === 'today') render();
    return;
  }
  if (el.dataset.p) setPath(el.dataset.p, el.value);
  else if (el.dataset.taskText) renameTask(U.date, +el.dataset.taskText, el.value);
  else if (el.dataset.weekText) { const [list, i] = el.dataset.weekText.split('.'); renameWeekTask(U.week, list, +i, el.value); }
}
/** Una tarea que se queda sin texto al salir del campo se elimina. */
function onFocusOut(e) {
  const el = e.target;
  if (!canEdit() || el.value === undefined || el.value.trim()) return;
  if (el.dataset.taskText) { removeTask(U.date, +el.dataset.taskText); setTimeout(render); }
  else if (el.dataset.weekText) { const [list, i] = el.dataset.weekText.split('.'); weekAction('delete', list, +i); }
}

// ——— Enter pasa al siguiente campo; Mayús+Enter salta de línea ———
function nextField(el) {
  const scope = el.closest('.tasks') || $('#v');
  const fields = $$('textarea, input:not([type=checkbox])', scope).filter(f => f.offsetParent !== null);
  const next = fields[fields.indexOf(el) + 1];
  if (next) focusEnd(next); else el.blur();
}
function onKeydown(e) {
  const el = e.target;
  if (e.key === 'Enter' && el.matches?.('[role=link][data-a]')) { e.preventDefault(); el.click(); return; }
  // Teclado físico sobre el teclado numérico del código.
  const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable;
  if (!typing && $('[data-keypad]') && canEdit()) {
    if (/^\d$/.test(e.key)) { e.preventDefault(); pressDigit(e.key); return; }
    if (e.key === 'Backspace') { e.preventDefault(); pressDelete(); return; }
  }
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || !(el instanceof HTMLTextAreaElement)) return;
  if (!(el.dataset.p || el.dataset.taskText || el.dataset.weekText)) return;
  e.preventDefault();
  nextField(el);
}

// ——— Arrastrar para ordenar (pulsación sostenida en el asa) ———
function sortable({ handle, item, key, onDrop }) {
  let drag = null, timer = null;
  const clear = () => {
    clearTimeout(timer);
    drag?.preview?.remove();
    document.body.classList.remove('is-dragging');
    $$('.dragging,.drop-target').forEach(el => el.classList.remove('dragging', 'drop-target'));
    drag = null;
  };
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest(handle);
    if (!h || !canEdit() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const source = h.closest(item);
    if (!source) return;
    drag = { id: key(source), target: key(source), pointer: e.pointerId, x: e.clientX, y: e.clientY, active: false };
    timer = setTimeout(() => {
      if (!drag) return;
      drag.active = true;
      document.body.classList.add('is-dragging');
      const rect = source.getBoundingClientRect(), clone = source.cloneNode(true);
      clone.classList.add('drag-preview');
      Object.assign(clone.style, { width: rect.width + 'px', left: rect.left + 'px', top: rect.top + 'px' });
      document.body.append(clone);
      Object.assign(drag, { preview: clone, dx: drag.x - rect.left, dy: drag.y - rect.top });
      source.classList.add('dragging');
      navigator.vibrate?.(8);
    }, e.pointerType === 'mouse' ? 150 : 320);
  });
  document.addEventListener('pointermove', e => {
    if (!drag || drag.pointer !== e.pointerId) return;
    if (!drag.active) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) clear(); return; }
    e.preventDefault();
    drag.preview.style.left = (e.clientX - drag.dx) + 'px';
    drag.preview.style.top = (e.clientY - drag.dy) + 'px';
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(item);
    $$('.drop-target').forEach(el => el.classList.remove('drop-target'));
    if (target && !target.classList.contains('drag-preview')) { drag.target = key(target); target.classList.add('drop-target'); }
    if (e.clientY > innerHeight - 110) scrollBy(0, 10); else if (e.clientY < 80) scrollBy(0, -10);
  }, { passive: false });
  const finish = e => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const { id, target, active } = drag;
    clear();
    if (active && e.type === 'pointerup' && id !== target) onDrop(id, target);
  };
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', finish);
}

export function initInteractions(isReady) {
  canEdit = isReady;
  watchSheetClose();
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('input', onInput);
  document.addEventListener('focusout', onFocusOut);
  document.addEventListener('keydown', onKeydown);
  sortable({ handle: '[data-drag]', item: '.task[data-task]:not(.focus)', key: el => +el.dataset.task, onDrop: (a, b) => { if (reorderTask(U.date, a, b)) render(); } });
  sortable({ handle: '[data-habit-drag]', item: '.habit[data-habit]', key: el => el.dataset.habit, onDrop: (a, b) => { if (moveHabit(a, b)) render(); } });
}
export { openSettings };
