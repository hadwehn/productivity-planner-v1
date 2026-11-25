// Ideas de hábitos para quien no sabe por dónde empezar (se ofrecen en «Nuevo hábito», ver
// habitEditor en sheets.js). Cada idea trae su área (índice de categories.js) y una frecuencia
// sugerida: días fijos (`days`, 0 = lunes) o veces por semana (`perWeek`). La persona puede
// ajustarla antes de crear el hábito. Son pequeñas a propósito: lo difícil es la constancia.
import { tr } from './i18n.js';

const EVERY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];

export const HABIT_IDEAS = () => [
  {
    title: tr('Cuerpo', 'Body'),
    items: [
      [tr('Caminar 30 minutos', 'Walk for 30 minutes'), 2, { days: EVERY }],
      [tr('Hacer 20 flexiones', 'Do 20 push-ups'), 2, { days: EVERY }],
      [tr('Entrenar', 'Work out'), 2, { perWeek: 3 }],
      [tr('Estirar 10 minutos', 'Stretch for 10 minutes'), 2, { days: EVERY }],
      [tr('Tomar 2 litros de agua', 'Drink 2 liters of water'), 2, { days: EVERY }],
      [tr('Tomar suplementos', 'Take supplements'), 2, { days: EVERY }],
      [tr('Usar hilo dental', 'Floss'), 2, { days: EVERY }],
      [tr('Lavarme los dientes después de almorzar', 'Brush my teeth after lunch'), 2, { days: EVERY }],
    ],
  },
  {
    title: tr('Mente', 'Mind'),
    items: [
      [tr('Meditar 10 minutos', 'Meditate for 10 minutes'), 2, { days: EVERY }],
      [tr('Leer 20 páginas', 'Read 20 pages'), 3, { days: EVERY }],
      [tr('Leer noticias 15 minutos', 'Read the news for 15 minutes'), 0, { days: WEEKDAYS }],
      [tr('Practicar un idioma', 'Practice a language'), 0, { days: WEEKDAYS }],
      [tr('Escribir 5 minutos', 'Write for 5 minutes'), 3, { days: EVERY }],
    ],
  },
  {
    title: tr('Descanso y pantallas', 'Rest and screens'),
    items: [
      [tr('Sin pantallas después de las 21:00', 'No screens after 9 pm'), 2, { days: EVERY }],
      [tr('Celular fuera del dormitorio', 'Phone out of the bedroom'), 2, { days: EVERY }],
      [tr('Sin redes sociales antes de las 10:00', 'No social media before 10 am'), 2, { days: EVERY }],
      [tr('Acostarme antes de las 23:00', 'In bed before 11 pm'), 2, { days: EVERY }],
    ],
  },
  {
    title: tr('Orden y personas', 'Order and people'),
    items: [
      [tr('Hacer la cama', 'Make the bed'), 1, { days: EVERY }],
      [tr('Ordenar 10 minutos', 'Tidy up for 10 minutes'), 1, { days: EVERY }],
      [tr('Revisar mis gastos', 'Review my spending'), 1, { perWeek: 1 }],
      [tr('Comer sin pantallas', 'Eat without screens'), 5, { days: EVERY }],
      [tr('Llamar a alguien que quiero', 'Call someone I love'), 5, { perWeek: 2 }],
    ],
  },
];
