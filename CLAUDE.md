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
| `public/store.js` | Guardado en la nube: JSON único por usuario, se guarda 800 ms después de cada cambio, con control de conflictos (revisión). Sin conexión no es error: queda pendiente y se reintenta (`isOffline`). |
| `public/sw.js` | Service worker: guarda los archivos de la app (y Supabase del CDN) para abrir sin conexión. Primero la red; la copia si no hay red o tarda más de 3 s. Nunca guarda datos ni llamadas a la nube. |
| `public/js/state.js` | Forma de los datos, validación estricta (`checkedState`) y acceso por rutas. |
| `public/js/tasks.js` | Reglas de tareas del día y de la semana. Sin DOM (se prueba aislado). |
| `public/js/rituals.js` | Empieza/Cierra tu día y revisión semanal. |
| `public/js/habits.js` | Hábitos, rachas y constancia. |
| `public/js/interactions.js` | Eventos: acciones `data-a`, teclado, arrastrar, deslizar, hojas. |
| `public/js/sheets.js` | Hojas inferiores (menús, mover tarea, pendientes, hábitos, eventos, atajos). |
| `public/js/views/*.js` | Pantallas: `today.js` (Hoy), `week.js` (Plan: semana y mes), `habits.js`, `journal.js` (Diario), `notes.js` (editor de notas). |
| `public/js/ui.js` | Estado de la interfaz (no se guarda), avisos, tema. |
| `public/js/back.js` | Volver deslizando desde el borde izquierdo (camino de vuelta y gesto). |
| `sql/01-schema.sql` | Base en Supabase: tabla `planner_states` (un JSON por usuario) y RPC `save_planner`. |

### Datos (`state.js`)

Un solo objeto JSON por usuario: `h` hábitos · `hl` registros de hábitos · `m` meses · `ev` eventos ·
`w` semanas (`a` foco de la semana, máx. 5; `b` «También esta semana», sin límite práctico: 100) · `d` días (`k` tareas: claves 0, 501,
502 = foco; 1…500 = resto; `i` intención, `g` gratitud, `r` reflexión, `mood`, `n`/`nRich` notas,
`closed`) · `w.started`/`w.closed` intención y revisión de la semana terminadas · `nd` antigua lista «Algún día», retirada (se acepta y se pasa a hoy al abrir) · `cfg` preferencias. Cualquier campo nuevo debe validarse en
`checkedState` y tener prueba. Las preferencias de la cuenta van en `cfg`; lo que es solo del
dispositivo, en `localStorage`.

**Sin conexión** (`app.js`): el diario también se guarda en el dispositivo (`localStorage`,
`focus-local:<id>`: estado, revisión, operación pendiente y si hay cambios sin subir; y
`focus-last-user`). Al abrir se muestra al instante desde esa copia y después se pone al día: si
aquí hay cambios sin subir, se suben (si también cambió la nube, aparece el aviso de conflicto de
siempre, sin mezclar); si no, se toma la versión de la nube. Sin conexión se usa con normalidad
(«Sin conexión · se guardará al volver», punto bronce en Ajustes) y lo pendiente se sube solo al
volver la conexión. Si recuperar la sesión tarda más de 3 s o no hay red, se abre con la última
cuenta de este dispositivo. Un dispositivo nuevo necesita conectarse una vez. Cerrar sesión borra
la copia; «Cargar la versión de la nube» (en un conflicto) también. La copia no está cifrada
(como la sesión de Supabase en el mismo dispositivo).

## Decisiones ya tomadas (no deshacer sin conversarlo)

**Navegación y cabeceras**
- Pestañas: Hoy, Plan, Hábitos, Diario. En celular, barra inferior flotante **siempre del mismo
  tamaño**, con íconos y nombres, pegada abajo (sobre la raya de inicio del iPhone: unos 22 px del
  borde) para dejar más pantalla a la vista. Se probó achicarla al bajar (solo íconos, volvía a los 0,4 s) y
  se descartó: ganaba 25 px y generaba movimiento constante y casos raros. En computador, barra lateral.
