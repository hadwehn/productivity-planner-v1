// Estado de la interfaz (no se guarda en la nube), avisos y tema visual.
import { S } from './state.js';
import { $, esc, today, iso, monday } from './util.js';

export const U = {
  tab: 'today',          // today · week · habits · journal
  date: today(),         // día abierto en «Hoy»
  morning: false,        // rituales plegados por defecto
  evening: false,
  notes: false,
  week: iso(monday(new Date())),
  weekMode: 'week',      // week · month
  review: false,
  month: today().slice(0, 7),
  calDay: today(),
  journalMonth: today().slice(0, 7),
};

/** Preferencias de «Hoy» (todas visibles salvo que se apaguen). */
export const showToday = key => S.cfg.today?.[key] !== false;

let toastTimer, undoAction = null;
function showStatus(ms) {
  const el = $('#status');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); undoAction = null; }, ms);
}
export function toast(message) {
  undoAction = null;
  $('#status').textContent = message;
  showStatus(2800);
}
/** Aviso con «Deshacer». */
export function toastUndo(message, restore) {
  undoAction = restore;
  $('#status').innerHTML = `<span>${esc(message)}</span><button type="button" data-a="undo" class="toast-undo">Deshacer</button>`;
  showStatus(6000);
}
export function runUndo() {
  const fn = undoAction;
  undoAction = null;
  clearTimeout(toastTimer);
  $('#status').classList.remove('show');
  fn?.();
}

// ——— Tema: automático (sigue al sistema), claro u oscuro ———
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
export function applyTheme() {
  const pref = S.cfg.appearance || 'auto';
  const dark = pref === 'dark' || (pref === 'auto' && !!media?.matches);
  const root = document.documentElement;
  root.dataset.appearance = dark ? 'dark' : 'light';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#111413' : '#F4F1EB';
}
media?.addEventListener?.('change', () => { if ((S.cfg.appearance || 'auto') === 'auto') applyTheme(); });
