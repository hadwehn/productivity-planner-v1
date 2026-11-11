// Eventos de la interfaz: acciones por data-a, escritura, teclado y arrastre.
import { S, get, save, setPath } from './state.js';
import { U, applyTheme, runUndo, toast, toastUndo } from './ui.js';
import { applyPreset, prefsHTML, setDayVisibility, setGroupVisibility, PRESETS } from './prefs.js';
import {
  PRIORITY_KEYS, addOther, addPriority, carryToTomorrow, detachEditedTask, isPriority, moveOther,
  otherCount, priorityCount, removeTask, restore, snapshot, syncTask,
} from './tasks.js';
import { deleteHabit, eventEditor, habitEditor, planTaskDialog } from './dialogs.js';
import { expandTextArea, focusField, focusPath, render } from './render.js';
import { weekProgress } from './views/week.js';
import { $, $$, iso, monday, shiftDate, shiftMonth, today, weekdayOf } from './util.js';

let canEdit = () => false;

// ——— Preferencias (diálogo ⋯) ———
export function refreshPrefs(focusId) {
  const dialog = $('#dlg'), top = dialog.scrollTop, details = $('#pers details'), expanded = details?.open;
  $('#pers').innerHTML = prefsHTML();
  if ($('#pers details')) $('#pers details').open = !!expanded;
  render();
  dialog.scrollTop = top;
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}
export function openSettings() {
  U.pday = weekdayOf(U.dd);
  $('#pers').innerHTML = prefsHTML();
  $('#dlg').showModal();
}

// ——— Tareas del día ———
function removeDailyTask(key) {
  const date = U.dd, row = S.d[date]?.k?.[key];
  const hadContent = !!(row && (String(row.t ?? '').trim() || row.c || row.s));
  const undo = snapshot([date]);
  removeTask(date, key);
  render();
  if (hadContent) toastUndo('Tarea eliminada', () => { restore(undo); render(); });
}
function carryTask(key) {
  const result = carryToTomorrow(U.dd, key);
  if (result.error) { toast(result.error); return; }
  render();
  toastUndo('Tarea pasada a mañana', () => { restore(result.undo); render(); toast('Traslado deshecho'); });
}
function addAndFocus(kind) {
  const key = kind === 'priority' ? addPriority(U.dd) : addOther(U.dd);
  if (key === null) { toast(kind === 'priority' ? 'Ya tienes tres tareas importantes.' : 'Este día ya tiene 500 tareas.'); return; }
  render();
  focusPath(`d.${U.dd}.k.${key}.t`);
}

// ——— Acciones de clic ———
const navigate = fn => (d, b) => { fn(d, b); render(true); };
const update = fn => (d, b) => { fn(d, b); render(); };

