// Una taxonomía para hábitos y eventos. El índice se guarda; el color sale de los tokens CSS
// (--cat0…--cat5), así se adapta solo al modo claro u oscuro.
const NAMES = ['Trabajo y estudios', 'Hogar y gestiones', 'Salud y movimiento', 'Ocio y creatividad', 'Otros', 'Relaciones'];
/** Orden de presentación por frecuencia esperada (los índices guardados no cambian). */
export const CATEGORY_ORDER = [2, 0, 5, 1, 3, 4];

const valid = i => (Number.isInteger(i) && i >= 0 && i < 6 ? i : 0);
export const categoryColor = i => (i === -1 ? 'var(--cat4)' : `var(--cat${valid(i)})`);
export const categoryName = i => (i === -1 ? 'Sin categoría' : NAMES[valid(i)]);

export const MOODS = [
  [1, 'Pesado'], [2, 'Regular'], [3, 'Normal'], [4, 'Bien'], [5, 'Pleno'],
];
export const moodColor = n => `var(--mood${n})`;
export const moodName = n => (MOODS.find(([k]) => k === n) || [])[1] || '';
