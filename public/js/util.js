// Utilidades sin estado: DOM, fechas y texto seguro.
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const p2 = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const shiftDate = (s, n) => iso(addDays(parseDate(s), n));
/** Lunes = 0 … Domingo = 6 */
export const weekday = d => (d.getDay() + 6) % 7;
export const weekdayOf = s => weekday(parseDate(s));
export const monday = d => addDays(d, -weekday(d));
export const today = () => iso(new Date());
export const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; };
export const monthTitle = ym => { const [y, m] = ym.split('-'); return `${MONTHS[m - 1]} ${y}`; };
export const daysInMonth = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const plain = o => o !== null && typeof o === 'object' && !Array.isArray(o);
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const range = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
