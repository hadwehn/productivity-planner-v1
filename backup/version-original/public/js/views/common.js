// Piezas de interfaz compartidas por las vistas.
import { get } from '../state.js';
import { esc, monthTitle, today } from '../util.js';

/** Campo de texto que crece con el contenido. Enter pasa al siguiente; Mayús+Enter salta línea. */
export const field = (path, placeholder = '', rows = 1, id = '') =>
  `<textarea data-p="${path}"${id ? ` id="${id}"` : ''} rows="${rows}" enterkeyhint="next" aria-label="${esc(placeholder || path)}" placeholder="${esc(placeholder)}">${esc(get(path))}</textarea>`;

export const check = path => {
  const on = !!get(path, false);
  return `<button class="chk${on ? ' on' : ''}" data-a="tog" data-p="${path}" aria-label="Marcar como hecha" aria-pressed="${on}">${on ? '✓' : ''}</button>`;
};

export const segmented = (action, options, current) => `<div class="seg">${options.map(([k, label]) =>
  `<button class="${k === current ? 'on' : ''}" data-a="${action}" data-k="${k}" aria-pressed="${k === current}">${label}</button>`).join('')}</div>`;

/**
 * Cabecera con flechas anterior/siguiente y, si corresponde, un enlace para volver al presente.
 * `nav` y `reset` son atributos data-* de los botones.
 */
export const pagerHeader = ({ nav, title, subtitle = '', prev, next, reset = '', resetLabel = '', h1 = true }) =>
  `<div class="top"><button class="ib" ${nav} data-n="-1" aria-label="${prev}">‹</button>`
  + `<div>${h1 ? `<h1>${title}</h1>` : `<b class="month-name">${title}</b>`}`
  + `<div class="sub">${subtitle}${reset ? `${subtitle ? ' · ' : ''}<button class="link-inline" ${reset}>${resetLabel}</button>` : ''}</div></div>`
  + `<button class="ib" ${nav} data-n="1" aria-label="${next}">›</button></div>`;

export const pageTitle = (title, subtitle = '') => `<div class="top"><div><h1>${title}</h1><div class="sub">${subtitle}</div></div></div>`;

export const monthNav = (key, ym) => pagerHeader({
  nav: `data-a="m" data-k="${key}"`, title: monthTitle(ym), h1: false, prev: 'Mes anterior', next: 'Mes siguiente',
  reset: ym !== today().slice(0, 7) ? `data-a="hoy" data-k="${key}"` : '', resetLabel: 'Ir a hoy',
});

export const emptyState = () => '<p class="sub empty">Tienes todo oculto. Actívalo desde el botón ⋯.</p>';

export const ring = (percent, label, big = false, id = '') =>
  `<div${id ? ` id="${id}"` : ''} class="ring${big ? ' big' : ''}" style="--p:${percent}"><span>${label}</span></div>`;
