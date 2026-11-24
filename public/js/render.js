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
let lastScroll = 0, scrollIdle = 0, quietUntil = 0;
/** Los desplazamientos que hace la app (cambiar de sección o de periodo, volver a donde quedaste) no achican la barra. */
function quietScroll(y) { quietUntil = performance.now() + 400; lastScroll = y; document.documentElement.classList.remove('nav-compact'); }
const regrowLater = () => { clearTimeout(scrollIdle); scrollIdle = setTimeout(() => { scrollIdle = 0; document.documentElement.classList.remove('nav-compact'); }, NAV_IDLE); };
addEventListener('scroll', () => {
  const y = scrollY, root = document.documentElement, dy = y - lastScroll;
  if (performance.now() < quietUntil) { lastScroll = y; return; }
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

// ——— Cada sección y cada periodo recuerdan dónde quedaste ———
// La posición se anota por sección y periodo (cada día en Hoy, cada semana o mes en Plan, cada mes
// en Diario). Al ir y volver entre secciones, o entre días (p. ej., ir a mañana y volver a hoy), se
// vuelve al mismo punto si pasaron menos de 7 minutos. Un periodo que no se había abierto, o
// pasado ese tiempo, se ve desde el inicio. Solo en memoria: al cerrar la app se olvida.
export const SCROLL_MEMORY_MS = 7 * 60 * 1000;
const scrollMemory = {};
const memoryKey = (tab, key = viewKey(tab)) => `${tab}|${key}`;
export function viewKey(tab) {
  if (tab === 'today') return U.date;
  if (tab === 'week') return U.weekMode === 'week' ? 'w' + U.week : 'm' + U.month;
  if (tab === 'journal') return `${U.journalTab}·${U.journalMonth}·${isUnlocked() ? 1 : 0}`;
  return tab;
}
/** Anota la posición de lo que se deja (la sección y el periodo que muestra). */
export function rememberScroll(tab = U.tab, key = viewKey(tab), y = scrollY) {
  scrollMemory[memoryKey(tab, key)] = { y, at: Date.now() };
}
/** Posición a la que volver en `tab` (con el periodo que muestra), o 0 si no se abrió o pasó el tiempo. */
export function savedScroll(tab, now = Date.now()) {
  const m = scrollMemory[memoryKey(tab)];
  return m && now - m.at < SCROLL_MEMORY_MS ? m.y : 0;
}
export function restoreScroll(y) {
  if (!y) return;
  quietScroll(y);
  scrollTo(0, y);
  requestAnimationFrame(() => { quietScroll(y); scrollTo(0, y); markScrolled(); }); // tras ajustar la altura de los textos
}

/** Vuelve a dibujar. `toTop` lleva el scroll arriba (cambio de pantalla). Conserva el campo enfocado. */
let shownTab = null, shownKey = null;
export function render(toTop = false) {
  // Si la misma sección pasa a mostrar otro periodo (otro día en Hoy, otra semana o mes en Plan,
  // otro mes en Diario), se anota dónde quedó el anterior y el nuevo vuelve a su posición si se
  // vio hace poco; si no, se ve desde el inicio (la altura del periodo anterior no le sirve).
  const key = viewKey(U.tab), otherPeriod = U.tab === shownTab && key !== shownKey;
  if (otherPeriod) rememberScroll(shownTab, shownKey);
  shownKey = key;
  const top = toTop || otherPeriod, back = otherPeriod && !toTop ? savedScroll(U.tab) : 0;
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
  if (top) quietScroll(0);
  scrollTo(0, top ? 0 : y);
  markScrolled();
  restoreScroll(back);
  if (focusKey && !top) {
    const el = $(`[data-p="${focusKey}"],[data-task-text="${focusKey}"],[data-week-text="${focusKey}"]`);
    if (el) { el.focus({ preventScroll: true }); if (caret != null) el.setSelectionRange?.(caret, caret); }
  }
  applyRitualFocus(view);
}

// ——— Rituales en primer plano ———
// Con un ritual abierto (Empieza/Cierra tu día, Intención/Revisión de la semana), el resto de la
// pantalla se atenúa: es un momento propio, no un formulario en el camino. Al abrirlo, además,
// la página lo sube hasta quedar justo bajo la cabecera (ver focusRitual).
// Solo cuando la persona lo abre: la apertura automática de la mañana o la noche no atenúa nada.
export const FOCUS_CARDS = ['morning', 'evening', 'weekIntent', 'review']; // Notas se abre en su propia hoja
let focused = null; // ritual abierto en primer plano
const openRitual = view => [...view.querySelectorAll('.ritual.open')].find(s => FOCUS_CARDS.includes(s.querySelector('.ritual-head')?.dataset.k));
function applyRitualFocus(view) {
  const open = openRitual(view), card = open?.querySelector('.ritual-head').dataset.k === focused ? open : null;
  if (!card) focused = null;
  view.classList.toggle('ritual-focus', !!card);
  if (!card) { view.style.paddingBottom = ''; return; }
  // Se atenúan los hermanos de cada contenedor del ritual, salvo la cabecera fija.
  for (let el = card; el && el !== view; el = el.parentElement) {
    for (const sib of el.parentElement.children) {
      if (sib !== el && !sib.matches('.sticky-head, .back-now') && !sib.querySelector('.sticky-head')) sib.classList.add('dimmed');
    }
  }
}
/** Sube el ritual `key` hasta dejarlo bajo la cabecera fija, con un fundido del resto. */
export function focusRitual(key) {
  const view = $('#v'), card = openRitual(view);
  if (!card || card.querySelector('.ritual-head')?.dataset.k !== key) return;
  focused = key;
  applyRitualFocus(view);
  const head = $('.sticky-head', view)?.getBoundingClientRect().height || 0;
  const target = Math.max(0, Math.round(card.getBoundingClientRect().top + scrollY - head - 14));
  // Si la tarjeta está cerca del final, se agrega espacio abajo para que pueda subir del todo.
  view.style.paddingBottom = '';
  const missing = target + innerHeight - document.documentElement.scrollHeight;
  if (missing > 0) view.style.paddingBottom = `${parseFloat(getComputedStyle(view).paddingBottom) + missing + 24}px`; // se suma al espacio de la barra
  view.classList.add('dim-in');
  setTimeout(() => view.classList.remove('dim-in'), 450);
  const reduce = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
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
