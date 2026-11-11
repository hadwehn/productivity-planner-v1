// Frases del día. Todas tienen fuente documentada; las traducciones al español son propias.
// El orden alterna autores para que días seguidos no repitan voz.
export const QUOTES = [
  ['Ningún día en el que aprendes algo es una pérdida total.', 'David Eddings'],
  ['No es que tengamos poco tiempo, sino que perdemos mucho.', 'Séneca'],
  ['La vida es como andar en bicicleta. Para mantener el equilibrio, debes seguir avanzando.', 'Albert Einstein'],
  ['Lo que se interpone en el camino se convierte en el camino.', 'Marco Aurelio'],
  ['Tu éxito es una serie de pequeñas victorias.', 'Jamie Tardy'],
  ['No son las cosas las que nos perturban, sino las opiniones que tenemos sobre ellas.', 'Epicteto'],
  ['Somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto, sino un hábito.', 'Will Durant'],
  ['Conviértete en todo aquello que eres capaz de llegar a ser.', 'Abraham Maslow'],
  ['Mientras se aplaza, la vida pasa.', 'Séneca'],
  ['Cómo pasamos nuestros días es, por supuesto, cómo pasamos nuestras vidas.', 'Annie Dillard'],
  ['El optimismo es la fe que conduce al logro.', 'Helen Keller'],
  ['El alma se tiñe del color de sus pensamientos.', 'Marco Aurelio'],
  ['No te elevas al nivel de tus metas. Caes al nivel de tus sistemas.', 'James Clear'],
  ['Primero di quién quieres ser; luego haz lo que tengas que hacer.', 'Epicteto'],
  ['Una clave importante para la confianza en uno mismo es la preparación.', 'Arthur Ashe'],
  ['Un viaje de mil millas comienza con un solo paso.', 'Lao Tse'],
  ['Sufrimos más a menudo en la imaginación que en la realidad.', 'Séneca'],
  ['No basta con estar ocupado; también lo están las hormigas. La pregunta es: ¿en qué estamos ocupados?', 'Henry David Thoreau'],
  ['La gratitud no es solo la mayor de las virtudes, sino la madre de todas las demás.', 'Cicerón'],
  ['Si no es correcto, no lo hagas; si no es verdad, no lo digas.', 'Marco Aurelio'],
  ['Define el éxito según tus propios términos. Alcánzalo siguiendo tus propias reglas.', 'Anne Sweeney'],
  ['No hay nada tan inútil como hacer con gran eficiencia algo que no debería hacerse en absoluto.', 'Peter Drucker'],
  ['Ninguna gran cosa se produce de repente.', 'Epicteto'],
  ['Nadie necesita esperar ni un solo momento para empezar a mejorar el mundo.', 'Ana Frank'],
  ['Ningún viento es favorable para quien no sabe a qué puerto se dirige.', 'Séneca'],
  ['Cada acción que realizas es un voto por la persona en quien quieres convertirte.', 'James Clear'],
  ['Muy poco se necesita para tener una vida feliz.', 'Marco Aurelio'],
  ['Lo importante rara vez es urgente, y lo urgente rara vez es importante.', 'Dwight D. Eisenhower'],
  ['La vida solo puede comprenderse mirando hacia atrás, pero debe vivirse mirando hacia adelante.', 'Søren Kierkegaard'],
  ['Comienza de una vez a vivir, y cuenta cada día como una vida aparte.', 'Séneca'],
  ['¿Amas la vida? Entonces no malgastes el tiempo, porque es la materia de la que está hecha la vida.', 'Benjamin Franklin'],
  ['Es imposible que alguien aprenda lo que cree que ya sabe.', 'Epicteto'],
  ['La perfección se alcanza no cuando no hay nada más que añadir, sino cuando no hay nada más que quitar.', 'Antoine de Saint-Exupéry'],
  ['No discutas más sobre cómo debe ser una buena persona. Sé una.', 'Marco Aurelio'],
  ['Nada en la vida debe ser temido, solo comprendido.', 'Marie Curie'],
  ['Mientras enseñamos, aprendemos.', 'Séneca'],
  ['Concentrarse consiste en decir que no.', 'Steve Jobs'],
  ['¿Qué piensas hacer con tu única, salvaje y preciosa vida?', 'Mary Oliver'],
  ['No es pobre quien tiene poco, sino quien desea más.', 'Séneca'],
  ['Haz cada acto de tu vida como si fuera el último.', 'Marco Aurelio'],
];

/** Una frase fija por fecha, recorriendo toda la lista antes de repetir. */
export function quoteFor(date) {
  const [y, m, d] = date.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return QUOTES[((dayNumber % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
