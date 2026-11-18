// Eventos de la interfaz: acciones por data-a, formularios rápidos, escritura, teclado y arrastre.
import { S, save, setPath } from './state.js';
import { U, applyTextSize, applyTheme, rememberPlan, runUndo, showToday, toast, toastUndo, tomorrowCard } from './ui.js';
import {
  addTask, addUndated, addWeekTask, dayTasks, getTask, renameTask, renameWeekTask, reorderTask, setDone, setWeekDone, toggleWeekDay,
  removeTask,
} from './tasks.js';
import { moveHabit, toggle as toggleHabit } from './habits.js';
import {
  closeSheet, confirmDeleteHabit, doDeleteTask, doMoveTask, doToggleFocus, eventEditor, habitDayToggle, habitDetail, habitMenu,
  habitEditor, overdueAction, overdueSheet, shortcutsSheet, taskMenu, taskPick, undatedDelete, undatedMenu, undatedMove, undatedPick, undatedTask,
  weekAction, weekMenu,
} from './sheets.js';
import { appearancePicker, carryOverSheet, doCarryOver, openSheet, undoDayClose } from './sheets.js';
import {
  forgotHTML, keypad, lockEnabled, lockMode, pressDelete, pressDigit, relock, sendForgotCode, startFlow, verifyForgotCode,
} from './lock.js';
import { autosize, focusEnd, render, renderNav } from './render.js';
import { dayClosed, weekClosed, canEditReview, canEditRitual, finishReview, finishRitual, hasContent, hasReview, reopenReview, reopenRitual, reviewState } from './rituals.js';
import { getLang, setLang, tr } from './i18n.js';
import { $, $$, shiftDate, shiftMonth, today, iso, monday, parseDate, weekLanding } from './util.js';

let canEdit = () => false;
let settleTimer = 0;

