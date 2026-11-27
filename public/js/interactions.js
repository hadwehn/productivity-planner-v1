// Eventos de la interfaz: acciones por data-a, formularios rápidos, escritura, teclado y arrastre.
import { S, save, setPath } from './state.js';
import { celebrate, celebrates } from './celebrate.js';
import { clearBack, goBack, initBackSwipe, pushBack } from './back.js';
import { U, applyTextSize, setAppearance, storedAppearance, runUndo, showToday, toast, toastUndo } from './ui.js';
import {
  addTask, addWeekTask, dayTasks, getTask, renameTask, renameWeekTask, reorderTask, setDone, setWeekDone, toggleWeekDay,
  removeTask, dropTask, snapshot, restore,
} from './tasks.js';
import { isDone, isDue, toggle as toggleHabit } from './habits.js';
import {
  closeSheet, clearNotesNow, habitOrderSheet, saveHabitOrder, notesSheet, confirmDeleteHabit, doDeleteTask, doMoveTask, doToggleFocus, eventEditor, habitDayToggle, habitDetail, habitMenu,
  habitEditor, overdueAction, overdueSheet, shortcutsSheet, taskMenu, taskPick, doTaskToWeek, doRepeatTask,
  weekAction, weekMenu,
} from './sheets.js';
import { appearancePicker, carryOverSheet, doCarryOver, openSheet, undoDayClose } from './sheets.js';
import {
  forgotHTML, keypad, lockEnabled, lockMode, pressDelete, pressDigit, relock, sendForgotCode, startFlow, verifyForgotCode,
} from './lock.js';
import { journalEntries } from './views/journal.js';
import { FOCUS_CARDS, autosize, focusEnd, focusRitual, rememberScroll, render, renderNav, restoreScroll, revealCard, savedScroll } from './render.js';
import { canEditIntent, canEditReview, canEditRitual, finishIntent, finishMonth, finishReview, finishRitual, hasContent, hasIntent, hasMonthText, hasReview, monthDone, reopenIntent, reopenMonth, reopenReview, reopenRitual, reviewState, isLockedDay, isLockedWeek } from './rituals.js';
import { getLang, setLang, tr } from './i18n.js';
import { $, $$, shiftDate, shiftMonth, today, iso, monday, parseDate, weekLanding } from './util.js';

let canEdit = () => false;