- Punto de aviso en la barra de secciones (como WhatsApp): un punto verde/amarillo en Hoy de 5:00 a
  12:00 si «Empieza tu día» no está terminado (no aparece si la intención y la gratitud están
  apagadas en Ajustes; la misma ventana en que se abre solo) y desde las 19:00 si el día sigue sin
  cerrar (entre medio, nada, para que nunca signifique dos cosas a la vez); en Plan, cuando toca
  cerrar la semana (`reviewReminder`). No se quita hasta que se completa, aunque estés en esa
  sección (6 px, separado del ícono); se actualiza cada minuto (`navDots` en `render.js`,
  `dueRituals` en `ui.js`). La tarjeta que hay que llenar («Empieza tu día», «Cierra tu día» o
  «Revisión semanal») lleva el mismo punto sobre su ícono y se quita junto con el de la barra: al
  terminarla, no al empezar a escribir (si no, la barra seguiría con punto sin saber por qué). Es
  para guiar, no para presionar: sin rojo, sin números y sin insistir más con las horas.
- Deslizar una tarea a la izquierda (solo con el dedo) muestra sus acciones rápidas: «Mañana» (u
  «Hoy» si es de un día pasado, o el día siguiente con su fecha) y «Eliminar»; en Plan, «Próxima» (o
  «Esta semana») y «Eliminar». Una tarea hecha solo muestra «Eliminar». Pasada la mitad queda
  abierta; tocar fuera la cierra. Usa las mismas acciones del menú ⋯ (`swipeRows`).
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
- En el celular la cabecera va **fija a la pantalla** (`position: fixed`), con un espacio de su alto
  bajo ella (`--head-h`, `fitHead` en `render.js`): en el rebote del iPhone al tirar hacia abajo
  desde arriba, la cabecera queda quieta y se estira el espacio entre ella y el contenido, como en
  Instagram, WhatsApp y Spotify (antes rebotaba toda la página y el vacío quedaba sobre la cabecera).
  En computador sigue «pegada» (`sticky`). Es translúcida: el contenido se ve desenfocado al pasar
  por debajo, como en la barra de secciones (`backdrop-filter`, fondo al 68 %: con 86 % no se notaba).
- Volver deslizando desde el borde izquierdo (como en el iPhone, `back.js`): al entrar a algo desde
  otra pantalla (un día desde Plan, Hábitos o el Diario; «Ver todo»; los avisos que llevan a Plan;
  «Cerrarlo» de ayer) se anota dónde estabas, y arrastrar desde el borde te devuelve ahí, en el mismo
  punto de la página. La pantalla sigue al dedo; pasado el 40 % (o con un movimiento rápido) vuelve.
  Tocar la barra de secciones borra el camino de vuelta. Solo con el dedo.
- Celebraciones sutiles (`celebrate.js`): al completar el foco del día (en bronce, sobre la tarea
  que lo completó), marcar el último hábito que tocaba ese día, cerrar el día y cerrar la semana:
  un anillo que se cierra alrededor del ✓ de lo que se tocó y unos destellos breves (≈1 s). Sin sonido
  ni confeti; el aviso de texto de siempre se mantiene. La hoja de pendientes al cerrar el día
  espera a que termine. Se omite con «reducir movimiento» del sistema.
- Respuesta al tocar: filas y tarjetas que se tocan (cabeceras de rituales, días, resultados del
  Diario, menús, avisos, hábitos de Hoy) se oscurecen apenas al presionarlas.
- Atajos de computador: Mayús+↑/↓ (sin dar la vuelta en los extremos), N, ← →, H, Esc, ?. Se quitó 1–4.
- Cada sección y cada periodo (cada día en Hoy, cada semana o mes en Plan, cada mes en Diario)
  recuerdan dónde quedaste por 7 minutos: al volver a una sección, o a un día/semana/mes que viste
  hace poco (p. ej., ir a mañana y volver a hoy), apareces en ese punto. Un periodo que no habías
  abierto, o pasado ese tiempo, se ve desde el inicio; también si se abre un día desde Plan. Lo que
  no cambia el periodo (marcar una tarea, elegir un día del calendario del mes) deja la página
  donde está. Tocar la sección activa sube al inicio; en Hoy, si estás en otro día, vuelve a hoy
  (`rememberScroll`/`savedScroll` y `render` en `render.js`).
- Sin zoom en el celular. Sin barra de desplazamiento visible.

**Hoy**
- Orden en celular: frase del día (siempre visible) → avisos (ayer sin cerrar, pendientes, cerrar
  la semana, lo mejor del mes) →
  Empieza tu día → Tareas → Agenda → Hábitos → Cierra tu día → Notas. En pantalla amplia: frase y
  franja a todo el ancho; izquierda el recorrido del día, derecha hábitos, agenda y notas.
