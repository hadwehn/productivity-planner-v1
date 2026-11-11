// Actualiza datos guardados por versiones anteriores. Cada paso es idempotente.
import { S } from './state.js';
import { visible, dayVisible, dayGroup } from './prefs.js';
import { DAYS, plain } from './util.js';

// Claves de visibilidad antiguas (sin _wk/_we) pasan a días de semana y fin de semana.
function splitLegacyVisibility() {
  const h = S.cfg.hide, both = ['d_gr', 'd_hl', 'd_rf'], weekdays = ['d_star', 'd_oth', 'd_co'];
  for (const k of Object.keys(h).filter(k => /^d_/.test(k) && !/_(wk|we)$/.test(k))) {
    const v = h[k];
    delete h[k];
    if (both.includes(k)) { h[k + '_wk'] = v; h[k + '_we'] = v; }
    else if (weekdays.includes(k)) h[k + '_wk'] = v;
    else if (k === 'd_pl') h[k + '_we'] = v;
  }
}

// Los antiguos cierres (momento, aprendizaje, recuerdo) se unifican en «Reflexión del día».
function unifyClosure() {
  if (S.cfg.closeUnified) return;
  const OLD = ['d_hl', 'd_rf', 'd_learn', 'd_remember'];
  const oldDays = DAYS.map((_, w) => OLD.some(k => dayVisible(k, w)));
  for (const group of ['wk', 'we']) S.cfg.hide['d_rf_' + group] = !OLD.some(k => visible(k + '_' + group));
  for (let w = 0; w < 7; w++) {
    const overrides = S.cfg.days[w] || {};
    for (const k of ['d_hl', 'd_learn', 'd_remember']) delete overrides[k];
    if (oldDays[w] !== visible('d_rf_' + dayGroup(w))) overrides.d_rf = oldDays[w];
    else delete overrides.d_rf;
    if (Object.keys(overrides).length) S.cfg.days[w] = overrides;
    else delete S.cfg.days[w];
  }
  S.cfg.closeUnified = true;
}

// La gratitud pasó de tres espacios (g, g2, g3) a uno solo (g).
function mergeGratitude() {
  for (const day of Object.values(S.d)) {
    if (!plain(day) || (day.g2 === undefined && day.g3 === undefined)) continue;
    const parts = ['g', 'g2', 'g3'].map(k => (typeof day[k] === 'string' ? day[k].trim() : '')).filter(Boolean);
    if (parts.length) day.g = parts.join('\n');
    else delete day.g;
    delete day.g2;
    delete day.g3;
  }
}

// Las tareas del día se guardan como objeto (antes a veces como lista con huecos).
// En el modelo 2, «otherCount» es la cantidad exacta de filas secundarias visibles.
function tidyTasks() {
  const firstRun = S.cfg.tasks !== 2;
  for (const day of Object.values(S.d)) {
    if (Array.isArray(day.k)) {
      const rows = {};
      day.k.forEach((row, i) => { if (row) rows[i] = row; });
      day.k = rows;
    }
    for (const [i, row] of Object.entries(day.k || {})) {
      if (row == null || (plain(row) && !Object.keys(row).length)) delete day.k[i];
    }
    if (firstRun) delete day.otherCount;
  }
  S.cfg.tasks = 2;
}

export function migrate() {
  splitLegacyVisibility();
  unifyClosure();
  mergeGratitude();
  tidyTasks();
  delete S.cfg.order; // El orden de los espacios ya no es configurable.
}