// ——— Ajustes ———
const TODAY_PREFS = () => [['intention', tr('Intención del día', 'Daily intention')], ['gratitude', tr('Gratitud', 'Gratitude')], ['habits', tr('Hábitos', 'Habits')], ['mood', tr('Ánimo del día', 'Daily mood')], ['reflection', tr('Reflexión', 'Reflection')], ['futureQuotes', tr('Frase en días futuros', 'Quote on future days')]];
export function drawSettings() {
  $('#today-prefs').innerHTML = TODAY_PREFS().map(([k, label]) =>
    `<label class="toggle-row"><span>${label}</span><span class="switch"><input type="checkbox" data-a="todaypref" data-k="${k}"${showToday(k) ? ' checked' : ''}><i></i></span></label>`).join('');
  const pref = storedAppearance();
  $$('[data-a=appearance]').forEach(b => { const on = b.dataset.k === pref; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  const style = S.cfg.taskStyle === 'cards' ? 'cards' : 'list';
  $$('[data-a=taskstyle]').forEach(b => { const on = b.dataset.k === style; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  const size = S.cfg.textSize === 'large' ? 'large' : 'normal';
  $$('[data-a=textsize]').forEach(b => { const on = b.dataset.k === size; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  for (const b of document.querySelectorAll('[data-a=lang]')) { const on = b.dataset.k === getLang(); b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }
  const locked = lockEnabled();
  $('#privacy-prefs').innerHTML = `<label class="toggle-row"><span>${tr('Proteger el Diario con código', 'Lock the Journal with a code')}</span><span class="switch"><input type="checkbox" data-a="journallock"${locked ? ' checked' : ''}><i></i></span></label>`
    + (locked ? `<div class="toggle-row"><button type="button" class="link" data-a="pinchange">${tr('Cambiar código', 'Change code')}</button></div>` : '');
}
function openSettings() { drawSettings(); $('#settings').showModal(); $('#settings').focus(); }

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
const navigate = fn => (d, b) => { rememberScroll(); fn(d, b); render(true); };
const update = fn => (d, b) => { fn(d, b); render(); };
const openDay = date => { U.date = date; U.tab = 'today'; };
/** Tras dibujar, lleva a la vista un bloque (y enfoca su primer campo si se pide). */
const revealLater = (sel, focus = false) => setTimeout(() => {
  const el = $(sel);
  if (!el) return;
  el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  if (focus) el.querySelector('textarea, input')?.focus({ preventScroll: true });
}, 60);

/** Abre Foco (p) o Lo mejor (h) del mes para escribir, guardando cómo estaba por si se sale sin guardar. */
function openMonth(key) {
  const ym = U.month, value = S.m[ym]?.[key];
  U.editing = `month-${key}:${ym}`;
  U.monthSnap = { id: `${key}:${ym}`, value: value === undefined ? null : structuredClone(value) };
}

const ACTIONS = {
  dismiss: (d, b) => b.closest('dialog')?.close(),
  undo: () => runUndo(),
  settings: () => openSettings(),
  shortcuts: () => shortcutsSheet(),
  notesopen: () => notesSheet(U.date),
  notesclear: () => clearNotesNow(),
  // «Listo» en las notas: se guardan al escribir; esto deja la anotación lista y cierra la hoja.
  notesdone: (d, b) => {
    const editor = $('#notesEditor'), written = editor && editor.textContent.trim();
    editor?.blur(); // al perder el foco se guarda lo último
    b.closest('dialog')?.close();
    if (written) toast(tr('Notas guardadas', 'Notes saved'));
  },
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
  // Otra sección: vuelve a donde la dejaste (ver rememberScroll). La misma sección: sube al inicio;
  // en Hoy, si ya estás arriba, vuelve al día de hoy.
  go: (d, b) => {
    // Desde la barra de secciones se empieza de cero; desde el contenido («Ver todo»), se puede volver.
    if (b?.closest?.('#nav')) clearBack(); else if (d.k !== U.tab) pushBack();
    if (d.k === U.tab) {
      if (scrollY > 4) { scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }); return; }
      // En otro día, vuelve a hoy (a donde lo dejaste, si fue hace poco: ver render).
      if (d.k === 'today' && U.date !== today()) { U.date = today(); render(); return; }
      render(true);
      return;
    }
    rememberScroll();
    U.tab = d.k;
    render(true);
    restoreScroll(savedScroll(d.k));
  },
  goback: () => goBack(),
  // Día cerrado: la tarea pendiente deja de aparecer como pendiente y queda en su día.
  taskleave: d => {
    const undo = snapshot([U.date]);
    dropTask(U.date, +d.k);
    closeSheet();
    render();
    toastUndo(tr('Quedó en su día.', 'It stays on its day.'), () => { restore(undo); render(); });
  },
  date: update(d => { U.date = d.k; }),
  // Desde el buscador del Diario, el día se abre en la tarjeta donde está lo buscado (data-f).
  openday: d => {
    if (U.tab !== 'today') pushBack(); // desde Plan, Hábitos o el Diario: se puede volver deslizando
    navigate(() => {
      openDay(d.k);
      U.foldsFor.today = d.k; U.editing = null;
      U.morning = d.f === 'morning'; U.evening = d.f === 'evening';
    })(d);
    if (d.f) setTimeout(() => revealCard(d.f), 60);
  },
  shiftweek: d => shiftWeek(+d.n),
  // Al abrir un ritual se pliegan los demás y sube al primer plano (ver focusRitual en render.js).
  fold: d => {
    const opening = !U[d.k], ritual = FOCUS_CARDS.includes(d.k);
    U[d.k] = opening;
    if (opening && ritual) for (const k of FOCUS_CARDS) if (k !== d.k) U[k] = false;
    render();
    if (opening && ritual) focusRitual(d.k);
  },

  // Tareas del día
  taskdone: update(d => {
    const row = getTask(U.date, +d.k);
    if (!row) return;
    setDone(U.date, +d.k, !row.c); // queda en su lugar hasta volver a la sección (ver tasksSection)
    const { focus } = dayTasks(U.date);
    if (row.c && focus.some(t => t.key === +d.k) && focus.every(t => t.row.c)) {
      toast(tr('Foco del día completo. Bien hecho.', 'Today’s focus is done. Well done.'));
      setTimeout(() => celebrate(`[data-a="taskdone"][data-k="${d.k}"]`, 'gold'), 30); // tras dibujar
    }
  }),
  taskfocus: d => { doToggleFocus(U.date, +d.k); if (d.close) closeSheet(); },
  taskmenu: d => taskMenu(U.date, +d.k),
  taskpick: d => taskPick(U.date, +d.k),
  taskmove: d => doMoveTask(U.date, +d.k, d.fromInput ? $('#pickDate')?.value : d.date),
  taskweek: d => doTaskToWeek(U.date, +d.k, d.w),
  taskrepeat: d => doRepeatTask(U.date, +d.k, d.date),
  taskdelete: d => { doDeleteTask(U.date, +d.k); },
  overdue: () => overdueSheet(),
  // Avisos de Hoy: llevan a la revisión de la semana o a «Lo mejor del mes», ya abiertos.
  reviewnow: navigate(d => { pushBack(); U.tab = 'week'; U.weekMode = 'week'; U.week = d.k; U.foldsFor.week = 'w' + d.k; U.review = true; U.weekIntent = false; setTimeout(() => focusRitual('review'), 60); }),
  monthbest: navigate(d => { pushBack(); U.tab = 'week'; U.weekMode = 'month'; U.month = d.k; revealLater('#month-best', true); }),
  overduebring: d => overdueAction('bring', d.date, +d.k),
  overduedrop: d => overdueAction('drop', d.date, +d.k),
  overdueweek: d => overdueAction('week', d.date, +d.k),
  overdueall: () => overdueAction('all'),
  overdueallmonday: () => overdueAction('allmonday'),
  overduemonday: d => overdueAction('monday', d.date, +d.k),

  // Ánimo
  mood: update(d => { if (!canEditRitual(U.date, 'e') && U.editing !== `e:${U.date}`) return; const day = S.d[U.date] = S.d[U.date] || {}; const n = +d.k; if (day.mood === n) delete day.mood; else day.mood = n; save(); }),
  reviewdone: () => {
    const week = U.week;
    if (reviewState(week) !== 'ready') { render(); return; }
    if (!hasReview(week)) { toast(tr('Responde al menos una pregunta antes de terminar.', 'Answer at least one question before finishing.')); return; }
    document.activeElement?.blur?.();
    const undo = finishReview(week);
    U.review = false;
    render();
    celebrate('.ritual-head[data-k="review"] .ritual-icon');
    toastUndo(tr('Semana cerrada. Bien hecho.', 'Week closed. Well done.'), () => { undo(); U.review = true; render(); });
  },
  intentdone: () => {
    const week = U.week;
    if (!canEditIntent(week)) { render(); return; }
    if (!hasIntent(week)) { toast(tr('Escribe tu intención antes de terminar.', 'Write your intention before finishing.')); return; }
    document.activeElement?.blur?.();
    const undo = finishIntent(week);
    U.weekIntent = false;
    render();
    toastUndo(tr('Listo. Que tengas una buena semana.', 'Done. Have a good week.'), () => { undo(); U.weekIntent = true; render(); });
  },
  intentedit: () => { U.editing = `intent:${U.week}`; U.weekIntent = true; render(); focusRitual('weekIntent'); },
  ritualdone: d => {
    const which = d.k, date = U.date;
    if (!canEditRitual(date, which)) { render(); return; }
    if (!hasContent(date, which)) { toast(which === 'm' ? tr('Escribe tu intención o tu gratitud antes de terminar.', 'Write your intention or gratitude before finishing.') : tr('Elige cómo estuvo tu día o escribe algo antes de cerrarlo.', 'Pick how your day was or write something before closing it.')); return; }
    document.activeElement?.blur?.();
    const undo = finishRitual(date, which);
    U[which === 'm' ? 'morning' : 'evening'] = false;
    render();
    const reopen = () => { undo(); U[which === 'm' ? 'morning' : 'evening'] = true; render(); };
    if (which === 'e') celebrate('.ritual-head[data-k="evening"] .ritual-icon');
    // Al cerrar hoy o ayer, si quedaron tareas, se ofrece pasarlas a mañana (o a hoy); la hoja trae su
    // propio «deshacer». Un día más antiguo solo se cierra: lo pendiente ya lo resuelve el aviso de
    // Pendientes en Hoy, y preguntarlo de nuevo al corregir un día viejo molestaba. La hoja espera a
    // que termine la celebración.
    if (which === 'e' && date >= shiftDate(today(), -1)) {
      const { focus, rest } = dayTasks(date);
      if ([...focus, ...rest].some(t => !t.row.c)) {
        setTimeout(() => { if (U.date === date && U.tab === 'today') carryOverSheet(date, reopen); }, celebrates() ? 900 : 0);
        return;
      }
    }
    toastUndo(which === 'm' ? (date < today() ? tr('Listo. Quedó guardado.', 'Done. It’s saved.') : tr('Listo. Que tengas un buen día.', 'Done. Have a good day.')) : tr('Día cerrado. Bien hecho.', 'Day closed. Well done.'), reopen);
  },
  // «Editar» no reabre el día ni la semana: solo permite corregir lo escrito, que sigue cerrado.
  ritualedit: d => { const key = d.k === 'm' ? 'morning' : 'evening'; U.editing = `${d.k}:${U.date}`; U[key] = true; render(); focusRitual(key); },
  reviewedit: () => { U.editing = `review:${U.week}`; U.review = true; render(); focusRitual('review'); },
  ritualsave: d => {
    const which = d.k, key = which === 'm' ? 'morning' : 'evening';
    document.activeElement?.blur?.();
    U.editing = null;
    // Si se borró todo, deja de estar terminado (no hay nada que leer).
    if (!hasContent(U.date, which)) reopenRitual(U.date, which); else U[key] = false;
    render();
    toast(tr('Guardado', 'Saved'));
  },
  reviewsave: () => {
    document.activeElement?.blur?.();
    U.editing = null;
    if (!hasReview(U.week)) reopenReview(U.week); else U.review = false;
    render();
    toast(tr('Guardado', 'Saved'));
  },
  // Foco del mes (p) y Lo mejor del mes (h).
  monthdone: d => {
    const ym = U.month, key = d.k;
    if (!hasMonthText(ym, key)) { toast(key === 'p' ? tr('Escribe al menos una prioridad del mes.', 'Write at least one priority for the month.') : tr('Escribe al menos una cosa que valió la pena.', 'Write at least one thing that was worth it.')); return; }
    document.activeElement?.blur?.();
    const undo = finishMonth(ym, key);
    U.editing = null; U.monthSnap = null;
    render();
    toastUndo(key === 'p' ? tr('Foco del mes listo.', 'Month focus set.') : tr('Lo mejor del mes, guardado.', 'Best of the month saved.'), () => { undo(); render(); });
  },
  // «Completar» y «Editar» guardan cómo estaba, para que la ✕ salga sin guardar (ver monthcancel).
  monthedit: d => { openMonth(d.k); render(); },
  monthfill: d => { openMonth(d.k); render(); $(`[data-p="m.${U.month}.${d.k}.0"]`)?.focus(); },
  monthcancel: d => {
    const ym = U.month, key = d.k;
    document.activeElement?.blur?.(); // primero se suelta el campo (guarda), después se vuelve atrás
    const snap = U.monthSnap?.id === `${key}:${ym}` ? U.monthSnap.value : undefined;
    if (snap !== undefined) {
      const m = S.m[ym] = S.m[ym] || {};
      if (snap === null) delete m[key]; else m[key] = snap;
      save();
    }
    U.editing = null; U.monthSnap = null;
    render();
  },
  monthsave: d => {
    document.activeElement?.blur?.();
    U.editing = null; U.monthSnap = null;
    if (!hasMonthText(U.month, d.k)) reopenMonth(U.month, d.k); // si se borró todo, deja de estar listo
    render();
    toast(tr('Guardado', 'Saved'));
  },
  intentsave: () => {
    document.activeElement?.blur?.();
    U.editing = null;
    if (!hasIntent(U.week)) reopenIntent(U.week); else U.weekIntent = false;
    render();
    toast(tr('Guardado', 'Saved'));
  },
  closeyesterday: () => {
    rememberScroll();
    pushBack();
    U.date = shiftDate(today(), -1); U.tab = 'today'; U.morning = false; U.evening = true;
    render(true);
    focusRitual('evening');
  },
  carryover: d => doCarryOver(U.date, d.date),
  closeundo: () => undoDayClose(),

  // Eventos
  eventnew: d => eventEditor(d.k || (U.tab === 'week' ? U.calDay : U.date)),
  eventedit: d => eventEditor(d.k || (U.tab === 'week' ? U.calDay : U.date), +d.i),

  // Hábitos
  habittoggle: update(d => {
    const h = S.h.find(x => x.id === d.id);
    if (!h) return;
    toggleHabit(h, d.date);
    // Al marcar el último hábito que tocaba ese día, una celebración sobre el que se tocó.
    const due = S.h.filter(x => isDue(x, d.date));
    if (isDone(h, d.date) && due.length && due.every(x => isDone(x, d.date))) {
      setTimeout(() => celebrate(document.querySelector(`[data-a="habittoggle"][data-id="${CSS.escape(d.id)}"][data-date="${d.date}"]`)?.querySelector('.dot, .ring, svg') || `[data-a="habittoggle"][data-id="${CSS.escape(d.id)}"][data-date="${d.date}"]`), 30);
    }
  }),
  habitnew: () => habitEditor(),
  habitopen: d => habitDetail(d.id),
  habitmenu: d => habitMenu(d.id),
  habitorder: () => habitOrderSheet(),
  habitorderdone: () => saveHabitOrder(),
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
  weeknext: d => weekAction('next', d.list, +d.i),
  weekthis: d => weekAction('this', d.list, +d.i),
  weekdelete: d => weekAction('delete', d.list, +d.i),
  weekgoal: d => weekAction(d.on ? 'goal' : 'ungoal', d.list, +d.i),
  calday: update(d => { U.calDay = d.k; }),
  thismonth: update(() => { U.month = today().slice(0, 7); U.calDay = today(); }),
  thisjournal: update(() => { U.journalMonth = today().slice(0, 7); }),
  shiftmonth: update(d => shiftMonthBy(+d.n)),
  shiftjournal: update(d => { if (canMove('journal', +d.n)) U.journalMonth = shiftMonth(U.journalMonth, +d.n); }),
  journaltab: navigate(d => { U.journalTab = d.k; }),
  journalclear: () => { U.journalQuery = ''; render(); $('[data-journal-search]')?.focus(); },

  // Ajustes
  appearance: d => {
    setAppearance(d.k); drawSettings();
    const picker = $('#sheet [data-looks]'); // la bienvenida también permite elegirla
    if (picker) picker.outerHTML = appearancePicker();
  },
  textsize: d => {
    if (d.k === 'large') S.cfg.textSize = 'large'; else delete S.cfg.textSize;
    save(); applyTextSize(); drawSettings(); render();
  },
  // Tareas como lista (por defecto) o como tarjetas; vale para Hoy y Plan, y se guarda en la cuenta.
  taskstyle: d => {
    if (d.k === 'cards') S.cfg.taskStyle = 'cards'; else delete S.cfg.taskStyle;
    save(); drawSettings(); render();
  },
  lang: d => { S.cfg.lang = d.k === 'en' ? 'en' : 'es'; save(); setLang(S.cfg.lang); renderNav(); drawSettings(); render(); },
  todaypref: (d, b) => {
    S.cfg.today = { ...(S.cfg.today || {}), [d.k]: b.checked };
    save(); render();
  },
};

// Registro cerrado (ver isLockedDay en rituals.js): estas acciones no cambian un día de hace más de
// 7 días ni una semana que terminó hace más de 7 días. La pantalla ya no las muestra ahí; esto evita
// que algo se cuele por otro camino. Sacar lo pendiente («Pasar a hoy/esta semana», «Dejar en su
// día») sí se permite.
const DAY_LOCKED = new Set(['taskdone', 'taskfocus', 'taskdelete']);
const WEEK_LOCKED = new Set(['weekdone', 'weekday', 'weekdelete', 'weekmove', 'weekgoal']);
function lockedAction(a, d) {
  if (DAY_LOCKED.has(a)) return isLockedDay(U.date);
  if (a === 'habittoggle' || a === 'habitday') return isLockedDay(d.date);
  if (a === 'eventnew' || a === 'eventedit') return isLockedDay(d.k || (U.tab === 'week' ? U.calDay : U.date));
  if (WEEK_LOCKED.has(a)) return isLockedWeek(U.week);
  return false;
}

function onClick(e) {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const action = ACTIONS[b.dataset.a];
  if (!action) return;
  if (!canEdit() && !['dismiss', 'undo'].includes(b.dataset.a)) return;
  if (lockedAction(b.dataset.a, b.dataset)) { e.preventDefault(); render(); return; }
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
  if ((form.dataset.form === 'addtask' && isLockedDay(U.date)) || (form.dataset.form === 'addweek' && isLockedWeek(U.week))) return false; // registro cerrado
  if (form.dataset.form === 'addtask') {
    const focusFirst = dayTasks(U.date).focus.length === 0;
    addTask(U.date, value, { focus: focusFirst });
    if (focusFirst) toast(tr('Tu primera tarea quedó en foco ★', 'Your first task is in focus ★'));
  } else {
    const r = addWeekTask(U.week, form.dataset.list, value);
    // Foco de la semana lleno: la tarea no se pierde, va a «También esta semana».
    if (r.full === 'a') {
      const r2 = addWeekTask(U.week, 'b', value);
      if (r2.error) { toast(r2.error); return false; }
      toast(tr('El foco ya tiene cinco: quedó en «También esta semana».', 'Focus already has five: it went to “Also this week”.'));
    } else if (r.error) { toast(r.error); return false; }
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
  // Buscar en el Diario: filtra al instante sin redibujar la pantalla (el campo no pierde el foco).
  if (el.matches?.('[data-journal-search]')) {
    U.journalQuery = el.value;
    const box = $('#journal-results');
    if (box) box.innerHTML = journalEntries();
    el.parentElement.querySelector('[data-a="journalclear"]')?.toggleAttribute('hidden', !el.value);
    return;
  }
  autosize(el);
  if (!canEdit()) return;
  if (el.dataset.p) {
    // Lo de «Empieza/Cierra tu día» solo se guarda mientras está abierto (otro dispositivo pudo darlo por terminado).
    const m = /^d\.(\d{4}-\d{2}-\d{2})\.(i|g|r|hl|learn|remember|p)$/.exec(el.dataset.p);
    const which = m && (['i', 'g'].includes(m[2]) ? 'm' : 'e');
    if (m && !canEditRitual(m[1], which) && U.editing !== `${which}:${m[1]}`) { render(); return; }
    const w = /^w\.(\d{4}-\d{2}-\d{2})\.r\.\d+$/.exec(el.dataset.p);
    if (w && !canEditReview(w[1]) && U.editing !== `review:${w[1]}`) { render(); return; }
    const wi = /^w\.(\d{4}-\d{2}-\d{2})\.i$/.exec(el.dataset.p);
    if (wi && !canEditIntent(wi[1]) && U.editing !== `intent:${wi[1]}`) { render(); return; }
    const mm = /^m\.(\d{4}-\d{2})\.(p|h)\.\d$/.exec(el.dataset.p);
    if (mm && monthDone(mm[1], mm[2]) && U.editing !== `month-${mm[2]}:${mm[1]}`) { render(); return; }
    setPath(el.dataset.p, el.value);
  }
  else if (el.dataset.taskText) { if (isLockedDay(U.date)) { render(); return; } renameTask(U.date, +el.dataset.taskText, el.value); }
  else if (el.dataset.weekText) { if (isLockedWeek(U.week)) { render(); return; } const [list, i] = el.dataset.weekText.split('.'); renameWeekTask(U.week, list, +i, el.value); }
}
/** Una tarea que se queda sin texto al salir del campo se elimina. */
function onFocusOut(e) {
  const el = e.target;
  const addForm = el.closest?.('form[data-form="addtask"], form[data-form="addweek"]');
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

// ——— Deslizar una tarea (celular) ———
// Hacia la izquierda aparecen sus acciones rápidas (ver swipeActions en views/today.js y week.js).
// Pasada la mitad queda abierta; si no, vuelve. Tocar fuera, o deslizar otra, la cierra. Solo con el
// dedo: en computador está el menú ⋯. Un movimiento vertical se deja al desplazamiento de la página,
// y uno corto antes de la pulsación larga no interfiere con reordenar (ver sortable).
const SWIPE_BTN = 76;
function swipeRows() {
  let swipe = null, open = null, swipedAt = 0;
  const width = row => (row.querySelector('.swipe-actions')?.children.length || 0) * SWIPE_BTN;
  const setX = (row, x) => row.style.setProperty('--sx', `${x}px`);
  const close = row => { if (!row) return; row.classList.remove('swiped', 'swiping'); setX(row, 0); if (open === row) open = null; };
  document.addEventListener('pointerdown', e => {
    if (open && (!open.isConnected || !open.contains(e.target))) close(open);
    if (e.pointerType !== 'touch' || !canEdit()) return;
    const row = e.target.closest('[data-swipe-row]');
    if (!row || e.target.closest('.swipe-actions') || !width(row)) return;
    swipe = { row, id: e.pointerId, x: e.clientX, y: e.clientY, base: row === open ? -width(row) : 0, active: false };
  }, true);
  document.addEventListener('pointermove', e => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y, { row } = swipe, w = width(row);
    if (!swipe.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      swipe.active = true;
      row.classList.add('swiping');
      if (row.contains(document.activeElement)) document.activeElement.blur();
      try { row.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    }
    setX(row, Math.max(-w * 1.15, Math.min(0, swipe.base + dx)));
  });
  const end = e => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const { row, active, base, x } = swipe;
    swipe = null;
    if (!active) return;
    swipedAt = Date.now();
    row.classList.remove('swiping');
    const w = width(row), shown = Math.max(0, -(base + (e.clientX - x)));
    if (shown > w / 2) { if (open && open !== row) close(open); open = row; row.classList.add('swiped'); setX(row, -w); }
    else close(row);
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  // Justo después de deslizar, el toque no abre el campo de texto ni marca la tarea.
  document.addEventListener('click', e => {
    if (Date.now() - swipedAt < 350 && !e.target.closest('.swipe-actions')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}

// ——— Arrastrar para ordenar (pulsación sostenida en el asa) ———
// Reordenar: se mantiene presionada la tarjeta (o la manija, en los hábitos) y se arrastra.
// Al empezar a arrastrar se suelta el campo de texto, para que no aparezca el teclado ni la lupa.
function sortable({ handle, item, key, onDrop, ignore = 'button, a, input, [contenteditable]', delay }) {
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
      (source.closest('dialog') || document.body).append(clone); // dentro de una hoja abierta, para que se vea encima
      Object.assign(drag, { preview: clone, dx: drag.x - rect.left, dy: drag.y - rect.top });
      source.classList.add('dragging');
      document.activeElement?.blur?.();
      getSelection?.()?.removeAllRanges();
      navigator.vibrate?.(8);
    }, delay ?? (e.target.closest('textarea') ? 380 : e.pointerType === 'mouse' ? 150 : 320));
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

// ——— Hojas: arrastrar hacia abajo la barrita (o la cabecera) las cierra, como en las apps del celular ———
function sheetDrag() {
  let drag = null;
  const reset = dlg => { dlg.style.transition = ''; dlg.style.transform = ''; };
  document.addEventListener('pointerdown', e => {
    const handle = e.target.closest?.('dialog.sheet .sheet-grip, dialog.sheet .sheet-head');
    if (!handle || e.target.closest('button, a, input') || matchMedia('(min-width: 900px)').matches) return;
    drag = { dlg: handle.closest('dialog'), y: e.clientY, id: e.pointerId, moving: false, last: [[e.clientY, e.timeStamp]] };
  });
  document.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = Math.max(0, e.clientY - drag.y);
    if (!drag.moving) {
      if (dy < 6) return;
      drag.moving = true;
      try { e.target.setPointerCapture?.(e.pointerId); } catch { /* el puntero ya no está activo */ }
    }
    drag.last = [...drag.last.slice(-4), [e.clientY, e.timeStamp]];
    drag.dlg.style.transition = 'none';
    drag.dlg.style.transform = `translateY(${dy}px)`;
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dlg, moving, y, last } = drag;
    drag = null;
    if (!moving) return;
    const dy = Math.max(0, e.clientY - y), [y0, t0] = last[0], speed = (e.clientY - y0) / Math.max(1, e.timeStamp - t0);
    if (e.type === 'pointerup' && (dy > 90 || (speed > 0.5 && dy > 30))) {
      dlg.style.transition = 'transform .2s ease-in';
      dlg.style.transform = 'translateY(100%)';
      setTimeout(() => { dlg.close(); reset(dlg); }, 190);
    } else {
      dlg.style.transition = 'transform .22s var(--ease)';
      dlg.style.transform = '';
      setTimeout(() => reset(dlg), 230);
    }
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
}

// Teclado sin fila de palabras sugeridas (como el de Spotify): decisión de los fundadores.
// En el iPhone esa fila va unida al autocorrector (autocorrect), así que se apaga y se deja el
// corrector ortográfico (spellcheck): subraya los errores y al tocarlos ofrece cómo corregirlos.
// Se marca cada campo apenas aparece, porque el iPhone lee estos atributos al enfocarlo.
// Quedan fuera el correo y los códigos de acceso, que usan el autocompletado del sistema.
const TEXT_FIELDS = 'textarea, [contenteditable="true"], input:not([type]), input[type="text"], input[type="search"]';
function quietKeyboard(root) {
  const fields = root.matches?.(TEXT_FIELDS) ? [root] : [...(root.querySelectorAll?.(TEXT_FIELDS) || [])];
  for (const el of fields) {
    if (el.autocomplete === 'one-time-code' || el.dataset.quiet) continue;
    el.dataset.quiet = '1';
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('spellcheck', el.type === 'search' ? 'false' : 'true');
    if (el.matches('input')) el.setAttribute('autocomplete', 'off');
  }
}

// ——— Deslizar el pulgar por la barra de secciones (celular) ———
// Como en Instagram o Spotify: con el pulgar apoyado en la barra, al pasar sobre otra sección se
// abre ahí mismo, sin levantar el dedo. Un toque simple funciona como siempre; al terminar un
// deslizamiento no se dispara ese toque (si no, tocar la sección activa subiría al inicio).
function tabSlide() {
  let slide = null, suppress = false;
  const tabAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('#nav button[data-a="go"]');
  document.addEventListener('pointerdown', e => {
    const tab = e.pointerType === 'touch' && e.target.closest?.('#nav button[data-a="go"]');
    if (!tab || matchMedia('(min-width: 1000px)').matches) return;
    slide = { id: e.pointerId, x: e.clientX, current: tab.dataset.k, moved: false };
  });
  document.addEventListener('pointermove', e => {
    if (!slide || e.pointerId !== slide.id) return;
    if (!slide.moved && Math.abs(e.clientX - slide.x) < 12) return;
    slide.moved = true;
    const tab = tabAt(e.clientX, e.clientY);
    if (!tab || tab.dataset.k === slide.current) return;
    slide.current = tab.dataset.k;
    if (tab.dataset.k !== U.tab && canEdit()) ACTIONS.go(tab.dataset, tab);
  });
  const end = e => {
    if (!slide || e.pointerId !== slide.id) return;
    suppress = slide.moved;
    slide = null;
    setTimeout(() => { suppress = false; }, 400);
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  document.addEventListener('click', e => {
    if (suppress && e.target.closest?.('#nav')) { e.preventDefault(); e.stopImmediatePropagation(); suppress = false; }
  }, true);
}

export function initInteractions(isReady) {
  canEdit = isReady;
  initBackSwipe();
  tabSlide();
  quietKeyboard(document.body);
  new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) quietKeyboard(n); })
    .observe(document.body, { childList: true, subtree: true });
  watchSheetClose();
  sheetDrag();
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('input', onInput);
  document.addEventListener('focusout', onFocusOut);
  document.addEventListener('keydown', onKeydown);
  swipeZones();
  swipeRows();
  sortable({ handle: '.task[data-sort]', item: '.task[data-task]', key: el => +el.dataset.task, onDrop: (a, b) => { if (!isLockedDay(U.date) && reorderTask(U.date, a, b)) render(); } });
  // Hábitos: se reordenan solo en la ventana «Reordenar» (arrastre propio, ver orderDrag en sheets.js).
}
export { openSettings };
