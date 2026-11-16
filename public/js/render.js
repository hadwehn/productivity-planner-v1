// Dibuja la pestaña activa conservando scroll y foco.
import { U, arrowsNav } from './ui.js';
import { $, $$ } from './util.js';
import { icon } from './icons.js';
import { tr } from './i18n.js';
import { todayView } from './views/today.js';
import { planView } from './views/week.js';
import { habitsView } from './views/habits.js';
import { journalView } from './views/journal.js';
import { journalTab } from './lock.js';

const VIEWS = { today: todayView, week: planView, habits: habitsView, journal: journalView };
export const TABS = () => [['journal', tr('Diario', 'Journal')], ['habits', tr('Hábitos', 'Habits')], ['week', tr('Plan', 'Plan')], ['today', tr('Hoy', 'Today')]];

// Los campos crecen con su texto. Si cambia el ancho (rotación, barra de desplazamiento, ventana),
// el texto vuelve a repartirse en líneas y hay que recalcular la altura.
let lastWidth = 0;
const resizer = typeof ResizeObserver === 'function' ? new ResizeObserver(([entry]) => {
  const width = Math.round(entry.contentRect.width);
  if (width !== lastWidth) { lastWidth = width; $$('#v textarea').forEach(autosize); }
}) : null;

// La cabecera fija muestra una línea suave solo cuando hay contenido pasando por debajo.
const markScrolled = () => document.documentElement.classList.toggle('scrolled', scrollY > 4);
addEventListener('scroll', markScrolled, { passive: true });

// La barra de pestañas se achica mientras se baja y vuelve a su tamaño al subir, al llegar
// arriba o al dejar de desplazarse (no se queda achicada a mitad de página).
let lastScroll = 0, scrollIdle = 0;
addEventListener('scroll', () => {
  const y = scrollY, root = document.documentElement, dy = y - lastScroll;
  clearTimeout(scrollIdle);
  scrollIdle = setTimeout(() => root.classList.remove('nav-compact'), 450);
  if (y > 4 && Math.abs(dy) < 6) return; // movimientos mínimos: se acumulan
  lastScroll = y;
  root.classList.toggle('nav-compact', dy > 0 && y > 60);
}, { passive: true });

// «Hoy» ordena distinto sus bloques en pantallas amplias: se vuelve a dibujar al cruzar ese ancho.
const wideScreen = typeof matchMedia === 'function' ? matchMedia('(min-width: 1200px)') : null;
wideScreen?.addEventListener?.('change', () => { if (shownTab) render(); });

export function renderNav() {
  if (resizer && $('#v')) resizer.observe($('#v'));
  // La marca y los atajos solo se ven en la barra lateral del computador (ver «Escritorio» en styles.css).
  $('#nav').innerHTML = `<div class="nav-brand" aria-hidden="true"><img class="wordmark-light" src="icons/estoico-icon.png?v=3" width="240" height="80" alt=""><img class="wordmark-dark" src="icons/estoico-icon-dark.png?v=1" width="240" height="80" alt=""><span>FOCUS</span></div>`
    + TABS().map(([k, label]) => `<button data-a="go" data-k="${k}">${icon(k)}<span>${label}</span></button>`).join('')
    + `<button class="nav-help" data-a="shortcuts">${icon('keyboard')}<span>${tr('Atajos de teclado', 'Keyboard shortcuts')}</span><kbd>?</kbd></button>`;
}

export function autosize(el) {
  if (!(el instanceof HTMLTextAreaElement)) return;
  el.style.height = 'auto';
  // Vacío, se mide con el texto de ayuda: si ocupa dos líneas, el recuadro también.
  if (!el.value && el.placeholder) {
    el.value = el.placeholder;
    el.style.height = el.scrollHeight + 'px';
    el.value = '';
    return;
  }
  el.style.height = el.scrollHeight + 'px';
}

/** Vuelve a dibujar. `toTop` lleva el scroll arriba (cambio de pantalla). Conserva el campo enfocado. */
let shownTab = null;
export function render(toTop = false) {
  journalTab(shownTab, U.tab);
  shownTab = U.tab;
  document.documentElement.dataset.nav = arrowsNav() ? 'arrows' : 'swipe'; // los estilos muestran u ocultan las flechas
  const y = scrollY, active = document.activeElement;
  const focusKey = active?.dataset?.p || active?.dataset?.taskText || active?.dataset?.weekText;
  const caret = active?.selectionStart;
  const view = $('#v');
  view.innerHTML = VIEWS[U.tab]();
  if (!toTop) view.firstElementChild?.classList.remove('view');
  $$('#nav button[data-k]').forEach(b => {
    const on = b.dataset.k === U.tab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  $$('textarea', view).forEach(autosize);
  requestAnimationFrame(() => $$('textarea', view).forEach(autosize));
  scrollTo(0, toTop ? 0 : y);
  markScrolled();
  if (focusKey && !toTop) {
    const el = $(`[data-p="${focusKey}"],[data-task-text="${focusKey}"],[data-week-text="${focusKey}"]`);
    if (el) { el.focus({ preventScroll: true }); if (caret != null) el.setSelectionRange?.(caret, caret); }
  }
}

export function focusEnd(el) {
  if (!el) return false;
  el.focus({ preventScroll: true });
  const end = el.value?.length ?? 0;
  el.setSelectionRange?.(end, end);
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return true;
}
