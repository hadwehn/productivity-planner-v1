// Estado del diario: forma de los datos, validación y acceso por rutas.
//
// Mapa de claves (se conservan abreviadas por compatibilidad con los datos guardados):
//   h   hábitos [{id, name, days, color, createdOn}]
//   hl  registros de hábitos { 'AAAA-MM-DD': { idHábito: 0|1 } }
//   m   meses { 'AAAA-MM': { p: prioridades, h: highlights } }
//   ev  eventos { 'AAAA-MM-DD': [{ t: título, h: 'HH:MM' | '', c: categoría }] }
//   w   semanas { lunes: { i: intención, a: prioridades, b: otras, r: revisión } }
//   d   días { fecha: { i, g (gratitud), p (planes), r (reflexión), n/nRich (notas),
//              c (agenda por horas), k (tareas), priorityCount, otherCount } }
//       En d.k las claves 0, 501 y 502 son las tres tareas en foco; 1…500 el resto.
//       v2 agrega: d.mood (1-5), fila.drop (tarea soltada), h.perWeek (veces por semana),
//       cfg.today (qué se muestra en Hoy). Las versiones anteriores ignoran estos campos.
//   cfg preferencias
import { plain, iso, parseDate } from './util.js';

const FORBIDDEN = ['__proto__', 'constructor', 'prototype'];
const LEGACY_ACCENTS = 6;

export const blank = () => ({ h: [], hl: {}, m: {}, ev: {}, w: {}, d: {}, cfg: { acc: 0, hide: {}, days: {} } });

export let S;
export function setState(next) { S = next; }

let saveHandler = () => false;
export function onSave(fn) { saveHandler = fn; }
export function save() { return saveHandler(); }

export function get(path, fallback = '') {
  const value = path.split('.').reduce((o, k) => (o == null ? o : o[k]), S);
  return value ?? fallback;
}

export function setPath(path, value) {
  const keys = path.split('.');
  if (keys.some(k => FORBIDDEN.includes(k))) throw Error('Ruta no permitida.');
  let o = S;
  for (const k of keys.slice(0, -1)) {
    if (o[k] == null) o[k] = {};
    o = o[k];
  }
  o[keys[keys.length - 1]] = value;
  save();
}

// Primera barrera: forma general y claves peligrosas.
export function validateState(o) {
  if (!plain(o) || !Array.isArray(o.h)) throw Error('Falta la lista de hábitos.');
  const check = (v, depth = 0) => {
    if (depth > 30) throw Error('Archivo demasiado complejo.');
    if (v && typeof v === 'object') for (const k of Object.keys(v)) {
      if (FORBIDDEN.includes(k)) throw Error('Clave no permitida.');
      check(v[k], depth + 1);
    }
  };
  check(o);
  for (const k of ['hl', 'm', 'ev', 'w', 'd']) if (o[k] !== undefined && !plain(o[k])) throw Error('Formato incorrecto: ' + k);
  if (o.cfg !== undefined && !plain(o.cfg)) throw Error('Preferencias incorrectas.');
  for (const h of o.h) {
    if (!plain(h) || typeof h.id !== 'string' || !h.id || typeof h.name !== 'string'
      || (h.days !== undefined && (!Array.isArray(h.days) || h.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)))) throw Error('Hábito incorrecto.');
  }
  if (o.cfg?.order !== undefined && (!Array.isArray(o.cfg.order) || o.cfg.order.some(x => typeof x !== 'string'))) throw Error('Orden de módulos incorrecto.');
  if (new Set(o.h.map(h => h.id)).size !== o.h.length) throw Error('Hábitos duplicados.');
  for (const v of Object.values(o.ev || {})) {
    if (!Array.isArray(v) || v.some(x => typeof x !== 'string' && (!plain(x) || typeof x.t !== 'string' || (x.h !== undefined && typeof x.h !== 'string')))) throw Error('Evento incorrecto.');
  }
  for (const k of ['hl', 'm', 'w', 'd']) for (const v of Object.values(o[k] || {})) if (!plain(v)) throw Error('Registro incorrecto: ' + k);
  for (const k of ['hide', 'days']) if (o.cfg?.[k] !== undefined && !plain(o.cfg[k])) throw Error('Preferencias incorrectas.');
  for (const v of Object.values(o.cfg?.days || {})) if (!plain(v)) throw Error('Día personalizado incorrecto.');
  for (const day of Object.values(o.d || {})) {
    if (day.k !== undefined && !plain(day.k) && !Array.isArray(day.k)) throw Error('Tareas diarias incorrectas.');
    for (const row of Object.values(day.k || {})) if (row !== null && (!plain(row) || (row.t !== undefined && typeof row.t !== 'string'))) throw Error('Tarea incorrecta.');
    if (day.otherCount !== undefined && (!Number.isInteger(day.otherCount) || day.otherCount < 0 || day.otherCount > 500)) throw Error('Cantidad de tareas incorrecta.');
    if (day.priorityCount !== undefined && (!Number.isInteger(day.priorityCount) || day.priorityCount < 1 || day.priorityCount > 3)) throw Error('Cantidad de prioridades incorrecta.');
    if (day.c !== undefined && !plain(day.c)) throw Error('Agenda incorrecta.');
  }
  for (const week of Object.values(o.w || {})) for (const k of ['a', 'b']) {
    if (week[k] !== undefined && !plain(week[k]) && !Array.isArray(week[k])) throw Error('Tareas semanales incorrectas.');
    for (const row of Object.values(week[k] || {})) if (row !== null && (!plain(row) || (row.t !== undefined && typeof row.t !== 'string'))) throw Error('Tarea semanal incorrecta.');
  }
  return o;
}