- Empieza tu día y Cierra tu día se ven iguales (mismo ícono y formato), también ya terminados.
  Se pueden escribir el mismo día o cualquier día pasado, sin límite de hora; terminados quedan
  para leer. Los días futuros, no. «Editar» (también en la intención y la revisión de la semana) es
  solo un modo de la pantalla (`U.editing`): lo terminado **sigue terminado**, se corrige y
  «Guardar» lo vuelve a dejar para leer. Lo escrito, para leer, va como texto sin el recuadro de fondo de los
  campos (`.ritual-read`): con recuadro parecía editable. El recuadro aparece solo con «Editar».
  «Editar» es un botón chico y discreto (borde fino, gris, sin subrayado) en la esquina derecha de la
  línea «✓ Cerraste el día…», que se alinea a la izquierda: se usa poco y no debe invitar a corregir.
  Igual en Hoy, la semana y el mes.
  Ese texto va justificado (bordes parejos), con guiones automáticos para que en el celular no
  queden espacios muy grandes entre palabras. Antes «Editar» reabría de verdad y, si uno salía sin
  volver a cerrar, el día quedaba abierto y pedía «Cerrar el día» otra vez.
- Al cerrar el día, la hoja «¿Pasas las pendientes a mañana?» (`carryOverSheet`) aparece solo al
  cerrar **hoy o ayer** (ayer: «Pasar a hoy»). Un día más antiguo se cierra sin preguntar: lo
  pendiente ya lo resuelve el aviso de Pendientes, y al corregir un día viejo desde el buscador
  volver a decidir sobre sus tareas molestaba. Se probó mostrar un día pasado escrito y sin cerrar
  solo para leer (sin «Cerrar el día») y se descartó: debe poder cerrarse.
- Al pasar a otro día (u otra semana en Plan), las tarjetas que estaban abiertas se pliegan y se
  sale del modo «Editar»: el periodo nuevo se ve como siempre (`U.foldsFor` en `render`).
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
- Notas en modo enfoque: la tarjeta de Hoy muestra el comienzo de lo escrito y abre una ventana
  flotante con bordes redondeados que no ocupa toda la pantalla (en el celular, arriba y con margen
  a los lados; en computador, centrada), con la barra de formato arriba y el espacio para escribir.
  Arriba a la derecha, el basurero y «Guardar» (✓, en verde), que reemplazó a la ✕ (confundía:
  ¿descarta?) y al «Guardar» de abajo; no «Listo»: sonaba a terminado. Sin texto de instrucciones. Con el teclado del celular abierto, la
  ventana **no se mueve**: el teclado queda encima de su parte de abajo y la línea en que se escribe
  se mantiene a la vista. La ventana sigue a la pantalla visible (`--vv-top`): aunque el iPhone
  desplace la vista al escribir, el título y la barra de formato quedan siempre arriba. Se probó
  una ventana más baja, del alto justo para quedar sobre el teclado (quieta), y los fundadores
  prefirieron esta, más alta. Se probó una hoja a pantalla completa y achicarla sobre el teclado, y no
  gustaron (`notesSheet` en `sheets.js`). Vacía, se abre lista para escribir; con texto, para leer.
  Basurero junto a «Guardar» (solo con algo escrito) para empezarla de cero: borra al instante con
  «Nota borrada · Deshacer», sin confirmación (las confirmaciones se aceptan por reflejo).
- Se quitó la tarjeta «¿Qué día quieres organizar? Hoy | Mañana» y su ajuste («Ofrecer organizar
  mañana», con hora): repetía lo que ya hacen la franja de días (mañana está al lado) y el botón
  «Hoy». Los datos antiguos (`cfg.today.tomorrow`, `cfg.planHour`) se siguen aceptando.
- Tareas hechas bajan al final de su grupo (también las del foco; se probó subirlas y se descartó),
  pero **no al instante** (igual que los hábitos): al marcarla queda donde estaba mientras se mira
  Hoy, y se reordena al volver desde otra sección, al cambiar de día, al volver a la app o si cambia
  qué tareas hay (añadir, borrar, mover, estrella) (`U.taskSort`, `tasksSection`). En Plan › Semana,
  igual: las hechas se juntan al final de su lista al volver a la sección o cambiar de semana
  (`U.weekSort`, `settledWeek`); antes no se movían nunca.
