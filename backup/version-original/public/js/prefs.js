// Qué espacios se muestran: por grupo (días de semana / fin de semana) o por día concreto.
import { S, save } from './state.js';
import { U } from './ui.js';
import { DAYS, DAY_SHORT } from './util.js';

// Valores por defecto: true = visible. Las claves terminan en _wk (lun-vie) o _we (sáb-dom).
const DEFAULTS = {
  d_pl_wk: false, d_star_we: true, d_oth_we: true, d_co_we: false, d_hab_wk: true, d_hab_we: true,
  d_co_wk: false, d_learn_wk: false, d_learn_we: false, d_remember_wk: false, d_remember_we: false,
};

export const visible = k => { const v = S.cfg.hide[k]; return v === undefined ? DEFAULTS[k] !== false : !v; };
export const dayGroup = w => (w > 4 ? 'we' : 'wk');
export const dayVisible = (k, w) => { const o = S.cfg.days[w] || {}; return o[k] === undefined ? visible(k + '_' + dayGroup(w)) : o[k]; };
export const hasDayOverrides = w => Object.keys(S.cfg.days[w] || {}).length > 0;
export const hasAnyDayOverrides = () => DAYS.some((_, w) => hasDayOverrides(w));

export function setDayVisibility(k, w, value) {
  const overrides = S.cfg.days[w] = S.cfg.days[w] || {};
  if (value === visible(k + '_' + dayGroup(w))) delete overrides[k];
  else overrides[k] = value;
  if (!Object.keys(overrides).length) delete S.cfg.days[w];
}
export function setGroupVisibility(k, group, value) { S.cfg.hide[k + '_' + group] = !value; }

// Espacios del día, en el orden en que aparecen.
export const DAY_SECTIONS = [
  ['Al partir el día', [['d_int', 'Intención del día'], ['d_gr', 'Gratitud']]],
  ['Durante el día', [['d_star', 'Tareas más importantes'], ['d_oth', 'Tareas secundarias'], ['d_pl', 'Planes del día'], ['d_co', 'Agenda por horas']]],
  ['Hábitos del día', [['d_hab', 'Hábitos del día']]],
  ['Al terminar el día', [['d_rf', 'Reflexión del día']]],
];
const DAY_MODULES = DAY_SECTIONS.flatMap(([, list]) => list);

export const WEEK_QUESTIONS = [
  '¿Qué te hizo bien esta semana?',
  '¿Qué quieres retomar o dejar para después?',
  '¿Qué aprendiste y te gustaría llevar a la próxima semana?',
  '¿Qué podrías ajustar para cuidarte y enfocarte mejor?',
];
const WEEK_SECTIONS = [
  ['Plan', [['w_prog', 'Progreso de la semana'], ['w_int', 'Intención de la semana'], ['w_imp', 'Tareas importantes'], ['w_sec', 'Tareas secundarias']]],
  ['Revisión', WEEK_QUESTIONS.map((q, i) => ['w_r' + i, q])],
];

export const PRESETS = {
  light: { label: 'Ligero', description: 'Una intención, tu prioridad y una reflexión breve.', modules: ['d_int', 'd_star', 'd_rf'] },
  balanced: { label: 'Equilibrado', description: 'Intención, gratitud, hábitos, tareas y reflexión.', modules: ['d_int', 'd_gr', 'd_hab', 'd_star', 'd_oth', 'd_rf'] },
  full: { label: 'Completo', description: 'Todos los espacios, incluidos planes y agenda por horas.', modules: ['d_int', 'd_gr', 'd_hab', 'd_star', 'd_oth', 'd_pl', 'd_co', 'd_rf'] },
};
export function applyPreset(key, initial = false) {
  const preset = PRESETS[key];
  if (!preset) return;
  for (const [k] of DAY_MODULES) for (const group of ['wk', 'we']) setGroupVisibility(k, group, preset.modules.includes(k));
  if (initial) S.cfg.days = {};
  S.cfg.preset = key;
  S.cfg.closeUnified = true;
  save();
}
export function modeCards(action = 'preset', selected = S.cfg.preset) {
  return `<div class="mode-list">${Object.entries(PRESETS).map(([key, p]) =>
    `<button class="mode-card${key === selected ? ' selected' : ''}" data-a="${action}" data-k="${key}" aria-pressed="${key === selected}"><b>${p.label}</b><span>${p.description}</span></button>`).join('')}</div>`;
}

