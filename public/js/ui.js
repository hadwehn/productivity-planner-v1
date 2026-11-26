// Estado de la interfaz (no se guarda en la nube), avisos y tema visual.
import { S, get } from './state.js';
import { tr } from './i18n.js';
import { $, esc, today, iso, monday, shiftDate } from './util.js';
import { reviewReminder } from './rituals.js';

export const U = {
  tab: 'today',          // today · week · habits · journal
  date: today(),         // día abierto en «Hoy»
  settling: null,        // tarea recién marcada como hecha que espera un momento antes de bajar
  morning: false,        // rituales plegados por defecto
  evening: false,
  notes: false,
  week: iso(monday(new Date())),
  weekMode: 'week',      // week · month
  // «Editar» un ritual ya terminado es solo un modo de la pantalla: el día (o la semana) sigue
  // cerrado. Guarda 'm:FECHA', 'e:FECHA', 'intent:LUNES' o 'review:LUNES'; se olvida al cambiar de periodo.
  editing: null,
  monthSnap: null,       // cómo estaba el foco/lo mejor del mes al abrirlo (para salir sin guardar)
  // Periodo al que corresponden las tarjetas abiertas de cada sección: al pasar a otro día o semana,
  // se pliegan y la página se ve como siempre (ver render).
  foldsFor: {},
  review: false,
  weekIntent: false,     // «Intención de la semana» plegada por defecto, como los rituales de Hoy
  month: today().slice(0, 7),
  calDay: today(),
  journalMonth: today().slice(0, 7),
  journalTab: 'summary',  // summary · entries
  journalQuery: '',       // búsqueda en «Escritos» (no se guarda)
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
  U.foldsFor.today = T; // esta apertura es para hoy: que no se pliegue al dibujarlo
}

/** Preferencias de «Hoy» (todas visibles salvo que se apaguen). */
export const showToday = key => S.cfg.today?.[key] !== false;

let toastTimer, undoAction = null, statusHome = null;
// Con una ventana abierta (p. ej., Notas), todo lo de afuera queda bloqueado: el aviso se muestra
// dentro de ella para que «Deshacer» se pueda tocar, y vuelve a su lugar al cerrarla.
function placeStatus(el) {
  statusHome ||= el.parentElement;
  const dlg = [...document.querySelectorAll('dialog[open]')].find(d => d.matches(':modal'));
  const target = dlg || statusHome;
  if (el.parentElement !== target) target.append(el);
  if (dlg && !dlg.dataset.statusInside) {
    dlg.dataset.statusInside = '1';
    dlg.addEventListener('close', () => { delete dlg.dataset.statusInside; if (el.parentElement === dlg) statusHome.append(el); }, { once: true });
  }
}
function showStatus(ms) {
  const el = $('#status');
  placeStatus(el);
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
// La apariencia es de cada dispositivo, no de la cuenta: elegir «Oscura» en el computador no
// cambia el celular. Por defecto, «Automática» (sigue el modo claro u oscuro del sistema).
// theme-init.js lee esta misma clave para pintar la pantalla de carga sin destellos.
// La clave es nueva (antes 'diario-apariencia' copiaba la de la cuenta): todos parten en «Automática».
const STORED = 'focus-apariencia';
export function storedAppearance() {
  try { const v = localStorage.getItem(STORED); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; }
}
export function setAppearance(pref) {
  try { localStorage.setItem(STORED, pref); } catch { /* almacenamiento bloqueado */ }
  applyTheme(pref);
}
let currentPref = 'auto';
/** Sin argumento usa la apariencia guardada en este dispositivo. */
export function applyTheme(pref = storedAppearance()) {
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

// ——— Tamaño del texto: normal o «más grande» (se recuerda en el dispositivo para la pantalla de carga) ———
const TEXT_KEY = 'diario-texto';
export function applyTextSize(pref) {
  if (pref === undefined) {
    pref = S.cfg.textSize === 'large' ? 'large' : 'normal';
    try { localStorage.setItem(TEXT_KEY, pref); } catch { /* almacenamiento bloqueado */ }
  }
  if (pref === 'large') document.documentElement.dataset.text = 'large';
  else delete document.documentElement.dataset.text;
}

// ——— Qué ritual toca ahora (punto en la barra y en su tarjeta, ver navDots en render.js) ———
// Mañana (5:00–12:00): «Empieza tu día» sin terminar, si la intención o la gratitud están a la vista.
// Noche (desde las 19:00): el día sin cerrar. Semana: la revisión, cuando toca (reviewReminder).
const NIGHT_HOUR = 19, MORNING = [5, 12];
export function dueRituals(now = new Date()) {
  if (!S) return { morning: false, evening: false, review: null };
  const h = now.getHours(), closed = S.d?.[today()]?.closed || {};
  return {
    morning: h >= MORNING[0] && h < MORNING[1] && closed.m !== true && (showToday('intention') || showToday('gratitude')),
    evening: h >= NIGHT_HOUR && closed.e !== true,
    review: reviewReminder(now),
  };
}
