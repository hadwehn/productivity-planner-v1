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
| `public/js/tasks.js` | Reglas de tareas del día y de la semana. Sin DOM (se prueba aislado). |
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
`closed`) · `w.started`/`w.closed` intención y revisión de la semana terminadas · `nd` antigua lista «Algún día», retirada (se acepta y se pasa a hoy al abrir) · `cfg` preferencias. Cualquier campo nuevo debe validarse en
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
  escribe con el mes completo («30 de noviembre al 6 de diciembre»).
- Volver al presente: un solo botón chico con texto corto («Hoy», «Esta semana», «Este mes») y una
  flecha curva de regreso (reflejada si el presente queda adelante); el nombre completo («Volver a
  esta semana») va como etiqueta accesible. Igual en Hoy, Plan y Diario, y solo cuando se mira otro
  periodo. Relleno con el color de acción (verde en claro, amarillo en oscuro) para que se note.
  En celular flota arriba a la derecha, justo bajo la línea de la cabecera fija (en la cabecera no
  cabía el texto; se probó abajo, sobre la barra de pestañas, y los fundadores lo prefirieron
  arriba, cerca de la fecha). Se esconde con una hoja abierta. En computador va en la cabecera, a
  la izquierda de Ajustes. Ya no hay «‹ Hoy» en las cabeceras. El botón va dentro de la cabecera
  fija y cuelga bajo su línea, así se mueven siempre juntos (también en el rebote del iPhone).
- Atajos de computador: Mayús+↑/↓ (sin dar la vuelta en los extremos), N, ← →, H, Esc, ?. Se quitó 1–4.
- Cada sección recuerda dónde quedaste: al volver antes de 7 minutos y si muestra lo mismo (mismo
  día, semana, mes o pestaña), vuelve a ese punto; si no, arriba (`rememberScroll` en `render.js`).
  Tocar la sección activa sube al inicio; en Hoy, si ya estás arriba, vuelve al día de hoy.
- Sin zoom en el celular. Sin barra de desplazamiento visible.

**Hoy**
- Orden en celular: frase del día (siempre visible) → avisos (ayer sin cerrar, pendientes, cerrar
  la semana, lo mejor del mes) →
  Empieza tu día → Tareas → Agenda → Hábitos → Cierra tu día → Notas. En pantalla amplia: frase y
  franja a todo el ancho; izquierda el recorrido del día, derecha hábitos, agenda y notas.
- Empieza tu día y Cierra tu día se ven iguales (mismo ícono y formato), también ya terminados.
  Se pueden escribir el mismo día o cualquier día pasado, sin límite de hora; terminados quedan
  para leer y «Editar» los reabre. Los días futuros, no.
- Plan › Semana: «Intención de la semana» y «Revisión semanal» funcionan como «Empieza/Cierra tu
  día»: plegables con el mismo ícono y formato, botón «Listo, empezar la semana» / «Cerrar la
  semana», quedan para leer y «Editar» las reabre (`w.started` y `w.closed`). La revisión se puede
  cerrar cualquier día de su semana o después (antes solo desde el domingo); la intención, también
  de antemano para la semana siguiente.
- Revisión semanal: **tres** preguntas («¿Qué salió bien esta semana?», «¿Qué te quitó energía o
  foco?», «¿Qué cambias para la próxima semana?»); con una respuesta ya se puede
  cerrar. Las semanas con la 4.ª pregunta antigua escrita se muestran con las cuatro originales.
  Antes de preguntar **muestra la semana**: foco cumplido, días cerrados, % de hábitos y el foco
  con ✓. Se hizo porque los fundadores nunca la llenaban: pedía mucho y no devolvía nada. No se pregunta
  por lo pendiente: eso ya lo resuelven Pendientes y «Pasar a esta semana».
- Recordatorios en Hoy (avisos, no notificaciones): cerrar la semana el domingo desde las 18:00
  hasta el lunes a mediodía (si no está cerrada) y «¿Qué fue lo mejor de noviembre?» el último día
  del mes desde las 18:00 hasta el día 2 (si está vacío). Llevan a Plan con la revisión abierta o
  al campo de «Lo mejor del mes» (`reviewReminder`/`monthReminder` en `rituals.js`).
- Rituales en primer plano (Empieza/Cierra tu día, Intención/Revisión de la semana): al abrirlos
  (o «Editar») la página los sube hasta quedar justo bajo la cabecera, el resto se atenúa y los
  otros rituales se pliegan; si están al final, se agrega espacio abajo para que suban. La
  apertura automática de la mañana o la noche no atenúa nada (`focusRitual`).
- Notas en modo enfoque: la tarjeta de Hoy muestra el comienzo de lo escrito y abre una hoja casi a
  pantalla completa (en computador, ventana centrada) con la barra de formato arriba y todo el
  espacio para escribir; con el teclado del celular abierto la hoja **no se mueve**: el teclado
  queda encima de su parte de abajo (como la app Notas) y la línea en que se escribe se mantiene a
  la vista; se probó achicarla y subirla sobre el teclado y no gustó (`notesSheet` en `sheets.js`). Vacía, se abre lista para escribir; con texto, para leer primero.
- Tarjeta «¿Qué día quieres organizar?»: opcional en Ajustes («Ofrecer organizar mañana», con hora
  a elegir; 18:00 por defecto). Es la única diferencia que se está probando entre los dos fundadores.
