# Registro de validación

## 2026-11-10 · Reorganización y correcciones de tareas

- 23/23 pruebas de `tests/unit.mjs` aprobadas en el navegador (tests/run.html).
- Prueba manual con backend simulado (tests/dev-server.py), en móvil (375 px) y escritorio:
  migración de datos antiguos (prioridad oculta recuperada, gratitud unificada, tareas como objeto),
  borrar secundarias vacías, Enter/Mayús+Enter, pasar prioridad a mañana, llevar tarea semanal
  al día y romper el vínculo al renombrar, modo oscuro con Papelería, diálogos y notas. Sin errores de consola.
- No se ejecutó Node en este equipo; store.test.js no cambió.

## 2026-10-28

Fecha: 2026-10-28.

- 13/13 pruebas Node aprobadas (app.test.js y store.test.js).
- Todos los módulos públicos pasan node --check.
- Comparador de respaldos ejecutado con un respaldo mínimo idéntico: aprobado.
- Enlaces internos del manual HTML comprobados; sin referencias rotas.
- Punto de entrada único y ausencia de lecturas/escrituras agenda1 en app.js comprobados.
- No se ejecutó PostgreSQL ni Supabase real; SQL/RLS requieren verificación en proyecto de prueba.
- No se ejecutó prueba Playwright: la descarga de Chromium devolvió un archivo inválido.
- No se probaron UI visual, responsive real, SDK por CDN, CSP publicada, SMTP ni despliegue Vercel.
- No se usaron cuentas, claves ni datos privados de usuarios para verificar.

Las pruebas con backend/DOM simulados no certifican seguridad de infraestructura.
