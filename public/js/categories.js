// Una sola taxonomía para hábitos y eventos. El índice conserva color y compatibilidad con respaldos.
import { S } from './state.js';

export const PALETTES = {
  modern: ['#3569B0', '#FF4050', '#2FC45B', '#AC4EDF', '#FF9B00', '#24AFC1'],
  soft: ['#3569B0', '#B96B65', '#4D8970', '#9478B5', '#C28F44', '#518D9B'],
};
const NAMES = ['Trabajo y estudios', 'Hogar y gestiones', 'Salud y movimiento', 'Ocio y creatividad', 'Otros', 'Relaciones y social'];
/** Orden de presentación por frecuencia esperada (los índices guardados no cambian). */
const ORDER = [2, 0, 5, 1, 3, 4];
const NONE_COLOR = '#A6ADB7';

const valid = i => (Number.isInteger(i) && i >= 0 && i < 6 ? i : 0);
export const categoryColor = i => (i === -1 ? NONE_COLOR : PALETTES[S.cfg.theme === 'soft' ? 'soft' : 'modern'][valid(i)]);
export const categoryName = i => (i === -1 ? 'Sin categoría' : NAMES[valid(i)]);

export const categoryChoices = (name, selected) => ORDER.map(i =>
  `<label class="category-choice" title="${categoryName(i)}"><input type="radio" name="${name}" value="${i}"${selected === i ? ' checked' : ''}><span style="background:${categoryColor(i)}"></span><small>${categoryName(i)}</small></label>`).join('');