// ——— Ajustes ———
const TODAY_PREFS = () => [['intention', tr('Intención del día', 'Daily intention')], ['gratitude', tr('Gratitud', 'Gratitude')], ['habits', tr('Hábitos', 'Habits')], ['mood', tr('Ánimo del día', 'Daily mood')], ['reflection', tr('Reflexión', 'Reflection')], ['quote', tr('Frase del día', 'Quote of the day')], ['tomorrow', tr('Ofrecer organizar mañana (desde las 18:00)', 'Offer to plan tomorrow (from 6 pm)')]];
export function drawSettings() {
  $('#today-prefs').innerHTML = TODAY_PREFS().map(([k, label]) =>
    `<label class="toggle-row"><span>${label}</span><span class="switch"><input type="checkbox" data-a="todaypref" data-k="${k}"${(k === 'tomorrow' ? tomorrowCard() : showToday(k)) ? ' checked' : ''}><i></i></span></label>`).join('');
  const pref = S.cfg.appearance || 'auto';
  $$('[data-a=appearance]').forEach(b => { const on = b.dataset.k === pref; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  const size = S.cfg.textSize === 'large' ? 'large' : 'normal';
  $$('[data-a=textsize]').forEach(b => { const on = b.dataset.k === size; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
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
  shortcuts: () => shortcutsSheet(),
  welcomed: () => { S.cfg.welcomed = true; save(); closeSheet(); },
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
  planday: update(d => { const tomorrow = d.k === 'tomorrow'; U.date = shiftDate(today(), tomorrow ? 1 : 0); rememberPlan(tomorrow); }),
  openday: navigate(d => openDay(d.k)),
  shiftweek: d => shiftWeek(+d.n),
  fold: update(d => { U[d.k] = !U[d.k]; }),

  // Tareas del día
  taskdone: update(d => {
    const row = getTask(U.date, +d.k);
    if (!row) return;
    setDone(U.date, +d.k, !row.c);
    // Recién marcada, se queda un momento en su lugar (para ver el ✓) y luego baja al final.
    if (row.c) {
      U.settling = +d.k;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => { U.settling = null; if (U.tab === 'today') render(); }, 650);
    }
    const { focus } = dayTasks(U.date);
    if (row.c && focus.some(t => t.key === +d.k) && focus.every(t => t.row.c)) toast(tr('Foco del día completo. Bien hecho.', 'Today’s focus is done. Well done.'));
  }),
  taskfocus: d => { if (dayClosed(U.date)) return; doToggleFocus(U.date, +d.k); if (d.close) closeSheet(); },
  taskmenu: d => taskMenu(U.date, +d.k),
  taskpick: d => taskPick(U.date, +d.k),
  taskmove: d => doMoveTask(U.date, +d.k, d.fromInput ? $('#pickDate')?.value : d.date),
  taskundated: d => undatedTask(U.date, +d.k),
  undatedmenu: d => undatedMenu(+d.i),
  undatedpick: d => undatedPick(+d.i),
  undatedmove: d => undatedMove(+d.i, d.fromInput ? $('#pickDate')?.value : d.date),
  undateddelete: d => undatedDelete(+d.i),
  taskdelete: d => { if (!dayClosed(U.date)) doDeleteTask(U.date, +d.k); },
  overdue: () => overdueSheet(),
  overduebring: d => overdueAction('bring', d.date, +d.k),
  overduedrop: d => overdueAction('drop', d.date, +d.k),
  overdueundated: d => overdueAction('undated', d.date, +d.k),
  overdueall: () => overdueAction('all'),

  // Ánimo
  mood: update(d => { if (!canEditRitual(U.date, 'e')) return; const day = S.d[U.date] = S.d[U.date] || {}; const n = +d.k; if (day.mood === n) delete day.mood; else day.mood = n; save(); }),
  reviewdone: () => {
    const week = U.week;
    if (reviewState(week) !== 'ready') { render(); return; }
    if (!hasReview(week)) { toast(tr('Responde al menos una pregunta antes de terminar.', 'Answer at least one question before finishing.')); return; }
    document.activeElement?.blur?.();
    const undo = finishReview(week);
    U.review = false;
    render();
    toastUndo(tr('Semana revisada. Bien hecho.', 'Week reviewed. Well done.'), () => { undo(); U.review = true; render(); });
  },
  ritualdone: d => {
    const which = d.k, date = U.date;
    if (!canEditRitual(date, which)) { render(); return; }
    if (!hasContent(date, which)) { toast(which === 'm' ? tr('Escribe tu intención o tu gratitud antes de terminar.', 'Write your intention or gratitude before finishing.') : tr('Elige cómo estuvo tu día o escribe algo antes de cerrarlo.', 'Pick how your day was or write something before closing it.')); return; }
    document.activeElement?.blur?.();
    const undo = finishRitual(date, which);
    U[which === 'm' ? 'morning' : 'evening'] = false;
    render();
    const reopen = () => { undo(); U[which === 'm' ? 'morning' : 'evening'] = true; render(); };
    // Al cerrar el día, si quedaron tareas, se ofrece pasarlas a mañana (la hoja trae su propio «deshacer»).
    if (which === 'e' && carryOverSheet(date, reopen)) return;
    toastUndo(which === 'm' ? (date < today() ? tr('Listo. Quedó guardado.', 'Done. It’s saved.') : tr('Listo. Que tengas un buen día.', 'Done. Have a good day.')) : tr('Día cerrado. Bien hecho.', 'Day closed. Well done.'), reopen);
  },
  ritualedit: d => { if (reopenRitual(U.date, d.k)) U[d.k === 'm' ? 'morning' : 'evening'] = true; render(); },
  reviewedit: () => { if (reopenReview(U.week)) U.review = true; render(); },
  closeyesterday: () => {
    U.date = shiftDate(today(), -1); U.tab = 'today'; U.evening = true;
    render(true);
    $('[data-a="fold"][data-k="evening"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  },
  carryover: () => doCarryOver(U.date),
  closeundo: () => undoDayClose(),

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
  weekday: update(d => { if (weekClosed(U.week)) return; const r = toggleWeekDay(U.week, d.list, +d.i, d.k); if (r.error) toast(r.error); }),
  weekmenu: d => weekMenu(d.list, +d.i),
  weekmove: d => weekAction('move', d.list, +d.i),
  weeknext: d => weekAction('next', d.list, +d.i),
  weekthis: d => weekAction('this', d.list, +d.i),
  weekdelete: d => weekAction('delete', d.list, +d.i),
  calday: update(d => { U.calDay = d.k; }),
  thismonth: update(() => { U.month = today().slice(0, 7); U.calDay = today(); }),
  shiftmonth: update(d => shiftMonthBy(+d.n)),
  shiftjournal: update(d => { if (canMove('journal', +d.n)) U.journalMonth = shiftMonth(U.journalMonth, +d.n); }),
  journaltab: navigate(d => { U.journalTab = d.k; }),

  // Ajustes
  appearance: d => {
    S.cfg.appearance = d.k; save(); applyTheme(); drawSettings();
    const picker = $('#sheet [data-looks]'); // la bienvenida también permite elegirla
    if (picker) picker.outerHTML = appearancePicker();
  },
  textsize: d => {
    if (d.k === 'large') S.cfg.textSize = 'large'; else delete S.cfg.textSize;
    save(); applyTextSize(); drawSettings(); render();
  },
  lang: d => { S.cfg.lang = d.k === 'en' ? 'en' : 'es'; save(); setLang(S.cfg.lang); renderNav(); drawSettings(); render(); },
  todaypref: (d, b) => {
    S.cfg.today = { ...(S.cfg.today || {}), [d.k]: b.checked };
    if (d.k === 'tomorrow') { // la tarjeta «¿Qué día quieres organizar?»
      delete S.cfg.nav; // reemplaza a la opción «Navegación» de la prueba anterior
      if (!b.checked) { rememberPlan(false); if (U.tab === 'today' && U.date === shiftDate(today(), 1)) U.date = today(); }
    }
    save(); render();
  },
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
  const input = form.querySelector('input');
  if (!input.value.trim()) {
    // El botón «+» con el campo vacío lleva al campo (salvo justo después de guardar al salir de él).
    if (Date.now() - (+form.dataset.added || 0) > 800) input.focus();
    return;
  }
  if (!quickAdd(form)) return;
  // Tras añadir, el campo se suelta (en el celular se cierra el teclado); para otra, se toca «Añadir» de nuevo.
  document.activeElement?.blur?.();
  render();
}

/** Guarda lo escrito en una fila «Añadir…» (Hoy o Semana). Devuelve true si se añadió. */
function quickAdd(form) {
  const input = form.querySelector('input'), value = input.value.trim();
  if (!value) return false;
  if (form.dataset.form === 'addundated') {
    const r = addUndated(value);
    if (r.error) { toast(r.error); return false; }
  } else if (form.dataset.form === 'addtask') {
    if (dayClosed(U.date)) return false; // un día pasado no recibe tareas nuevas
    const focusFirst = dayTasks(U.date).focus.length === 0;
    addTask(U.date, value, { focus: focusFirst });
    if (focusFirst) toast(tr('Tu primera tarea quedó en foco ★', 'Your first task is in focus ★'));
  } else {
    if (weekClosed(U.week)) return false; // una semana pasada no recibe tareas nuevas
    const r = addWeekTask(U.week, form.dataset.list, value);
    if (r.error) { toast(r.error); return false; }
  }
  input.value = '';
  form.dataset.added = String(Date.now());
  return true;
}

/**
 * Al salir de una fila «Añadir…» con texto, la tarea se guarda sola: no hace falta Enter
 * (en el celular, el ✓ del teclado también la guarda). Se redibuja después del toque que
 * sacó el foco, para no quitarle el botón de debajo del dedo.
 */
function addOnLeave(form) {
  if (!quickAdd(form)) return;
  let done = false;
  const later = () => { if (done) return; done = true; document.removeEventListener('click', later, true); setTimeout(render); };
  document.addEventListener('click', later, true);
  setTimeout(later, 700);
}

// ——— Escritura ———
function onInput(e) {
  const el = e.target;
  autosize(el);
  if (!canEdit()) return;
  if (el.dataset.p) {
    // Lo de «Empieza/Cierra tu día» solo se guarda mientras está abierto (otro dispositivo pudo darlo por terminado).
    const m = /^d\.(\d{4}-\d{2}-\d{2})\.(i|g|r|hl|learn|remember|p)$/.exec(el.dataset.p);
    if (m && !canEditRitual(m[1], ['i', 'g'].includes(m[2]) ? 'm' : 'e')) { render(); return; }
    const w = /^w\.(\d{4}-\d{2}-\d{2})\.r\.\d+$/.exec(el.dataset.p);
    if (w && !canEditReview(w[1])) { render(); return; }
    setPath(el.dataset.p, el.value);
  }
  else if (el.dataset.taskText && !dayClosed(U.date)) renameTask(U.date, +el.dataset.taskText, el.value);
  else if (el.dataset.weekText && !weekClosed(U.week)) { const [list, i] = el.dataset.weekText.split('.'); renameWeekTask(U.week, list, +i, el.value); }
}
/** Una tarea que se queda sin texto al salir del campo se elimina. */
function onFocusOut(e) {
  const el = e.target;
  const addForm = el.closest?.('form[data-form="addtask"], form[data-form="addweek"], form[data-form="addundated"]');
  if (addForm) { if (canEdit() && !addForm.contains(e.relatedTarget)) addOnLeave(addForm); return; }
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
// ——— Atajos de teclado (computador): solo cuando no se está escribiendo ni hay una ventana abierta ———
const SHORTCUT_TABS = ['today', 'week', 'habits', 'journal'];
function shortcut(e) {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === '?') { shortcutsSheet(); return true; }
  if (/^[1-4]$/.test(k)) { ACTIONS.go({ k: SHORTCUT_TABS[k - 1] }); return true; }
  // Mayús + ↑/↓: sección anterior o siguiente, en el orden de la barra lateral; se detiene en los extremos.
  if (e.shiftKey && (k === 'ArrowUp' || k === 'ArrowDown')) {
    const i = SHORTCUT_TABS.indexOf(U.tab) + (k === 'ArrowDown' ? 1 : -1);
    if (i >= 0 && i < SHORTCUT_TABS.length) ACTIONS.go({ k: SHORTCUT_TABS[i] });
    return true;
  }
  if (k === 'h') { U.date = today(); U.week = iso(monday(new Date())); U.month = U.journalMonth = today().slice(0, 7); U.calDay = today(); render(); return true; }
  if (k === 'n') {
    if (U.tab === 'habits') { ACTIONS.habitnew(); return true; }
    if (U.tab === 'week' && U.weekMode === 'month') { ACTIONS.eventnew({}); return true; }
    const input = U.tab === 'today' ? $('[data-form="addtask"] input') : $$('[data-form="addweek"] input')[0];
    if (!input) return false;
    input.focus(); input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  }
  if (k === 'ArrowLeft' || k === 'ArrowRight') {
    const n = k === 'ArrowLeft' ? -1 : 1;
    if (U.tab === 'today') U.date = shiftDate(U.date, n);
    else if (U.tab === 'week' && U.weekMode === 'week') U.week = shiftDate(U.week, 7 * n);
    else if (U.tab === 'week') { ACTIONS.shiftmonth({ n }); return true; }
    else if (U.tab === 'journal' && !(n > 0 && U.journalMonth >= today().slice(0, 7))) U.journalMonth = shiftMonth(U.journalMonth, n);
    else return false;
    render();
    return true;
  }
  return false;
}

function onKeydown(e) {
  const el = e.target;
  if (e.key === 'Escape' && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && !el.closest('dialog')) { el.blur(); return; }
  if (e.key === 'Enter' && el.matches?.('[role=link][data-a]')) { e.preventDefault(); el.click(); return; }
  // Teclado físico sobre el teclado numérico del código.
  const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable;
  if (!typing && $('[data-keypad]') && canEdit()) {
    if (/^\d$/.test(e.key)) { e.preventDefault(); pressDigit(e.key); return; }
    if (e.key === 'Backspace') { e.preventDefault(); pressDelete(); return; }
  }
  // Con el teclado del código del Diario a la vista, los números van al código: ahí solo se permite
  // cambiar de sección con Mayús + ↑/↓.
  const sectionKey = e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown');
  if (!typing && canEdit() && !e.metaKey && !e.ctrlKey && !e.altKey && !$('dialog[open]') && (!$('[data-keypad]') || sectionKey) && shortcut(e)) { e.preventDefault(); return; }
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || !(el instanceof HTMLTextAreaElement)) return;
  if (!(el.dataset.p || el.dataset.taskText || el.dataset.weekText)) return;
  e.preventDefault();
  nextField(el);
}

// ——— Arrastrar para ordenar (pulsación sostenida en el asa) ———
// Reordenar: se mantiene presionada la tarjeta (o la manija, en los hábitos) y se arrastra.
// Al empezar a arrastrar se suelta el campo de texto, para que no aparezca el teclado ni la lupa.
function sortable({ handle, item, key, onDrop, ignore = 'button, a, input, [contenteditable]' }) {
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
    if (e.target.closest(ignore)) return; // los botones de la tarjeta siguen funcionando
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
      document.activeElement?.blur?.();
      getSelection?.()?.removeAllRanges();
      navigator.vibrate?.(8);
    }, e.target.closest('textarea') ? 380 : e.pointerType === 'mouse' ? 150 : 320);
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
    if (active) droppedAt = Date.now();
    clear();
    if (active && e.type === 'pointerup' && id !== target) onDrop(id, target);
  };
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', finish);
  // Mientras se arrastra, el dedo mueve la tarjeta y no la página.
  document.addEventListener('touchmove', e => { if (drag?.active) e.preventDefault(); }, { passive: false });
  // Un arrastre no debe terminar abriendo el campo de texto o un botón.
  document.addEventListener('click', e => { if (Date.now() - droppedAt < 400 && e.target.closest(item)) { e.preventDefault(); e.stopPropagation(); } }, true);
}
let droppedAt = 0;

// ——— Deslizar para cambiar de semana o de mes ———
// Zonas con data-swipe:
// «week» (franja de días en Hoy), «month» (calendario del Mes) y «plan» (cabecera de Plan y «Tu
// semana día a día»): tres paneles (anterior, actual, siguiente) que siguen al dedo; al soltar
// terminan de pasar al vecino o vuelven a su lugar.
// Izquierda → siguiente; derecha → anterior. En el computador funciona arrastrando con el mouse o
// deslizando con dos dedos en el trackpad.
const reduceMotion = () => matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const zoneOf = e => e.target.closest?.('[data-swipe]');
const place = (el, px, animate) => {
  el.style.transition = animate ? 'transform .26s cubic-bezier(.2,.7,.3,1)' : 'none';
  el.style.transform = `translateX(calc(-100% + 3 * var(--peek, 0px) + ${px}px))`; // --peek: lo que asoman los paneles vecinos
};
function shiftMonthBy(n) { U.month = shiftMonth(U.month, n); U.calDay = U.month === today().slice(0, 7) ? today() : U.month + '-01'; }
const MOVE = {
  // La semana nueva se abre en su lunes (o en hoy, si es la semana actual).
  week: n => { U.date = weekLanding(shiftDate(iso(monday(parseDate(U.date))), 7 * n)); },
  month: n => shiftMonthBy(n),
  plan: n => { if (U.weekMode === 'month') shiftMonthBy(n); else U.week = shiftDate(U.week, 7 * n); },
  journal: n => { U.journalMonth = shiftMonth(U.journalMonth, n); },
};
const canMove = (kind, n) => !(kind === 'journal' && n > 0 && U.journalMonth >= today().slice(0, 7));
/** Termina el paso al vecino (con animación) y vuelve a dibujar. `el`: los paneles que se arrastraron. */
function shiftZone(kind, n, el = $(`[data-swipe="${kind}"] > .strip-track`)) {
  if (!canMove(kind, n)) { if (el?.isConnected) { place(el, 0, true); el.parentElement.classList.remove('swiping'); } return; } // el Diario no pasa de este mes
  const go = () => { MOVE[kind](n); render(); };
  if (!el || reduceMotion()) { go(); return; }
  const width = el.firstElementChild.offsetWidth; // ancho de un panel
  el.parentElement.classList.add('swiping');
  let finished = false;
  const done = () => { if (!finished) { finished = true; go(); } };
  el.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 350); // por si el navegador no avisa del final de la transición
  place(el, -n * width, true);
}
const shiftWeek = n => shiftZone('week', n);
function swipeZones() {
  let drag = null, swipedAt = 0, wheel = 0, wheelAt = 0;
  document.addEventListener('pointerdown', e => {
    const zone = zoneOf(e);
    if (!zone || e.button > 0 || !canEdit() || e.target.closest('input, textarea, [contenteditable]') || !zone.querySelector(':scope > .strip-track')) return;
    const kind = zone.dataset.swipe;
    drag = { kind, x: e.clientX, y: e.clientY, id: e.pointerId, width: zone.offsetWidth, el: zone.querySelector(':scope > .strip-track'), moving: false, last: [[e.clientX, e.timeStamp]] };
  }, { passive: true });
  document.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id || !drag.el?.isConnected) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moving) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) { drag = null; return; } // es scroll vertical
      drag.moving = true;
      drag.el.parentElement.classList.add('swiping'); // los vecinos se ven completos mientras se arrastra
      try { e.target.setPointerCapture?.(e.pointerId); } catch { /* el puntero ya no está activo */ }
    }
    drag.last = [...drag.last.slice(-4), [e.clientX, e.timeStamp]];
    place(drag.el, dx, false);
  }, { passive: true });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const { kind, el, moving, x, last, width } = drag;
    drag = null;
    if (!moving) return;
    swipedAt = Date.now();
    const dx = e.clientX - x;
    const [x0, t0] = last[0], speed = (e.clientX - x0) / Math.max(1, e.timeStamp - t0); // px por ms
    const flick = Math.abs(speed) > 0.45 && Math.sign(speed) === Math.sign(dx);
    if (e.type === 'pointerup' && (Math.abs(dx) > width * 0.25 || (flick && Math.abs(dx) > 20))) shiftZone(kind, dx < 0 ? 1 : -1, el);
    else if (el?.isConnected) { place(el, 0, true); el.parentElement.classList.remove('swiping'); } // no alcanzó: vuelve a su lugar
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  // Un deslizamiento no debe contar además como toque sobre un día o un botón.
  document.addEventListener('click', e => {
    if (Date.now() - swipedAt < 450 && zoneOf(e)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('wheel', e => {
    const zone = zoneOf(e);
    if (!zone || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (Date.now() - wheelAt < 600) return;
    wheel += e.deltaX;
    if (Math.abs(wheel) < 50) return;
    const n = wheel > 0 ? 1 : -1;
    wheel = 0; wheelAt = Date.now();
    if (canEdit()) shiftZone(zone.dataset.swipe, n, zone.querySelector(':scope > .strip-track'));
  }, { passive: false });
}

export function initInteractions(isReady) {
  canEdit = isReady;
  watchSheetClose();
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('input', onInput);
  document.addEventListener('focusout', onFocusOut);
  document.addEventListener('keydown', onKeydown);
  swipeZones();
  sortable({ handle: '.task[data-sort]', item: '.task[data-task]', key: el => +el.dataset.task, onDrop: (a, b) => { if (reorderTask(U.date, a, b)) render(); } });
  sortable({ handle: '.habit[data-habit]', item: '.habit[data-habit]', key: el => el.dataset.habit, ignore: '.week-dot, .task-btn, a, input', onDrop: (a, b) => { if (moveHabit(a, b)) render(); } });
}
export { openSettings };
