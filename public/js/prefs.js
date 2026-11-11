// Visibilidad heredada de la versión anterior (por día de semana / fin de semana).
// v2 ya no la muestra; se conserva para migrar las preferencias a «Qué ver en Hoy».
import { S } from './state.js';

// Valores por defecto de v1: true = visible. Las claves terminan en _wk (lun-vie) o _we (sáb-dom).
const DEFAULTS = {
  d_pl_wk: false, d_star_we: true, d_oth_we: true, d_co_we: false, d_hab_wk: true, d_hab_we: true,
  d_co_wk: false, d_learn_wk: false, d_learn_we: false, d_remember_wk: false, d_remember_we: false,
};

export const visible = k => { const v = S.cfg.hide[k]; return v === undefined ? DEFAULTS[k] !== false : !v; };
export const dayGroup = w => (w > 4 ? 'we' : 'wk');
export const dayVisible = (k, w) => { const o = S.cfg.days[w] || {}; return o[k] === undefined ? visible(k + '_' + dayGroup(w)) : o[k]; };

export const WEEK_QUESTIONS = [
  '¿Qué te hizo bien esta semana?',
  '¿Qué quieres retomar o dejar para después?',
  '¿Qué aprendiste y te gustaría llevar a la próxima semana?',
  '¿Qué podrías ajustar para cuidarte y enfocarte mejor?',
];