- Menú de tarea: «Pasar a mañana» solo si el destino es mañana; en otro día, «Pasar al día
  siguiente» con la fecha debajo. «Pasar a otro día» (antes «Elegir cuándo», muy abstracto) abre la hoja «¿Cuándo?»: días, «Esta semana (sin día)» y
  «Próxima semana (sin día)» (siempre relativas a hoy). Al final, plegado, el enlace «Otra fecha…» (campo
  de fecha + «Mover»): se usa poco (posponer más de dos semanas es raro) y antes ocupaba mucho. Sin «Poner en foco»: para eso está la
  estrella.
- Foco vacío: «Marca con ★ hasta tres tareas prioritarias: las que más importa sacar adelante hoy»
  (antes «…que harían de este un buen día»: el foco es prioridad, no bienestar).
- Tarea hecha: queda como registro. No se renombra (para corregirla, se desmarca) ni cambia de
  foco: si era del foco conserva la estrella, quieta; si no, no tiene estrella. El menú ⋯ ofrece
  «Repetir mañana» (u «Hoy» si es de un día pasado, o el día siguiente con su fecha) y «Eliminar».
  Repetir crea una copia pendiente y suelta (sin vínculo a la semana); si era del foco entra al foco
  de ese día, y si ya tiene tres, al resto con aviso (`repeatTask`). Se había descartado y los
  fundadores lo pidieron de vuelta. En Plan, igual: una tarea semanal hecha no
  se renombra ni se lleva a días (las letras quedan solo para ver cuándo se hizo) y su menú ofrece
  solo «Eliminar».
- Fecha de Hoy sin coma: «Martes 24 de noviembre». Notas de hoy se titulan «Notas de hoy»; las de
  otro día, «Notas · Martes 24».
- Frase del día alineada a la izquierda, con «— Autor» debajo y las comillas decorativas arriba a la
  derecha (en computador, frase y autor en una línea, también con las comillas). Se probó centrada y sin guion, y se descartó.
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
- Límites: la semana es espejo del día. El foco prioriza y tiene tope (día 3, semana 5); el resto no
  (día y «También esta semana» sin límite práctico). Se discutió quitar el tope del foco semanal
  («3 por día × 7 = 21») y se descartó: el foco de la semana es un nivel más arriba que el del día
  y sin tope deja de ser foco. Con el foco lleno, su campo se cambia por «Foco completo. Lo demás
  va en «También esta semana»», y lo que llegue igual va a «También» con un aviso (`WEEK_MAX`).
- Una tarea semanal programada en varios días crea una copia independiente por día: marcar un día
  no marca los demás; la semanal queda hecha cuando todas lo están (o al marcarla en Plan, que
  marca todas). Un día nunca tiene dos copias de la misma tarea semanal: al pasarla a un día que ya
  la tiene, queda una sola. Plan muestra ✓ en los días hechos y el avance («2/5»).
  Si una copia pendiente sale de su semana (a un día de otra semana), la semanal guarda
  `moved` y ya no se marca hecha sola; marcarla en Plan o volver a programarla en su semana lo quita.
- Renombrar: el nombre es uno solo. Cambiarlo en un día lo cambia en Plan y en los demás días donde
  está; cambiarlo en Plan, en todos sus días. El vínculo no se corta (antes sí, y la semana dejaba de
  contar ese día). Mientras el campo queda vacío no se propaga (`renameLinked`).
- Eliminar: una copia borrada en el día no toca la semana; borrar la tarea en Plan la quita también
  de los días donde está pendiente (las hechas quedan como registro, sueltas), con aviso «… y de N
  días» y deshacer (`deleteWeekTask`). Misma regla que «Convertir en objetivo» y «Pasar a la próxima».
- Ayudas en Plan › Semana: «Toca las letras bajo cada tarea para llevarla a un día.» va bajo la
  primera lista con tareas que tengan letras; bajo «Tu semana día a día» solo «Toca un día para abrirlo.».
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
- Plan › Mes: el calendario queda a 20 px de la cabecera fija (igual que la frase del día en Hoy).
  «Foco del mes» y «Lo mejor del mes» muestran sus tres campos de una vez, con el mismo estilo que
  los campos de la intención y la revisión de la semana (fondo hundido, bordes redondeados, letra normal).
  Vacíos, muestran solo una línea y «Completar», que abre los tres campos. Como ellas, se cierran
  con «Listo» (pide algo escrito) y quedan para leer con «✓ Definiste el foco del mes · Editar»;
  «Editar» los abre con «Guardar» (`m[mes].closed = { p, h }`, `finishMonth`). «Listo»/«Guardar» es el
  mismo botón ancho de Empieza/Cierra tu día y de la semana (se probó uno chico y no era uniforme).
  Abiertos con «Completar» o «Editar», una ✕ a la izquierda sale sin guardar y deja todo como estaba
  (`U.monthSnap`, `monthcancel`): sin ella, quien abría solo para mirar no podía salir.
