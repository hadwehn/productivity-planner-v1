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
// La apariencia se recuerda en el dispositivo para pintar la pantalla de carga antes de tener
// los datos de la cuenta (ver theme-init.js, que lee esta misma clave).
const STORED = 'diario-apariencia';
export function storedAppearance() {
  try { return localStorage.getItem(STORED) || 'auto'; } catch { return 'auto'; }
}
let currentPref = 'auto';
/** Sin argumento usa la preferencia de la cuenta y la recuerda; con argumento solo la aplica. */
export function applyTheme(pref) {
  if (pref === undefined) {
    pref = S.cfg.appearance || 'auto';
    try { localStorage.setItem(STORED, pref); } catch { /* almacenamiento bloqueado */ }
  }
  currentPref = pref;
  const dark = pref === 'dark' || (pref === 'auto' && !!media?.matches);
  const root = document.documentElement;
  root.dataset.appearance = dark ? 'dark' : 'light';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#111413' : '#F4F1EB';
}
media?.addEventListener?.('change', () => { if (currentPref === 'auto') applyTheme('auto'); });
