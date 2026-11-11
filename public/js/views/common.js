// Piezas compartidas por las vistas.
import { get } from '../state.js';
import { esc } from '../util.js';
import { icon } from '../icons.js';

/** Campo de texto que crece con el contenido y se guarda solo (data-p = ruta en el estado). */
export const field = (path, placeholder = '', cls = '', extra = '') =>
  `<textarea data-p="${path}" rows="1" enterkeyhint="next" class="${cls}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"${extra}>${esc(get(path))}</textarea>`;

export const settingsButton = () =>
  `<button class="icon-btn" data-a="settings" aria-label="Ajustes y cuenta" title="Ajustes y cuenta">${icon('settings')}<span class="sync-dot" aria-hidden="true"></span></button>`;

export const pageHead = ({ eyebrow = '', title, subtitle = '', side = settingsButton() }) =>
  `<header class="page-head"><div>${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1 class="title">${title}</h1>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}</div>${side}</header>`;

/** Cabecera que queda fija arriba al desplazarse (título y controles de navegación). */
export const stickyHead = inner => `<div class="sticky-head">${inner}</div>`;

export const sectionHead = (label, right = '', cls = '') =>
  `<div class="section-head"><h2 class="label ${cls}">${label}</h2>${right}</div>`;

export const checkButton = (on, attrs, label = 'Marcar como hecha') =>
  `<button class="check${on ? ' on' : ''}" ${attrs} aria-pressed="${!!on}" aria-label="${esc(label)}">${icon('check')}</button>`;

export const segmented = (action, options, current) => `<div class="seg" role="tablist">${options.map(([k, label]) =>
  `<button role="tab" class="${k === current ? 'on' : ''}" data-a="${action}" data-k="${k}" aria-selected="${k === current}">${label}</button>`).join('')}</div>`;

/** Bloque plegable con cabecera (rituales, revisión, notas). */
export const foldable = ({ key, open, iconName, iconCls = '', title, summary, written = false, body }) =>
  `<section class="card ritual${open ? ' open' : ''}">
    <button class="ritual-head" data-a="fold" data-k="${key}" aria-expanded="${open}">
      <span class="ritual-icon ${iconCls}">${icon(iconName)}</span>
      <span class="ritual-text"><strong>${title}</strong><small class="${written ? 'written' : ''}">${summary}</small></span>
      <span class="chev">${icon('down')}</span>
    </button>
    ${open ? `<div class="ritual-body">${body}</div>` : ''}
  </section>`;
