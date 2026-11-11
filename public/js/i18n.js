// Idioma de la interfaz: español (base) o inglés. Se guarda en la cuenta (cfg.lang) y en el
// dispositivo, para que la pantalla de acceso salga en el idioma correcto antes de cargar datos.
import { DAYS, DAY_SHORT, MONTHS } from './util.js';

const KEY = 'diario-idioma';
const NAMES = {
  es: {
    months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    short: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  },
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    short: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
};

let lang = 'es';
export const getLang = () => lang;
export const isEn = () => lang === 'en';
/** Texto según el idioma activo: tr('Tareas', 'Tasks'). */
export const tr = (es, en) => (lang === 'en' ? en : es);
/** Plural simple: plural(n, 'día', 'días', 'day', 'days'). */
export const plural = (n, es1, esN, en1, enN) => (n === 1 ? tr(es1, en1) : tr(esN, enN));

export function storedLang() {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'es'; } catch { return 'es'; }
}

export function setLang(value, remember = true) {
  lang = value === 'en' ? 'en' : 'es';
  // Las listas de fechas se actualizan en su lugar: todos los módulos las comparten.
  const n = NAMES[lang];
  MONTHS.splice(0, 12, ...n.months);
  DAYS.splice(0, 7, ...n.days);
  DAY_SHORT.splice(0, 7, ...n.short);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    applyStatic();
  }
  if (remember) { try { localStorage.setItem(KEY, lang); } catch { /* almacenamiento bloqueado */ } }
}

/** «10 de noviembre» / «November 10». */
export const dayMonth = d => tr(`${d.getDate()} de ${MONTHS[d.getMonth()]}`, `${MONTHS[d.getMonth()]} ${d.getDate()}`);
/** «10 nov» / «Nov 10». */
export const dayMonthShort = d => tr(`${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`, `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`);
/** «noviembre 2026» / «November 2026». */
export const monthYear = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };

/**
 * Textos fijos de index.html: el elemento guarda su versión en español y lleva la inglesa en
 * data-en (contenido), data-en-placeholder o data-en-label (aria-label).
 */
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll('[data-en]')) {
    if (el.dataset.es === undefined) el.dataset.es = el.innerHTML;
    el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.es;
  }
  for (const el of root.querySelectorAll('[data-en-placeholder]')) {
    if (el.dataset.esPlaceholder === undefined) el.dataset.esPlaceholder = el.placeholder;
    el.placeholder = lang === 'en' ? el.dataset.enPlaceholder : el.dataset.esPlaceholder;
  }
  for (const el of root.querySelectorAll('[data-en-label]')) {
    if (el.dataset.esLabel === undefined) el.dataset.esLabel = el.getAttribute('aria-label') || '';
    el.setAttribute('aria-label', lang === 'en' ? el.dataset.enLabel : el.dataset.esLabel);
  }
}
