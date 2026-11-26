// Volver deslizando desde el borde izquierdo, como en el iPhone.
// Cuando se entra a algo desde otra pantalla (un día desde Plan, Hábitos o el Diario; «Ver todo»;
// los avisos que llevan a Plan; «Cerrarlo» de ayer), se anota dónde estabas. Arrastrar desde el
// borde izquierdo de la pantalla hacia la derecha te devuelve ahí, en el mismo punto de la página.
// La barra de secciones empieza de cero: tocarla borra el camino de vuelta.
import { U } from './ui.js';
import { render } from './render.js';
import { icon } from './icons.js';
import { tr } from './i18n.js';

const EDGE = 24, MAX = 10;
let trail = [];

/** Anota la pantalla actual para poder volver a ella. */
export function pushBack() {
  const { tab, date, week, month, weekMode, journalTab, journalMonth } = U;
  trail = [...trail.slice(-(MAX - 1)), { tab, date, week, month, weekMode, journalTab, journalMonth, y: scrollY }];
}
export const clearBack = () => { trail = []; };
export const canGoBack = () => trail.length > 0;

/** Vuelve a la pantalla anterior del camino. */
export function goBack() {
  const prev = trail.pop();
  if (!prev) return false;
  const { y, ...where } = prev;
  Object.assign(U, where);
  U.editing = null;
  render(true);
  scrollTo(0, y);
  return true;
}

/**
 * Flecha «‹» en un círculo a la izquierda del título (como en Spotify), solo cuando hay a dónde
 * volver. Hace lo mismo que el gesto y sirve también con el mouse. Va dentro del título, así la
 * cabecera no cambia de alto. Se llama en cada render.
 */
export function drawBackButton(view) {
  if (!canGoBack()) return;
  const title = [...view.querySelectorAll('.sticky-head .title')].find(t => !t.closest('[aria-hidden="true"]'));
  if (!title || title.querySelector('.back-btn')) return;
  title.classList.add('with-back');
  title.insertAdjacentHTML('afterbegin', `<button type="button" class="back-btn" data-a="goback" aria-label="${tr('Volver', 'Back')}" title="${tr('Volver', 'Back')}">${icon('left')}</button>`);
}

/** Gesto: arrastrar desde el borde izquierdo. La pantalla sigue al dedo; pasada la mitad (o con un
 *  movimiento rápido) vuelve; si no, regresa a su lugar. */
export function initBackSwipe() {
  const view = () => document.getElementById('v');
  let g = null;
  const set = x => view()?.style.setProperty('--back-x', `${x}px`);
  const end = (back) => {
    const v = view(), cur = g;
    g = null;
    if (!v || !cur?.active) return;
    v.classList.add('back-settle');
    set(back ? innerWidth : 0);
    setTimeout(() => {
      v.classList.remove('backing', 'back-settle');
      v.style.removeProperty('--back-x');
      if (!back) return;
      goBack();
      v.classList.add('back-in');
      setTimeout(() => v.classList.remove('back-in'), 300);
    }, 200);
  };
  // Al empezar en el borde (y si hay a dónde volver), los otros deslizamientos no se activan.
  window.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' && e.clientX <= EDGE && canGoBack() && !document.querySelector('dialog[open]')) e.stopImmediatePropagation();
  }, true);
  document.addEventListener('touchstart', e => {
    const t = e.touches[0];
    if (e.touches.length !== 1 || t.clientX > EDGE || !canGoBack() || document.querySelector('dialog[open]')) { g = null; return; }
    g = { x: t.clientX, y: t.clientY, t: e.timeStamp, active: false, last: [t.clientX, e.timeStamp] };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!g) return;
    const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > dx) { g = null; return; } // es desplazarse hacia abajo o arriba
      if (dx < 10) return;
      g.active = true;
      document.activeElement?.blur?.();
      view()?.classList.add('backing');
    }
    e.preventDefault();
    g.speed = (t.clientX - g.last[0]) / Math.max(1, e.timeStamp - g.last[1]);
    g.last = [t.clientX, e.timeStamp];
    set(Math.max(0, dx));
  }, { passive: false });
  document.addEventListener('touchend', e => {
    if (!g) return;
    const dx = (e.changedTouches[0]?.clientX ?? g.x) - g.x;
    end(g.active && (dx > innerWidth * 0.4 || (dx > 40 && g.speed > 0.45)));
  });
  document.addEventListener('touchcancel', () => end(false));
  // Un toque que terminó en gesto no debe abrir lo que había bajo el dedo.
  document.addEventListener('click', e => { if (view()?.classList.contains('backing')) { e.preventDefault(); e.stopPropagation(); } }, true);
}
