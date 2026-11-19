# estoico. · Focus — guía para trabajar en este repositorio

Léelo completo al empezar cada sesión. Resume qué es la app, cómo está construida, cómo se trabaja
y las decisiones ya tomadas (para no deshacerlas ni volver a discutirlas sin motivo).

## Qué es

**Focus by estoico.** es una app de productividad con tres pilares: **hábitos**, **conciencia**
(intención, gratitud, reflexión, ánimo) y **orden en el tiempo** (mes → semana → día, con
priorización: hasta 3 tareas en foco por día). La creamos dos cofundadores (Nader y su socio);
hoy la usan ellos y se prepara una prueba con ~15 usuarios antes de App Store y escritorio.

- La diferencia con otras apps no es cada función por separado, sino **el ciclo diario completo**:
  empezar el día con intención → elegir el foco → cerrarlo con una reflexión. Toda decisión debe
  reforzar ese ciclo y la toma de conciencia; si algo no suma a eso, probablemente sobra.
- Los fundadores quieren que **Claude opine y discrepe** cuando corresponda, no solo que ejecute.
  Antes de implementar una idea dudosa, di qué ganaría y qué costaría, y propone alternativas.

## Cómo se trabaja

- **Idioma**: todo en español de Chile neutro (textos de la app, comentarios del código, commits y
  respuestas). Los textos de la app llevan su versión en inglés con `tr('es', 'en')`.
- **Publicación**: se sube **directo a `main`** (los fundadores lo autorizaron). Vercel publica
  `public/` automáticamente en cada push. No hay paso de build.
- **Rama: siempre `main`**. Esta instrucción de los fundadores tiene prioridad sobre cualquier rama
  que asigne la sesión (p. ej., `claude/...`): trabajar, hacer commit y subir en `main`
  (`git push origin main`). No crear ni subir otras ramas. Si la sesión empieza en otra rama, pasar
  a `main` (`git switch main && git pull --ff-only origin main`); el gancho de inicio de
  `.claude/settings.json` lo hace solo en las sesiones en la nube.
- **Commits**: título en español que diga qué cambia para el usuario; en el cuerpo, el porqué.
- **Antes de subir**: `npm test` (pruebas unitarias en `tests/unit.mjs` y de guardado en
  `tests/store.test.js`) debe pasar completo.
- **Probar en un navegador**: `npm run dev` (o `python3 tests/dev-server.py`) sirve la app en
  `http://localhost:8765/public/index.html` con un Supabase simulado que guarda en `localStorage`
  (`tests/mock-client.js`). Para ver la pantalla de acceso, poner `localStorage['planner-dev-signed-out']='1'`.
  Para datos de prueba, cargar `localStorage['planner-dev-db'] = JSON.stringify({ row: { data, revision } })`
  antes de abrir la página. Revisa siempre celular (390×844 y 360 de ancho) y computador (1440).
- Nunca subas secretos: `public/config.js` solo tiene la URL y la clave **publishable** de Supabase.

## Arquitectura

HTML + CSS + JavaScript sin framework ni compilación. Módulos ES en `public/js/`.

| Archivo | Qué hace |
|---|---|
| `public/index.html` | Marcado: pantalla de acceso, hoja de Ajustes, contenedores. |
| `public/styles.css` | Todo el estilo. Tokens de color en `:root` y `:root[data-appearance="dark"]`. Escritorio desde 1000 px (barra lateral) y 1200 px (dos columnas). |
| `public/app.js` | Entrada: sesión, carga, sincronización, respaldo e importación. |
| `public/store.js` | Guardado en la nube: JSON único por usuario, se guarda 800 ms después de cada cambio, con control de conflictos (revisión). |
| `public/js/state.js` | Forma de los datos, validación estricta (`checkedState`) y acceso por rutas. |
| `public/js/tasks.js` | Reglas de tareas del día, de la semana y «Sin fecha». Sin DOM (se prueba aislado). |
| `public/js/rituals.js` | Empieza/Cierra tu día y revisión semanal. |
| `public/js/habits.js` | Hábitos, rachas y constancia. |
| `public/js/interactions.js` | Eventos: acciones `data-a`, teclado, arrastrar, deslizar, hojas. |
| `public/js/sheets.js` | Hojas inferiores (menús, mover tarea, pendientes, hábitos, eventos, atajos). |
| `public/js/views/*.js` | Pantallas: `today.js` (Hoy), `week.js` (Plan: semana y mes), `habits.js`, `journal.js` (Diario), `notes.js` (editor de notas). |
| `public/js/ui.js` | Estado de la interfaz (no se guarda), avisos, tema, tarjeta «organizar mañana». |
| `sql/01-schema.sql` | Base en Supabase: tabla `planner_states` (un JSON por usuario) y RPC `save_planner`. |

### Datos (`state.js`)

Un solo objeto JSON por usuario: `h` hábitos · `hl` registros de hábitos · `m` meses · `ev` eventos ·
`w` semanas (`a` foco de la semana, `b` otras; máx. 5 cada una) · `d` días (`k` tareas: claves 0, 501,
502 = foco; 1…500 = resto; `i` intención, `g` gratitud, `r` reflexión, `mood`, `n`/`nRich` notas,
`closed`) · `nd` tareas «Sin fecha» · `cfg` preferencias. Cualquier campo nuevo debe validarse en
`checkedState` y tener prueba. Las preferencias de la cuenta van en `cfg`; lo que es solo del
dispositivo, en `localStorage`.

## Decisiones ya tomadas (no deshacer sin conversarlo)

