# Respaldo · versión original (antes del rediseño v2)

Esta carpeta es una copia íntegra de la aplicación **tal como estaba antes del rediseño
integral v2** (commit `964cf01` de `main`, 10 de noviembre de 2026). No la modifiques.

## Qué contiene

| Ruta | Contenido |
|---|---|
| `public/` | La app completa: `index.html`, `styles.css`, `app.js` (entrada), `client.js` y `config.js` (Supabase), `store.js` (guardado en la nube), `boot.js`, `manifest.json`, `icons/` y los módulos de `js/` |
| `sql/01-schema.sql` | Esquema de Supabase (tabla `planner_states`, RLS y función `save_planner`) |
| `tests/` | Pruebas de lógica (`unit.mjs`, `run.html`), prueba del guardado (`store.test.js`), servidor local con backend simulado (`dev-server.py`, `mock-client.js`) |
| `package.json`, `vercel.json` | Scripts y configuración de despliegue (Vercel publica la carpeta `public`) |
| `README.proyecto.md`, `VALIDACION.md` | Documentación original del proyecto (el README original se renombró para dejar espacio a este archivo) |

## Cómo recuperar esta versión

**Opción A, con Git (recomendada).** El mismo estado está etiquetado como `version-original`:

```bash
git checkout main
git revert --no-edit <commits del rediseño>   # o bien:
git checkout version-original -- public sql tests package.json vercel.json
git commit -m "Volver a la versión original" && git push origin main
```

**Opción B, desde esta carpeta.** Copia su contenido sobre la raíz del repositorio:

```bash
cp -R backup/version-original/public backup/version-original/sql backup/version-original/tests .
cp backup/version-original/package.json backup/version-original/vercel.json .
cp backup/version-original/README.proyecto.md README.md
git add -A && git commit -m "Volver a la versión original" && git push origin main
```

Vercel publicará la versión original en uno o dos minutos.

## Consideraciones antes de volver a usarla

- **Los datos son compatibles en ambos sentidos.** El rediseño v2 guarda en la misma fila de
  Supabase y con el mismo formato; solo agrega campos nuevos (estado de ánimo, frecuencia semanal
  de hábitos, preferencias de «Hoy», tareas soltadas) que esta versión ignora sin perderlos.
- Lo escrito en v2 en esos campos nuevos no se verá en esta versión, pero sigue guardado.
- No hace falta cambiar nada en Supabase: el esquema SQL no cambió.
- `public/config.js` contiene solo la URL y la clave **pública** de Supabase.
