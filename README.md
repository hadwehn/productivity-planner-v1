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

## Verificación

`npm test` usa únicamente Node.js y ejecuta 13 pruebas de lógica con DOM/backend
simulados. No prueba la seguridad real de Supabase ni entrega de correos.

`tests/browser.mjs` es una prueba adicional de navegador con backend simulado.
Las instrucciones están en el archivo. No se pudo ejecutar en el entorno de
preparación por fallo de descarga del navegador. La revisión visual, el SQL
real, RLS, SMTP y el despliegue deben verificarse en el proyecto configurado.

`tests/compare-backups.mjs` compara respaldos sin imprimir su contenido privado.

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