- Tareas hechas bajan al final de su grupo (también las del foco; se probó subirlas y se descartó).
- Menú de tarea: «Pasar a mañana» solo si el destino es mañana; en otro día, «Pasar al día
  siguiente» con la fecha debajo. «Elegir cuándo» abre la hoja «¿Cuándo?»: días y «Esta semana ·
  sin día».
- Opción «Frase en días futuros» (encendida por defecto).
- **Sin bloqueos por hora**: los días y semanas pasados se editan igual que los actuales (añadir,
  renombrar, borrar, foco). Los fundadores no quieren «limitantes». En un día pasado, el menú de
  tarea ofrece primero «Pasar a hoy»; en una semana pasada, «Pasar a esta semana».
- Pendientes: Hoy avisa de los últimos 21 días; la hoja ofrece Traer · A la semana · Soltar. Lo
  pendiente más antiguo se suelta solo al abrir la app (con un aviso) y queda en su día.

**Horizontes: un día o esta semana**
- Todo responde a «¿cuándo?»: un día o la semana (sin día). «Objetivo» no es un lugar: es una forma
  de tarea dentro de la semana. Una tarea del día pasa a su semana (o a la actual si ya pasó; las
  del foco van al foco de la semana si cabe). Si era la copia de una tarea de esa misma semana,
  solo se quita del día y la semanal queda pendiente (`moved`).
- Se probó una lista «Sin fecha» / «Algún día» y se retiró: confundía (tres lugares parecidos) y
  se volvía un cajón de olvido. Lo que no es de esta semana, se suelta o se anota cuando toque.

**Tareas semanales**
- Una tarea semanal programada en varios días crea una copia independiente por día: marcar un día
  no marca los demás; la semanal queda hecha cuando todas lo están (o al marcarla en Plan, que
  marca todas). Un día nunca tiene dos copias de la misma tarea semanal: al pasarla a un día que ya
  la tiene, queda una sola. Plan muestra ✓ en los días hechos y el avance («2/5»).
  Si una copia pendiente sale de su semana (a un día de otra semana), la semanal guarda
  `moved` y ya no se marca hecha sola; marcarla en Plan o volver a programarla en su semana lo quita.
- Objetivo (sin días): opción del menú ⋯ de una tarea semanal («Convertir en objetivo» / «Repartir
  en días», debajo de la opción de foco). Guarda `goal`, oculta las letras de los días y muestra
  la marca «Objetivo» como etiqueta verde en mayúsculas con bandera (estilo «EN FOCO», sin fondo para que no parezca botón); se marca a
  mano. Al convertirla se quitan sus copias pendientes de los días (las hechas quedan, sueltas) y
  se puede deshacer. Sigue siendo objetivo al pasar a otra semana. Idea para después: mostrar los
  objetivos en «Empieza tu día» o en la revisión semanal para que no se olviden.

**Eventos**
- El formulario de evento tiene un campo «Día» que viene con el día que se tocó y se puede cambiar
  al crear o al editar (pasar un evento a otro día sin borrarlo). Si tiene «Hasta», se corre igual
  y conserva la duración (`putEvent`/`shiftEnd` en `events.js`). En Mes queda elegido el día nuevo.
  Se descartó arrastrar eventos en el calendario del celular (celdas chicas, choca con deslizar).
- Calendario del mes: los días con eventos llevan puntos de 6 px (uno por evento, hasta 3, del color
  de su área) y el número en negrita. Se probó teñir el día, franjas para eventos de varios días y
  una vista «Ampliar» con los nombres en cada día, y los fundadores lo descartaron: vuelven los puntos.

**Hábitos y Diario**
- Hábitos: franja de la semana con un anillo de avance por día; tarjetas con ⋯ arriba y la racha
  abajo. Cambiar la frecuencia guarda la anterior en `h.past` para no reescribir la racha ni la
  constancia pasadas; si cambia el tipo (días ↔ veces por semana), la racha cuenta desde el cambio. Diario: pestañas «Resumen | Escritos». Con código, el Diario muestra solo el teclado
  (sin cabecera). El código es un candado en pantalla, **no cifra** (los datos son legibles en
  Supabase); si se promete privacidad real, hay que cifrar.

**Estilo**
- Apariencia (Automática / Clara / Oscura): es **de cada dispositivo** (`localStorage`), no de la
  cuenta; por defecto «Automática», que sigue el modo claro u oscuro del celular o computador.
- Paleta «piedra y pino» en claro (verde para la acción, bronce para el foco) y negro con amarillo
  en oscuro. Serif para títulos. Notas con editor propio (bloques, listas con «- »/«1. », título «# »).
- Se probó una foto de fondo en la pantalla de inicio del celular y se descartó.
- Se probó tapar la app con «Pon el celular en vertical» al girar el celular y se descartó: la app gira.

## Pendientes y criterios para lo que viene

- Antes de la prueba con usuarios: definir una métrica de uso (p. ej., días cerrados por semana)
  sin leer contenido; rehacer la bienvenida para vivir un primer día; que la revisión semanal y el
  cierre del día **muestren** lo escrito antes de preguntar (hecho en la revisión semanal; falta el
  cierre del día).
- Recordatorios a la mañana y a la noche (clave para que la gente vuelva; argumento para App Store).
- Datos del usuario (nombre): tabla `profiles` nueva con un `sql/02-…sql` aditivo; no reejecutar
  `01-schema.sql`.
- Agenda y «Foco/Lo mejor del mes» son candidatos a simplificar si en la prueba nadie los usa.
