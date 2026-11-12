// Estado de la interfaz (no se guarda en la nube), avisos y tema visual.
import { S, get } from './state.js';
import { tr } from './i18n.js';
import { $, esc, today, iso, monday } from './util.js';

export const U = {
  tab: 'today',          // today · week · habits · journal
  date: today(),         // día abierto en «Hoy»
  stripSlide: '',        // animación de la franja de días al cambiar de semana (next · prev)
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

// ——— Cambio de día ———
// En el celular la app queda abierta en segundo plano: al volver después de medianoche,
// lo que mostraba «hoy» pasa al día nuevo (si estabas mirando otra fecha, no se toca).
let seenToday = today();
/** Devuelve true si cambió el día desde la última vez. */
export function rollDay() {
  const T = today(), old = seenToday;
  if (T === old) return false;
  seenToday = T;
  if (U.date === old) U.date = T;
  if (U.calDay === old) U.calDay = T;
  if (U.week === iso(monday(new Date(`${old}T12:00`)))) U.week = iso(monday(new Date()));
  if (U.month === old.slice(0, 7)) U.month = T.slice(0, 7);
  if (U.journalMonth === old.slice(0, 7)) U.journalMonth = T.slice(0, 7);
  openRitualForNow();
  return true;
}

// ——— Rituales según la hora ———
// En la mañana se abre «Empieza tu día» y en la noche «Cierra tu día», una sola vez por día
// en cada dispositivo y solo si aún no escribiste nada. Si lo cierras, no vuelve a abrirse.
const RITUAL_KEY = 'diario-ritual-abierto';
export function openRitualForNow() {
  const T = today(), h = new Date().getHours(), Z = `d.${T}.`;
  const which = h >= 5 && h < 12 ? 'morning' : h >= 19 ? 'evening' : '';
  if (!which) return;
  const empty = which === 'morning'
    ? showToday('intention') && !String(get(Z + 'i')).trim() && !String(get(Z + 'g')).trim()
    : (showToday('reflection') || showToday('mood')) && !String(get(Z + 'r')).trim() && !S.d[T]?.mood;
  if (!empty || S.d[T]?.closed?.[which === 'morning' ? 'm' : 'e']) return;
  let last = '';
  try { last = localStorage.getItem(RITUAL_KEY) || ''; } catch { /* almacenamiento bloqueado */ }
  if (last === `${T}:${which}`) return;
  try { localStorage.setItem(RITUAL_KEY, `${T}:${which}`); } catch { /* almacenamiento bloqueado */ }
  U[which] = true;
}

// ——— Pista «Desliza para cambiar de semana» ———
// Se muestra en las 3 primeras aperturas de la app, hasta que la persona deslice una vez.
const HINT_KEY = 'diario-pista-deslizar', HINT_TIMES = 3, HINT_LEARNED = 99;
let hint = null, nudged = false;
export function swipeHint() {
  if (hint === null) {
    let seen = 0;
    try { seen = Number(localStorage.getItem(HINT_KEY)) || 0; } catch { /* almacenamiento bloqueado */ }
    hint = seen < HINT_TIMES;
    if (hint) try { localStorage.setItem(HINT_KEY, String(seen + 1)); } catch { /* almacenamiento bloqueado */ }
  }
  return hint;
}
/** Un pequeño vaivén de la franja, solo la primera vez que se dibuja con la pista. */
export function nudgeOnce() { if (nudged || !swipeHint()) return false; nudged = true; return true; }
export function swipeLearned() {
  hint = false;
  try { localStorage.setItem(HINT_KEY, String(HINT_LEARNED)); } catch { /* almacenamiento bloqueado */ }
}

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
  $('#status').innerHTML = `<span>${esc(message)}</span><button type="button" data-a="undo" class="toast-undo">${tr('Deshacer', 'Undo')}</button>`;
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
  // Mismo cambio de ícono que hace theme-init.js al cargar (pestaña del navegador y «Añadir a inicio»).
  const icon = dark ? 'icons/estoico-productivity-icon-dark.png?v=1' : 'icons/estoico-productivity-icon.png?v=3';
  document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(l => { if (l.getAttribute('href') !== icon) l.setAttribute('href', icon); });
}
media?.addEventListener?.('change', () => { if (currentPref === 'auto') applyTheme('auto'); });