const ACTIONS = {
  dismiss: (d, b) => b.closest('dialog')?.close(),
  undo: () => runUndo(),
  db: () => openSettings(),
  exp: () => document.dispatchEvent(new CustomEvent('planner:download')),

  // Navegación
  go: navigate(d => { U.tab = d.k; }),
  dd: navigate(d => { U.dd = shiftDate(U.dd, +d.n); }),
  today: navigate(() => { U.dd = today(); }),
  dt: navigate(d => { U.dt = d.k; }),
  wk: navigate(d => { U.wk = shiftDate(U.wk, 7 * d.n); }),
  hoyw: navigate(() => { U.wk = iso(monday(new Date())); }),
  wt: navigate(d => { U.wt = d.k; }),
  m: navigate(d => {
    U[d.k] = shiftMonth(U[d.k], +d.n);
    if (d.k === 'cm') U.cd = U.cm === today().slice(0, 7) ? today() : U.cm + '-01';
  }),
  hoy: navigate(d => { U[d.k] = today().slice(0, 7); if (d.k === 'cm') U.cd = today(); else U.hd = today(); }),
  cd: update(d => { U.cd = d.k; }),
  hd: update(d => { U.hd = d.k; }),
  phase: update(d => { const key = { start: 'startOpen', habits: 'habitsOpen', end: 'endOpen' }[d.k]; U[key] = !U[key]; }),
  agenda: update(() => { U.agendaOpen = !U.agendaOpen; }),

  // Tareas
  tog: update(d => { const value = !get(d.p, false); setPath(d.p, value); syncTask(d.p, value); }),
  dot: update(d => { const s = get(d.p, 0), j = +d.j; setPath(d.p, s === j + 1 ? j : j + 1); }),
  priorityadd: () => addAndFocus('priority'),
  taskadd: () => addAndFocus('other'),
  taskremove: d => removeDailyTask(+d.k),
  carrytask: d => carryTask(+d.k),
  move: d => planTaskDialog(d.r, +d.i),

  // Hábitos
  hab: update(d => { const o = S.hl[U.hd] = S.hl[U.hd] || {}; o[d.id] = o[d.id] === 1 ? 0 : 1; save(); }),
  dailyhab: update(d => { const o = S.hl[U.dd] = S.hl[U.dd] || {}; o[d.id] = o[d.id] === 1 ? 0 : 1; save(); }),
  hadd: () => habitEditor(),
  hen: d => habitEditor(d.id),
  habitdelete: d => deleteHabit(d.id),

  // Eventos
  eva: () => eventEditor(),
  eventedit: d => eventEditor(+d.i),

  // Bienvenida y preferencias
  welcome: update(() => { S.cfg.welcomed = true; save(); $('#welcomeDlg').close(); }),
  startpreset: d => {
    applyPreset(d.k, true);
    S.cfg.welcomed = true;
    save();
    $('#welcomeDlg').close();
    render();
    toast(`Experiencia ${PRESETS[d.k].label.toLowerCase()} activada`);
  },
  preset: d => { applyPreset(d.k); refreshPrefs(); toast(`Configuración ${PRESETS[d.k].label.toLowerCase()} activada`); },
  allreset: () => { S.cfg.days = {}; save(); refreshPrefs(); toast('Todos los días siguen la categoría base'); },
  prefmode: (d, b) => { U.pm = d.k; refreshPrefs(b.id); },
  prefday: (d, b) => { U.pday = +d.i; refreshPrefs(b.id); },
  prefreset: () => { delete S.cfg.days[U.pday]; save(); refreshPrefs('pref-day-' + U.pday); },
  dayvis: (d, b) => { setDayVisibility(d.k, U.pday, b.checked); save(); refreshPrefs(b.id); },
  groupvis: (d, b) => { setGroupVisibility(d.k, d.group, b.checked); save(); refreshPrefs(); },
  vis: update((d, b) => { S.cfg.hide[d.k] = !b.checked; save(); }),
  theme: d => { S.cfg.theme = d.k === 'soft' ? 'soft' : 'modern'; save(); applyTheme(); render(); toast('Estilo visual actualizado'); },
  appearance: d => {
    S.cfg.appearance = d.k === 'dark' ? 'dark' : 'light';
    // En modo oscuro, la paleta «Papelería suave» es la predeterminada.
    if (S.cfg.appearance === 'dark') S.cfg.theme = 'soft';
    save();
    applyTheme();
    render();
    toast(S.cfg.appearance === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado');
  },
};

function onClick(e) {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const action = ACTIONS[b.dataset.a];
  if (!action) return;
  if (!canEdit() && !['dismiss', 'undo'].includes(b.dataset.a)) return;
  action(b.dataset, b, e);
}

// ——— Escritura ———
function onInput(e) {
  const el = e.target, path = el.dataset?.p;
  expandTextArea(el);
  if (!path || !('value' in el)) return;
  const oldText = get(path);
  setPath(path, el.value);
  if (path.endsWith('.t')) detachEditedTask(path, oldText, el.value);
  const filled = !!el.value.trim(), row = el.closest('.row');
  if (!row) return;
  if (/^d\.[^.]+\.k\.\d+\.t$/.test(path)) {
    row.querySelector('[data-a=carrytask]')?.toggleAttribute('hidden', !filled);
    const key = +path.split('.')[3];
    if (isPriority(key)) row.querySelector('[data-a=taskremove]')?.toggleAttribute('hidden', !filled && priorityCount(U.dd) === 1);
  }
  if (/^w\.[^.]+\.[ab]\.\d+\.t$/.test(path)) {
    row.querySelector('[data-a=move]')?.toggleAttribute('hidden', !filled);
    const ring = $('#weekProgress'), pr = weekProgress(U.wk);
    if (ring) {
      ring.style.setProperty('--p', pr.percent);
      ring.querySelector('span').textContent = `${pr.done}/${pr.total}`;
      $('#weekProgressText').textContent = pr.message;
    }
  }
}

// ——— Enter pasa al siguiente campo; Mayús+Enter salta de línea (las notas no cambian) ———
function nextField(el) {
  const path = el.dataset.p, task = path.match(/^d\.([^.]+)\.k\.(\d+)\.t$/);
  if (task) {
    const date = task[1], key = +task[2], filled = !!el.value.trim();
    if (isPriority(key)) {
      const pos = PRIORITY_KEYS.indexOf(key), count = priorityCount(date);
      if (pos < count - 1) return focusPath(`d.${date}.k.${PRIORITY_KEYS[pos + 1]}.t`);
      if (filled && count < 3) return addAndFocus('priority');
    } else {
      if (key < otherCount(date)) return focusPath(`d.${date}.k.${key + 1}.t`);
      if (filled) return addAndFocus('other');
    }
  }
  const fields = $$('#v textarea[data-p]'), next = fields[fields.indexOf(el) + 1];
  if (next) focusField(next); else el.blur();
}
function onKeydown(e) {
  const el = e.target;
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && el instanceof HTMLTextAreaElement && el.dataset.p) {
    e.preventDefault();
    if (canEdit()) nextField(el);
    return;
  }
  // Reordenar con el teclado desde el asa de arrastre.
  if (!['ArrowUp', 'ArrowDown'].includes(e.key) || !canEdit()) return;
  const step = e.key === 'ArrowUp' ? -1 : 1;
  const habit = el.closest?.('[data-habit-drag]'), task = el.closest?.('[data-drag-index]');
  if (habit) {
    e.preventDefault();
    const id = habit.dataset.habitDrag, from = S.h.findIndex(h => h.id === id), to = from + step;
    if (from < 0 || to < 0 || to >= S.h.length) return;
    reorderHabit(id, S.h[to].id);
    $$('[data-habit-drag]').find(x => x.dataset.habitDrag === id)?.focus({ preventScroll: true });
  } else if (task) {
    e.preventDefault();
    const from = +task.dataset.dragIndex, to = from + step;
    if (moveOther(U.dd, from, to)) { render(); $(`[data-drag-index="${to}"]`)?.focus({ preventScroll: true }); }
  }
}