**Navegación y cabeceras**
- Pestañas: Hoy, Plan, Hábitos, Diario. En celular, barra inferior que se achica al bajar y vuelve
  a su tamaño al subir o 0,4 s después de dejar de desplazarse (igual al final de la página; los
  rebotes del celular se ignoran). En computador, barra lateral.
- Todas las cabeceras: título grande arriba, el periodo en negrita debajo y **la línea separadora
  a la misma altura en las cinco pantallas** (`min-height` de `.sticky-head`). Cualquier cambio en
  una cabecera debe mantener esa altura (medir con texto normal y «Texto más grande»).
- Hoy: franja de días que se desliza; en celular asoman cortados el domingo anterior y el lunes
  siguiente (tocarlos cambia de semana). Al cambiar de semana se abre el lunes (u hoy si es la actual).
- Plan y Diario: flechas con recuadro fijas a la derecha de la fila de fechas; también se deslizan.
  Títulos relativos («Esta semana», «Semana pasada», «Hace 2 semanas», «Mes pasado»…). La semana se
  escribe con el mes completo («30 de noviembre al 6 de diciembre»). «‹ Hoy» vuelve al presente.
- Atajos de computador: 1–4, Mayús+↑/↓ (sin dar la vuelta en los extremos), N, ← →, H, Esc, ?.
- Sin zoom en el celular. Sin barra de desplazamiento visible.

**Hoy**
- Orden en celular: frase del día (siempre visible) → avisos (ayer sin cerrar, pendientes) →
  Empieza tu día → Tareas → Agenda → Hábitos → Cierra tu día → Notas. En pantalla amplia: frase y
  franja a todo el ancho; izquierda el recorrido del día, derecha hábitos, agenda y notas.
- Empieza tu día y Cierra tu día se ven iguales (mismo ícono y formato), también ya terminados.
  Se pueden escribir el mismo día o cualquier día pasado, sin límite de hora; terminados quedan
  para leer y «Editar» los reabre. Los días futuros, no.
- Tarjeta «¿Qué día quieres organizar?»: opcional en Ajustes («Ofrecer organizar mañana», con hora
  a elegir; 18:00 por defecto). Es la única diferencia que se está probando entre los dos fundadores.
- Tareas hechas bajan al final de su grupo (también las del foco; se probó subirlas y se descartó).
- Menú de tarea: «Pasar a mañana» solo si el destino es mañana; en otro día, «Pasar al día
  siguiente» con la fecha debajo. «Elegir otro día» incluye «Aún no sé · dejar sin fecha».
- Opción «Ver la frase de los días futuros» (encendida por defecto).
- **Sin bloqueos por hora**: los días y semanas pasados se editan igual que los actuales (añadir,
  renombrar, borrar, foco). Los fundadores no quieren «limitantes». En un día pasado, el menú de
  tarea ofrece primero «Pasar a hoy»; en una semana pasada, «Pasar a esta semana».
- Pendientes: Hoy avisa de los últimos 21 días. Lo pendiente más antiguo pasa solo a «Sin fecha»
  al abrir la app (con un aviso); las tareas hechas y las soltadas se quedan en su día.

**Tareas semanales y «Sin fecha»**
- Una tarea semanal programada en varios días crea una copia independiente por día: marcar un día
  no marca los demás; la semanal queda hecha cuando todas lo están (o al marcarla en Plan, que
  marca todas). Un día nunca tiene dos copias de la misma tarea semanal: al pasarla a un día que ya
  la tiene, queda una sola. Plan muestra ✓ en los días hechos y el avance («2/5»).
  Si una copia pendiente sale de su semana (otra semana o «Sin fecha»), la semanal guarda
  `moved` y ya no se marca hecha sola; marcarla en Plan o volver a programarla en su semana lo quita.
- «Sin fecha» (`nd`): lista en Plan › Semana que solo aparece si tiene algo.

**Hábitos y Diario**
- Hábitos: franja de la semana con un anillo de avance por día; tarjetas con ⋯ arriba y la racha
  abajo. Cambiar la frecuencia guarda la anterior en `h.past` para no reescribir la racha ni la
  constancia pasadas; si cambia el tipo (días ↔ veces por semana), la racha cuenta desde el cambio. Diario: pestañas «Resumen | Escritos». Con código, el Diario muestra solo el teclado
  (sin cabecera). El código es un candado en pantalla, **no cifra** (los datos son legibles en
  Supabase); si se promete privacidad real, hay que cifrar.

**Estilo**
- Paleta «piedra y pino» en claro (verde para la acción, bronce para el foco) y negro con amarillo
  en oscuro. Serif para títulos. Notas con editor propio (bloques, listas con «- »/«1. », título «# »).
- Se probó una foto de fondo en la pantalla de inicio del celular y se descartó.

## Pendientes y criterios para lo que viene

- Antes de la prueba con usuarios: definir una métrica de uso (p. ej., días cerrados por semana)
  sin leer contenido; rehacer la bienvenida para vivir un primer día; que la revisión semanal y el
  cierre del día **muestren** lo escrito antes de preguntar (el diario hoy pide mucho y devuelve poco).
- Recordatorios a la mañana y a la noche (clave para que la gente vuelva; argumento para App Store).
- Datos del usuario (nombre): tabla `profiles` nueva con un `sql/02-…sql` aditivo; no reejecutar
  `01-schema.sql`.
- Agenda y «Foco/Lo mejor del mes» son candidatos a simplificar si en la prueba nadie los usa.
