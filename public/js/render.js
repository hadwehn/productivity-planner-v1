// Dibuja la pestaña activa conservando scroll y paneles abiertos.
import { U } from './ui.js';
import { $, $$ } from './util.js';
import { habitsView } from './views/habits.js';
import { calendarView } from './views/calendar.js';
import { weekView } from './views/week.js';
import { dayView } from './views/day.js';

const VIEWS = { h: habitsView, c: calendarView, w: weekView, d: dayView };
export const TABS = [['h', 'Hábitos'], ['c', 'Calendario'], ['w', 'Semana'], ['d', 'Día']];
const ICONS = {
  h: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  c: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  w: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  d: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
};

export function renderNav() {
  $('#nav').innerHTML = TABS.map(([k, label]) => `<button data-a="go" data-k="${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>${label}</button>`).join('');
}

export function expandTextArea(el) {
  if (!(el instanceof HTMLTextAreaElement)) return;
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, el.rows === 1 ? 43 : 0) + 'px';
}

/** Vuelve a dibujar la vista. `toTop` lleva el scroll arriba (cambios de página). */
export function render(toTop = false) {
  const y = scrollY, opened = $$('#v .effort').map(x => x.open);
  const view = $('#v');
  view.innerHTML = VIEWS[U.tab]();
  $$('#v .effort').forEach((x, i) => { x.open = !!opened[i]; });
  $$('#nav button').forEach(b => {
    b.classList.toggle('on', b.dataset.k === U.tab);
    b.setAttribute('aria-current', b.dataset.k === U.tab ? 'page' : 'false');
  });
  // Los campos sin texto de ayuda toman su nombre accesible del título de la tarjeta.
  for (const card of $$('#v .card')) {
    const label = card.querySelector('.q,h2');
    if (label) card.querySelectorAll('textarea:not([placeholder]),textarea[placeholder=""]').forEach((f, i) => f.setAttribute('aria-label', label.textContent + (i ? ' ' + (i + 1) : '')));
  }
  $$('textarea[data-p]', view).forEach(expandTextArea);
  const chip = $('.chip.on');
  if (chip) chip.parentNode.scrollLeft = chip.offsetLeft - chip.parentNode.clientWidth / 2 + 23;
  scrollTo(0, toTop ? 0 : y);
}

/** Enfoca el campo de una ruta y deja el cursor al final. */
export function focusPath(path) {
  const el = document.querySelector(`textarea[data-p="${path}"]`);
  if (!el) return false;
  focusField(el);
  return true;
}
export function focusField(el) {
  el.focus({ preventScroll: true });
  const end = el.value.length;
  el.setSelectionRange?.(end, end);
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