// ——— Arrastrar para ordenar (pulsación sostenida en el asa) ———
function reorderHabit(fromId, toId) {
  const from = S.h.findIndex(h => h.id === fromId), to = S.h.findIndex(h => h.id === toId);
  if (from < 0 || to < 0 || from === to) return false;
  const [habit] = S.h.splice(from, 1);
  S.h.splice(to, 0, habit);
  save();
  render();
  return true;
}

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
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!drag || drag.pointer !== e.pointerId) return;
      drag.active = true;
      document.body.classList.add('is-dragging');
      const rect = source.getBoundingClientRect(), clone = source.cloneNode(true);
      clone.classList.add('drag-preview');
      Object.assign(clone.style, { width: rect.width + 'px', left: rect.left + 'px', top: rect.top + 'px' });
      document.body.append(clone);
      drag.preview = clone;
      drag.dx = drag.x - rect.left;
      drag.dy = drag.y - rect.top;
      source.classList.add('dragging');
    }, e.pointerType === 'mouse' ? 160 : 330);
  });
  document.addEventListener('pointermove', e => {
    if (!drag || drag.pointer !== e.pointerId) return;
    if (!drag.active) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12) clear(); return; }
    e.preventDefault();
    drag.preview.style.left = (e.clientX - drag.dx) + 'px';
    drag.preview.style.top = (e.clientY - drag.dy) + 'px';
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(item);
    $$('.drop-target').forEach(el => el.classList.remove('drop-target'));
    if (target && !target.classList.contains('drag-preview')) { drag.target = key(target); target.classList.add('drop-target'); }
    if (e.clientY > innerHeight - 110) scrollBy(0, 12); else if (e.clientY < 90) scrollBy(0, -12);
  }, { passive: false });
  const finish = e => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const { id, target, active } = drag;
    clear();
    if (active && e.type === 'pointerup') onDrop(id, target);
  };
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', finish);
}

export function initInteractions(isReady) {
  canEdit = isReady;
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKeydown);
  sortable({
    handle: '[data-drag-index]', item: '.task-line[data-task-index]', key: el => +el.dataset.taskIndex,
    onDrop: (from, to) => { if (moveOther(U.dd, from, to)) { render(); toast('Orden actualizado'); } },
  });
  sortable({
    handle: '[data-habit-drag]', item: '.habit-card[data-habit-id]', key: el => el.dataset.habitId,
    onDrop: (from, to) => { if (reorderHabit(from, to)) toast('Orden de hábitos actualizado'); },
  });
}
