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

## Producto (v2)

Un diario que integra organización, hábitos y conciencia en cuatro pantallas:

| Pestaña | Para qué sirve |
|---|---|
| **Hoy** | Empieza tu día (intención y gratitud) · tareas con hasta 3 en foco ★ · agenda · hábitos con un toque · Cierra tu día (ánimo y reflexión) · notas. Las tareas sin terminar de días anteriores aparecen para traerlas o soltarlas. |
| **Semana** | Intención, foco de la semana (5) y otras tareas (5), cada una con días L–D para llevarla a un día con un toque; vista de la semana día a día; revisión semanal. Incluye **Mes**: calendario con eventos, foco y lo mejor del mes. |
| **Hábitos** | La semana de cada hábito a la vista (se pueden marcar días ya vividos), frecuencia por días o «N veces por semana», racha amable y constancia de 4 semanas. Historial mensual al tocar un hábito. |
| **Diario** | Un recuerdo de días anteriores, el ánimo del mes y todo lo escrito, día por día. |

La versión anterior al rediseño está en `backup/version-original/` (ver su README) y en la etiqueta git `version-original`.

## Estructura

```
public/
  index.html      marcado: acceso, hoja de ajustes y contenedores
  styles.css      sistema visual (tokens claro/oscuro, componentes)
  app.js          entrada: sesión, sincronización con Supabase, respaldo e importación
  client.js       cliente de Supabase  ·  store.js  guardado en la nube (CAS)
  js/
    state.js      forma de los datos, validación y acceso por rutas
    migrate.js    actualiza datos de versiones anteriores (idempotente)
    tasks.js      tareas del día y de la semana: foco, mover, pendientes, vínculos
    habits.js     frecuencia, rachas y constancia de hábitos
    prefs.js      visibilidad heredada de v1 (solo para migrar) y preguntas de revisión
    quotes.js · categories.js · icons.js
    ui.js         estado de interfaz, avisos y tema · render.js  dibujo de la vista
    interactions.js  toques, escritura, Enter entre campos y arrastrar
    sheets.js     hojas: opciones de tarea, pendientes, hábito, evento, bienvenida
    views/        today, week (y mes), habits, journal, notes
backup/version-original/   copia íntegra de la versión anterior
```

### Compatibilidad de datos

v2 usa la misma fila de Supabase y el mismo formato que v1; solo agrega campos
(`d.mood`, `h.perWeek`, `fila.drop`, `cfg.today`) que v1 ignora y conserva. Las
tareas siguen en `d.k` (0/501/502 = foco; 1…500 = resto) y la semana en índices 0–4.
No hay cambios en el esquema SQL.

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