- Calendario del mes: arriba, dentro de la tarjeta, el mes en mayúsculas grande y centrado («NOVIEMBRE
  2026»); se desliza con el mes. Los días con eventos llevan puntos de 6 px (uno por evento, hasta 3, del color
  de su área); el número va normal (se probó en negrita y se descartó: bastan los puntos). Se probó teñir el día, franjas para eventos de varios días y
  una vista «Ampliar» con los nombres en cada día, y los fundadores lo descartaron: vuelven los puntos.

**Hábitos y Diario**
- Diario › Escritos: buscador arriba («Buscar en tu diario»). Desde 2 letras busca en todo lo escrito
  (intención, gratitud, reflexión y notas), en cualquier mes, sin importar tildes ni mayúsculas;
  resalta lo encontrado y muestra la fecha completa. La búsqueda no se guarda (`journalEntries`).
  Cada resultado muestra solo los campos donde está lo buscado, con el fragmento que lo contiene
  («…decidí **soltar** el control…», `snippet`), para que la palabra siempre se vea aunque esté al
  final de una nota larga. Hasta 60 resultados, con «Mostrando los 60 más recientes de N». No busca
  en lo escrito en Plan (intención/revisión de la semana, foco y lo mejor del mes): quedó pendiente.
  Tocar un resultado abre el día en la tarjeta donde está lo buscado (intención o gratitud →
  Empieza tu día; reflexión → Cierra tu día; notas → la tarjeta de Notas), a la vista y para leer.
- Ideas de hábitos: en «Nuevo hábito», bajo el nombre, «¿Sin ideas? Ver hábitos para empezar»
  despliega unas 22 ideas en cuatro grupos (Cuerpo, Mente, Descanso y pantallas, Orden y personas;
  `habitIdeas.js`). Elegir una rellena nombre, frecuencia y área, que se pueden ajustar antes de
  crear. No se muestran las que ya son hábitos. Al crear en el celular no se abre el teclado solo,
  para que se vean las ideas.
- Vacíos del primer uso (sin hábitos, en Hábitos y en la tarjeta de Hoy; Diario sin nada escrito
  nunca): ícono suave en un círculo, título, invitación y botón (`emptyState` en `common.js`). Los
  vacíos de todos los días (Agenda, Notas, un mes sin escritos) siguen en una línea: una tarjeta
  grande que aparece a diario se vuelve ruido.
- Hábitos en Hoy: los marcados se juntan al final (como las tareas hechas; se pensó al principio y
  se prefirió dejar lo pendiente primero), pero **no al instante**: el orden queda fijo mientras se
  mira la sección, para que la ficha no se mueva bajo el dedo. Se reordena al volver a Hoy desde otra
  sección, al cambiar de día o al volver a la app (`U.habitSort`, `habitsSection`).
- Hábitos: franja de la semana con un anillo de avance por día; tarjetas con ⋯ arriba y la racha
  abajo. El orden se cambia **solo** desde «Reordenar» (bajo la cabecera, con 2+ hábitos; ícono ≡):
  una ventana centrada (como Notas, `center-sheet`) con una fila compacta por hábito (color, nombre,
  ≡). Se arrastra la fila y las demás se corren en vivo para hacerle espacio (como la app Bolsa), sin
  flechas. El orden es un borrador que queda fijo al tocar ✓ arriba a la derecha (no hay ✕); cerrar
  de otra forma no cambia nada. Las tarjetas ya no se arrastran (`habitOrderSheet`, `orderDrag`). Cambiar la frecuencia guarda la anterior en `h.past` para no reescribir la racha ni la
  constancia pasadas; si cambia el tipo (días ↔ veces por semana), la racha cuenta desde el cambio. Diario: pestañas «Resumen | Escritos». Con código, el Diario muestra solo el teclado
  (sin cabecera). El código es un candado en pantalla, **no cifra** (los datos son legibles en
  Supabase); si se promete privacidad real, hay que cifrar.

