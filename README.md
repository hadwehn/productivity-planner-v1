# Productivity Planner — piloto con Supabase

Lee primero `Manual-Productivity-Planner.html` en la carpeta superior del paquete.

1. Respalda el HTML original desde su botón de exportar JSON.
2. Crea un proyecto Supabase nuevo y ejecuta una sola vez `sql/01-schema.sql`.
3. Configura Email OTP, plantillas con `{{ .Token }}` y SMTP propio.
4. Completa `public/config.js` con URL y clave **pública** publishable.
5. Sube estos archivos a la raíz elegida del repositorio GitHub.
6. Importa en Vercel: Other, sin build, output `public`.
7. Prueba con cuentas tuyas, incluyendo consultas directas de aislamiento.
8. Inicia sesión con la cuenta correcta e importa explícitamente el JSON antiguo.

No hay credenciales reales ni publicación realizada. El SDK se distribuye desde
jsDelivr y sigue la rama mayor @2; consulta el manual para fijar una versión
resuelta y probarla antes de estabilizar el despliegue.

## Estructura

```
public/
  index.html      marcado (sin estilos ni lógica)
  styles.css      todos los estilos, con tokens para claro/oscuro y las dos paletas
  app.js          entrada: sesión, sincronización con Supabase, respaldo e importación
  client.js       cliente de Supabase  ·  store.js  guardado en la nube (CAS)
  js/
    state.js      forma de los datos, validación y acceso por rutas
    migrate.js    actualiza datos guardados por versiones anteriores
    tasks.js      reglas de tareas: prioridades, secundarias, traslados y vínculo con la semana
    prefs.js      qué espacios se muestran (por grupo o por día) y configuraciones rápidas
    quotes.js     frases del día · categories.js  colores y nombres de categorías
    ui.js         estado de la interfaz, avisos y tema · render.js  dibujo de la vista
    interactions.js  clics, escritura, Enter entre campos y arrastrar para ordenar
    dialogs.js    hábito, evento, llevar tarea al día y bienvenida
    views/        day, week, calendar, habits, notes
```

## Verificación

- `tests/unit.mjs`: pruebas de lógica (datos, migraciones, tareas, vínculos, vistas).
  Con Node: `npm test`. Sin Node: abre `tests/run.html` con el servidor local.
- `python3 tests/dev-server.py` y abre `http://localhost:8765/public/index.html`
  para usar la app con un backend simulado (guarda en el navegador, sin Supabase).
- `tests/store.test.js` prueba el guardado en la nube con un cliente simulado.

Las pruebas no verifican la seguridad real de Supabase (RLS), el correo ni el despliegue.

## Límites del alcance

- JSONB completo por cuenta, CAS atómico; sin fusión automática de conflictos.
- Un error congela edición y permite exportar el borrador o reintentar.
- Borrador solo en memoria: cerrar sin guardar puede perder cambios.
- Sin edición offline duradera ni cifrado de extremo a extremo.
- Admin de aplicación ve solo dos métricas agregadas. Propietario técnico y
  credenciales privilegiadas sí tienen acceso de infraestructura.
- No hay límite de 15 altas implementado; es el supuesto de dimensionamiento.
- Free es condicional a cuotas y uso; correo de Supabase predeterminado no
  sirve para 15 personas externas. SMTP y dominio del remitente pueden requerir
  configuración y costes independientes.