export function normalize(o) {
  const v = Object.assign(blank(), o);
  v.cfg = Object.assign({ acc: 0, hide: {}, days: {} }, v.cfg);
  v.cfg.hide = v.cfg.hide || {};
  v.cfg.days = v.cfg.days || {};
  v.cfg.theme = v.cfg.theme === 'soft' ? 'soft' : 'modern';
  // 'auto' sigue al sistema. Las versiones anteriores solo conocían 'light' y 'dark'.
  v.cfg.appearance = ['light', 'dark'].includes(v.cfg.appearance) ? v.cfg.appearance : 'auto';
  for (const k of Object.keys(v.ev)) {
    v.ev[k] = v.ev[k].map(x => (typeof x === 'string'
      ? { t: x, c: 0, h: '' }
      : { ...x, c: Number.isInteger(x.c) && x.c >= -1 && x.c < 6 ? x.c : -1 }));
  }
  return v;
}

// Segunda barrera: tipos exactos. Se usa al cargar, guardar e importar.
export function checkedState(raw) {
  const o = normalize(validateState(structuredClone(raw)));
  const fail = m => { throw Error(m); };
  const text = (v, k) => { if (v !== undefined && typeof v !== 'string') fail('Texto incorrecto: ' + k); };
  const date = k => { if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || iso(parseDate(k)) !== k) fail('Fecha incorrecta: ' + k); };
  const collection = (v, k) => { if (v !== undefined && !plain(v) && !Array.isArray(v)) fail('Lista incorrecta: ' + k); };
  const texts = (v, k) => { collection(v, k); Object.values(v || {}).forEach(x => { if (x !== null) text(x, k); }); };
  const tasks = (v, k, max) => {
    collection(v, k);
    for (const [i, t] of Object.entries(v || {})) {
      if (!/^\d+$/.test(i) || +i > max) fail('Índice de tarea incorrecto: ' + k);
      if (t === null) continue;
      if (!plain(t)) fail('Tarea incorrecta: ' + k);
      text(t.t, k);
      if (t.c !== undefined && typeof t.c !== 'boolean') fail('Estado de tarea incorrecto.');
      if (t.s !== undefined && (!Number.isInteger(t.s) || t.s < 0 || t.s > 5)) fail('Sesiones incorrectas.');
      if (t.drop !== undefined && typeof t.drop !== 'boolean') fail('Estado de tarea incorrecto.');
      if (t.carriedFrom !== undefined && (typeof t.carriedFrom !== 'string' || !/^\d{4}-\d{2}-\d{2}:(?:0|[1-9]\d{0,2})$/.test(t.carriedFrom))) fail('Origen del traslado incorrecto.');
      if (t.source !== undefined) {
        if (typeof t.source !== 'string' || !/^w\.\d{4}-\d{2}-\d{2}\.[ab]\.[0-4]$/.test(t.source)) fail('Origen de tarea incorrecto.');
        date(t.source.split('.')[1]);
      }
    }
  };
  for (const h of o.h) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(h.id)) fail('Identificador de hábito incompatible.');
    if (h.createdOn !== undefined) date(h.createdOn);
    if (h.color !== undefined && (!Number.isInteger(h.color) || h.color < 0 || h.color > 5)) fail('Color de hábito incorrecto.');
    if (h.perWeek !== undefined && (!Number.isInteger(h.perWeek) || h.perWeek < 1 || h.perWeek > 7)) fail('Frecuencia de hábito incorrecta.');
  }
  for (const [k, v] of Object.entries(o.hl)) { date(k); for (const x of Object.values(v)) if (![0, 1, 2].includes(x)) fail('Registro de hábito incorrecto.'); }
  for (const [k, v] of Object.entries(o.ev)) {
    date(k);
    for (const e of v) {
      text(e.t, 'evento');
      if (e.c !== undefined && (!Number.isInteger(e.c) || e.c < -1 || e.c > 5)) fail('Categoría de evento incorrecta.');
      if (e.h !== undefined && (typeof e.h !== 'string' || !/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/.test(e.h))) fail('Hora incorrecta.');
    }
  }
  for (const [k, v] of Object.entries(o.m)) { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(k)) fail('Mes incorrecto.'); texts(v.p, 'prioridades'); texts(v.h, 'highlights'); }
  for (const [k, v] of Object.entries(o.w)) { date(k); text(v.i, 'intención semanal'); texts(v.r, 'revisión'); tasks(v.a, k, 4); tasks(v.b, k, 4); }
  for (const [k, v] of Object.entries(o.d)) {
    date(k);
    for (const f of ['n', 'nRich', 'g', 'g2', 'g3', 'i', 'p', 'r', 'hl', 'learn', 'remember']) text(v[f], f);
    tasks(v.k, k, 502);
    if (v.mood !== undefined && (!Number.isInteger(v.mood) || v.mood < 1 || v.mood > 5)) fail('Estado de ánimo incorrecto.');
    texts(v.c, 'agenda');
  }
  if (!Number.isInteger(o.cfg.acc) || o.cfg.acc < 0 || o.cfg.acc >= LEGACY_ACCENTS) fail('Color anterior incorrecto.');
  if (!['modern', 'soft'].includes(o.cfg.theme)) fail('Estilo incorrecto.');
  for (const v of Object.values(o.cfg.hide)) if (typeof v !== 'boolean') fail('Visibilidad incorrecta.');
  if (o.cfg.journalLock !== undefined && (!plain(o.cfg.journalLock) || !/^[0-9a-f]{64}$/.test(o.cfg.journalLock.hash) || !/^[0-9a-f]{32}$/.test(o.cfg.journalLock.salt))) fail('Código del Diario incorrecto.');
  if (o.cfg.today !== undefined && (!plain(o.cfg.today) || Object.values(o.cfg.today).some(x => typeof x !== 'boolean'))) fail('Preferencias de Hoy incorrectas.');
  for (const [k, v] of Object.entries(o.cfg.days)) {
    if (!/^[0-6]$/.test(k) || Object.values(v).some(x => typeof x !== 'boolean')) fail('Día personalizado incorrecto.');
  }
  if (new Blob([JSON.stringify(o)]).size > 9 * 1024 * 1024) fail('Agenda demasiado grande (máximo práctico 9 MiB).');
  return o;
}

export function summary(o) {
  const rows = periods => Object.values(periods).flatMap(v => Object.values(v.k || {})).filter(Boolean);
  const links = rows(o.d).filter(x => x.source);
  return {
    habitos: o.h.length,
    diasHabitos: Object.keys(o.hl).length,
    marcasHabitos: Object.values(o.hl).reduce((n, x) => n + Object.keys(x).length, 0),
    eventos: Object.values(o.ev).reduce((n, x) => n + x.length, 0),
    meses: Object.keys(o.m).length,
    semanas: Object.keys(o.w).length,
    dias: Object.keys(o.d).length,
    tareasDiarias: rows(o.d).length,
    tareasSemanales: Object.values(o.w).reduce((n, x) => n + ['a', 'b'].reduce((m, k) => m + Object.values(x[k] || {}).filter(Boolean).length, 0), 0),
    vinculos: links.length,
    origenesAusentes: links.filter(x => { const [, k, r, i] = x.source.split('.'); return !o.w[k]?.[r]?.[i]; }).length,
    bytesUTF8: new Blob([JSON.stringify(o)]).size,
  };
}

S = normalize(blank());
