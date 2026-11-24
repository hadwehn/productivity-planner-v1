// Dibuja la pestaña activa conservando scroll y foco.
import { U } from './ui.js';
import { $, $$, iso, monday, today } from './util.js';
import { icon } from './icons.js';
import { tr } from './i18n.js';
import { todayView } from './views/today.js';
import { planView } from './views/week.js';
import { habitsView } from './views/habits.js';
import { journalView } from './views/journal.js';
import { isUnlocked, journalTab } from './lock.js';

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

// La barra de pestañas se achica al bajar y vuelve a su tamaño al subir, al llegar arriba o 0,4 s
// después de dejar de desplazarse (igual a mitad de página que al final).
const NAV_IDLE = 400;
let lastScroll = 0, scrollIdle = 0;
const regrowLater = () => { clearTimeout(scrollIdle); scrollIdle = setTimeout(() => { scrollIdle = 0; document.documentElement.classList.remove('nav-compact'); }, NAV_IDLE); };
addEventListener('scroll', () => {
  const y = scrollY, root = document.documentElement, dy = y - lastScroll;
  if (y <= 4) { lastScroll = y; clearTimeout(scrollIdle); scrollIdle = 0; root.classList.remove('nav-compact'); return; }
  // En el final (y al estirar la página más allá con el dedo) los rebotes del celular no cambian la
  // barra ni alargan la espera: vuelve a su tamaño a los 0,4 s de llegar, igual que a mitad de página.
  if (y >= root.scrollHeight - innerHeight - 24) { lastScroll = y; if (!scrollIdle) regrowLater(); return; }
  regrowLater();
  if (Math.abs(dy) < 6) return; // movimientos mínimos: se acumulan
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
  drawBackNow();
  scrollTo(0, toTop ? 0 : y);
  markScrolled();
  if (focusKey && !toTop) {
    const el = $(`[data-p="${focusKey}"],[data-task-text="${focusKey}"],[data-week-text="${focusKey}"]`);
    if (el) { el.focus({ preventScroll: true }); if (caret != null) el.setSelectionRange?.(caret, caret); }
  }
}

/**
 * «Volver al presente»: un solo botón, arriba a la derecha bajo la cabecera fija, igual en
 * Hoy, Plan y Diario, que aparece solo cuando se mira otro día, semana o mes. Texto corto («Hoy»,
 * «Esta semana», «Este mes») con una flecha curva de regreso, que se refleja si el presente queda adelante.
 */
function backNow() {
  const T = today(), month = T.slice(0, 7), week = iso(monday(new Date()));
  const thisMonth = [tr('Este mes', 'This month'), tr('Volver a este mes', 'Back to this month')];
  if (U.tab === 'today' && U.date !== T) return { a: 'date', k: T, later: U.date > T, label: [tr('Hoy', 'Today'), tr('Volver a hoy', 'Back to today')] };
  if (U.tab === 'week' && U.weekMode === 'week' && U.week !== week) return { a: 'thisweek', later: U.week > week, label: [tr('Esta semana', 'This week'), tr('Volver a esta semana', 'Back to this week')] };
  if (U.tab === 'week' && U.weekMode !== 'week' && U.month !== month) return { a: 'thismonth', later: U.month > month, label: thisMonth };
  if (U.tab === 'journal' && isUnlocked() && U.journalMonth !== month) return { a: 'thisjournal', later: U.journalMonth > month, label: thisMonth };
  return null;
}
// El botón vive dentro de la cabecera fija y cuelga bajo su línea: así se mueven siempre juntos
// (también en el rebote del iPhone al tirar más arriba del inicio). Como la vista se vuelve a dibujar,
// se guarda aquí y se vuelve a poner en la cabecera nueva cada vez.
let backBtn = null;
function drawBackNow() {
  backBtn ||= $('#back-now');
  const btn = backBtn, b = backNow(), head = $('#v .sticky-head');
  if (!btn) return;
  const wasHidden = btn.hidden || !btn.isConnected;
  btn.hidden = !b || !head;
  if (btn.hidden) return;
  if (btn.parentElement !== head) head.append(btn);
  // Aparece con una animación solo al mostrarse, no cada vez que se redibuja la pantalla.
  btn.classList.toggle('enter', wasHidden);
  btn.dataset.a = b.a;
  if (b.k) btn.dataset.k = b.k; else delete btn.dataset.k;
  // Texto corto («Esta semana») con flecha curva de regreso; el nombre completo, para lectores de pantalla.
  btn.innerHTML = `${icon('back', `icon${b.later ? '' : ' flip'}`)}<span>${b.label[0]}</span>`;
  btn.setAttribute('aria-label', b.label[1]);
  btn.title = b.label[1];
}

export function focusEnd(el) {
  if (!el) return false;
  el.focus({ preventScroll: true });
  const end = el.value?.length ?? 0;
  el.setSelectionRange?.(end, end);
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return true;
}
