// Dibuja la pestaña activa conservando scroll y foco.
import { U } from './ui.js';
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

// Como en Instagram: al bajar, la barra de pestañas se achica; al subir (o arriba del todo) vuelve.
let lastScroll = 0;
addEventListener('scroll', () => {
  const y = scrollY, root = document.documentElement;
  if (y <= 4) root.classList.remove('nav-compact');
  else if (y > lastScroll + 6 && y > 60) root.classList.add('nav-compact');
  else if (y < lastScroll - 6) root.classList.remove('nav-compact');
  else return; // movimientos mínimos: no se cambia nada
  lastScroll = y;
}, { passive: true });

export function renderNav() {
  if (resizer && $('#v')) resizer.observe($('#v'));
  $('#nav').innerHTML = TABS().map(([k, label]) => `<button data-a="go" data-k="${k}">${icon(k)}<span>${label}</span></button>`).join('');
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
  const y = scrollY, active = document.activeElement;
  const focusKey = active?.dataset?.p || active?.dataset?.taskText || active?.dataset?.weekText;
  const caret = active?.selectionStart;
  const view = $('#v');
  view.innerHTML = VIEWS[U.tab]();
  if (!toTop) view.firstElementChild?.classList.remove('view');
  $$('#nav button').forEach(b => {
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