**Estilo**
- Apariencia (Automática / Clara / Oscura): es **de cada dispositivo** (`localStorage`), no de la
  cuenta; por defecto «Automática», que sigue el modo claro u oscuro del celular o computador.
- Tareas (del día y de la semana) y hábitos en MAYÚSCULAS del mismo tamaño que las etiquetas
  («TAREAS», 12 px), sin negrita y en color de tinta, para que todo se vea uniforme (decisión de los
  fundadores tras probar versalitas, mayúsculas más grandes y minúsculas). Se guardan tal como se
  escriben (`text-transform`); «Añadir tarea» se ve en texto normal.
- Paleta «piedra y pino» en claro (verde para la acción, bronce para el foco) y negro con amarillo
  en oscuro. Títulos, el periodo bajo el título y la franja de días de Hoy, nombres de tarjetas, títulos
  de hojas, cifras y los nombres de la barra de secciones en **Outfit** (la fuente de
  «FOCUS», `--display`); la serif cursiva queda para lo que se lee con calma (frase del día, lo
  escrito en rituales y Diario, «a la vez.» del acceso). Las etiquetas («TAREAS», «AGENDA»…) siguen en
  la fuente del sistema, iguales a las tareas y hábitos en mayúsculas. Se probó a pedido de los fundadores y
  **puede que se vuelva a la serif en títulos** (la versión anterior, `--serif`): para volver, cambiar
  `--display` a `var(--serif)` y revisar pesos y tamaños en `styles.css`. Notas con editor propio (bloques, listas con «- »/«1. », título «# »).
  Enter solo salta de línea. Las notas se guardan al escribir.
- Teclado sin fila de palabras sugeridas (como Spotify) en todos los campos de texto. En el iPhone
  esa fila va unida al autocorrector, que reemplaza solo la palabra: no se pueden separar desde una
  página web. Por eso se apaga `autocorrect` y queda el corrector ortográfico (`spellcheck`), que
  subraya los errores y al tocarlos ofrece cómo corregirlos. Se probó sin corrector y los fundadores
  lo pidieron de vuelta. Quedan fuera el correo y los códigos de acceso (`quietKeyboard` en `interactions.js`). La barra ˄ ˅ OK
  sobre el teclado la pone Safari y no se puede quitar en la web: quitarla al llegar a la App Store
  (en Capacitor, `Keyboard.setAccessoryBarVisible({ isVisible: false })`).
- Marca en la barra lateral del computador y en la pantalla de acceso: «FOCUS» grande (el nombre de la
  app) y debajo, más chico, «by estoico.» con el logo (antes el logo grande con «FOCUS» chico). «FOCUS»
  va en **Outfit liviana** (300), elegida por los fundadores entre unas 20 fuentes: sin serifa, contrasta
  con el logo serif. Va incluida en la app (`public/fonts/outfit-latin.woff2`, variable 300–600,
  licencia OFL) porque la política de seguridad de `vercel.json` solo permite fuentes propias.
- Se probó una foto de fondo en la pantalla de inicio del celular y se descartó.
- Se probó tapar la app con «Pon el celular en vertical» al girar el celular y se descartó: la app gira.

## Pendientes y criterios para lo que viene

- Ideas para reforzar «Focus» que los fundadores descartaron (no volver a proponerlas sin un motivo
  nuevo): elegir las 3 prioridades dentro de «Empieza tu día», mostrar «2 de 3 prioridades» al
  cerrar el día, preguntar qué sale del foco al marcar una cuarta estrella, una pantalla «Ahora»
  con una sola tarea y temporizador, y plegar las tareas que no son del foco. Sentían que
  entorpecían lo ya construido.

- Antes de la prueba con usuarios: definir una métrica de uso (p. ej., días cerrados por semana)
  sin leer contenido; rehacer la bienvenida para vivir un primer día; que la revisión semanal y el
  cierre del día **muestren** lo escrito antes de preguntar (hecho en la revisión semanal; falta el
  cierre del día).
- Recordatorios a la mañana y a la noche (clave para que la gente vuelva; argumento para App Store).
- Hecho: la app abre y se usa sin conexión (ver «Sin conexión» en Datos).
- Datos del usuario (nombre): tabla `profiles` nueva con un `sql/02-…sql` aditivo; no reejecutar
  `01-schema.sql`.
- Agenda y «Foco/Lo mejor del mes» son candidatos a simplificar si en la prueba nadie los usa.
