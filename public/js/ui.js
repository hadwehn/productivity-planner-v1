// Estado de la interfaz (no se guarda en la nube), avisos y tema visual.
import { S } from './state.js';
import { $, $$, esc, iso, monday, today, weekdayOf } from './util.js';

export const U = {
  tab: 'd',
  // Día
  dd: today(), dt: 'p', startOpen: false, endOpen: false, habitsOpen: true, agendaOpen: false,
  // Semana
  wk: iso(monday(new Date())), wt: 'p',
  // Calendario
  cm: today().slice(0, 7), cd: today(),
  // Hábitos
  hm: today().slice(0, 7), hd: today(),
  // Preferencias
  pm: 'group', pday: weekdayOf(today()),
};

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
  showStatus(3200);
}
/** Aviso con botón «Deshacer». `restore` se ejecuta si la persona lo pulsa. */
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

const THEME_COLOR = { dark: '#121923', soft: '#F8F7F4', modern: '#F5F6F8' };
export function applyTheme() {
  const root = document.documentElement;
  const appearance = S.cfg.appearance === 'dark' ? 'dark' : 'light';
  const theme = S.cfg.theme === 'soft' ? 'soft' : 'modern';
  root.dataset.theme = theme;
  root.dataset.appearance = appearance;
  root.style.colorScheme = appearance;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = appearance === 'dark' ? THEME_COLOR.dark : THEME_COLOR[theme];
  $$('[data-a=theme],[data-a=appearance]').forEach(b => {
    const on = b.dataset.k === (b.dataset.a === 'appearance' ? appearance : theme);
    b.classList.toggle('selected', on);
    b.setAttribute('aria-pressed', String(on));
  });
}