const toggle = (label, attrs, checked) => `<label class="tg"><span>${label}</span><input type="checkbox" ${attrs}${checked ? ' checked' : ''}></label>`;

function dayPrefsHTML() {
  const perDay = U.pm === 'day', w = U.pday;
  const tabs = `<div class="seg prefs-tabs">
    <button id="pref-mode-group" class="${perDay ? '' : 'on'}" data-a="prefmode" data-k="group" aria-pressed="${!perDay}">Por categoría</button>
    <button id="pref-mode-day" class="${perDay ? 'on' : ''}" data-a="prefmode" data-k="day" aria-pressed="${perDay}">Por día</button></div>`;
  let body;
  if (perDay) {
    const picks = DAYS.map((name, i) => `<button id="pref-day-${i}" class="${i === w ? 'on ' : ''}${hasDayOverrides(i) ? 'custom' : ''}" data-a="prefday" data-i="${i}" aria-label="${name}" aria-pressed="${i === w}">${DAY_SHORT[i]}</button>`).join('');
    const rows = DAY_SECTIONS.map(([title, list]) => `<h2 class="pref-title">${title}</h2>`
      + list.map(([k, label]) => toggle(label, `id="pref-${k}" data-a="dayvis" data-k="${k}"`, dayVisible(k, w))).join('')).join('');
    body = `<div class="day-picks" aria-label="Día de la semana">${picks}</div><b>${DAYS[w]}</b>
      <p class="sub pref-state">${hasDayOverrides(w) ? 'Este día tiene ajustes propios.' : 'Este día sigue la configuración de ' + (w < 5 ? 'días de semana.' : 'fin de semana.')} Los cambios se aplican cada ${DAYS[w].toLowerCase()}.</p>
      ${hasDayOverrides(w) ? '<button id="pref-reset" class="link" data-a="prefreset">Volver a la categoría base</button>' : ''}${rows}`;
  } else {
    const groups = ['wk', 'we'].map(group => `<div class="prefs-group"><h2 class="pref-title">${group === 'wk' ? 'Días de semana · lunes a viernes' : 'Fin de semana · sábado y domingo'}</h2>`
      + DAY_SECTIONS.map(([title, list]) => `<p class="prefs-group-sub">${title}</p>`
        + list.map(([k, label]) => toggle(label, `data-a="groupvis" data-group="${group}" data-k="${k}"`, visible(k + '_' + group))).join('')).join('')
      + '</div>').join('');
    const any = hasAnyDayOverrides();
    body = `<details class="preset-options"><summary>Usar una configuración rápida</summary>${modeCards()}</details>${groups}
      <p class="mode-description">Los ajustes individuales de «Por día» tienen prioridad sobre estas categorías.${any ? ' Algunos días tienen ajustes propios.' : ''}</p>
      ${any ? '<button class="link" data-a="allreset">Restablecer los días personalizados</button>' : ''}`;
  }
  return `<h2>Tu día, a tu manera</h2><p class="sub">Personaliza los días de semana y el fin de semana por separado, o ajusta un día específico.</p>${tabs}${body}<hr class="hr0">`;
}

function weekPrefsHTML() {
  return `<details><summary class="link">Personalizar la semana</summary><p class="sub">Ocultar espacios conserva lo que escribiste.</p>`
    + WEEK_SECTIONS.map(([title, list]) => `<h2 class="pref-title">${title}</h2>`
      + list.map(([k, label]) => toggle(label, `data-a="vis" data-k="${k}"`, visible(k))).join('')).join('')
    + '</details><hr class="hr0">';
}

export const prefsHTML = () => dayPrefsHTML() + (U.tab === 'w' ? weekPrefsHTML() : '');
