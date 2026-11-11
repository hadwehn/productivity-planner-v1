// Una taxonomía para hábitos y eventos. El índice se guarda; el color sale de los tokens CSS
// (--cat0…--cat5), así se adapta solo al modo claro u oscuro.
import { tr } from './i18n.js';

const NAMES = () => [
  tr('Trabajo y estudios', 'Work & study'), tr('Hogar y gestiones', 'Home & errands'), tr('Salud y movimiento', 'Health & movement'),
  tr('Ocio y creatividad', 'Leisure & creativity'), tr('Otros', 'Other'), tr('Relaciones', 'Relationships'),
];
/** Orden de presentación por frecuencia esperada (los índices guardados no cambian). */
export const CATEGORY_ORDER = [2, 0, 5, 1, 3, 4];

const valid = i => (Number.isInteger(i) && i >= 0 && i < 6 ? i : 0);
export const categoryColor = i => (i === -1 ? 'var(--cat4)' : `var(--cat${valid(i)})`);
export const categoryName = i => (i === -1 ? tr('Sin categoría', 'No category') : NAMES()[valid(i)]);

/** Ánimo del día: 1 (pesado) a 5 (pleno). */
export const MOOD_LEVELS = [1, 2, 3, 4, 5];
export const moodName = n => ({
  1: tr('Pesado', 'Heavy'), 2: tr('Regular', 'Meh'), 3: tr('Normal', 'Okay'), 4: tr('Bien', 'Good'), 5: tr('Pleno', 'Great'),
}[n] || '');
export const moodColor = n => `var(--mood${n})`;
