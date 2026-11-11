// Punto de entrada: sesión, sincronización con la nube y arranque de la interfaz.
import { makeClient } from './client.js';
import { CloudStore } from './store.js';
import { S, blank, checkedState, normalize, onSave, setState, summary } from './js/state.js';
import { migrate } from './js/migrate.js';
import { applyTheme, toast } from './js/ui.js';
import { render, renderNav } from './js/render.js';
import { initInteractions } from './js/interactions.js';
import { initDialogs, showWelcome } from './js/dialogs.js';
import { initNotes } from './js/views/notes.js';
import { $, $$, today } from './js/util.js';

let cloud = null, ready = false, client = null, sessionUser = null, polling = false, authGeneration = 0;

onSave(() => (cloud && ready ? cloud.schedule(() => checkedState(S)) : false));

// ——— Respaldo ———
function download(data, name) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const envelope = () => ({ format: 'con-intencion', version: 2, exportedAt: new Date().toISOString(), ownerId: sessionUser?.id, revision: cloud?.revision, pending: !!cloud?.unsaved, data: S });
const downloadCurrent = () => download(envelope(), `agenda-respaldo-${today()}.json`);

async function importBackup(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !ready) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw Error('El archivo supera 10 MiB.');
    const json = JSON.parse(await file.text());
    if (json?.format === 'con-intencion' && json.version !== 2) throw Error('Versión no compatible.');
    const next = checkedState(json?.format === 'con-intencion' ? json.data : json), info = summary(next);
    if (info.origenesAusentes) throw Error(`Hay ${info.origenesAusentes} tareas cuyo origen semanal falta. Repara el respaldo o conserva el original; no se importó nada.`);
    await cloud.flush();
    if (!confirm(`Cuenta destino: ${sessionUser.email}\n${JSON.stringify(info, null, 2)}\n`
      + (json.ownerId && json.ownerId !== sessionUser.id ? 'El respaldo pertenece a otra cuenta. ' : '')
      + 'REEMPLAZARÁ todo este diario, no mezclará ni añadirá duplicados. Descargaremos primero la versión actual. ¿Continuar?')) return;
    downloadCurrent();
    setState(next);
    migrate();
    applyTheme();
    cloud.schedule(() => checkedState(S));
    setReady(false);
    await cloud.flush();
    $('#dlg').close();
    render(true);
    toast('Importación guardada. Comprueba el resumen y el contenido.');
  } catch (error) { alert('No se completó la importación: ' + error.message); }
}

// ——— Estado de sincronización ———
function setReady(value) { ready = value; $('#planner').inert = !value; }
const closeDialogs = () => $$('dialog[open]').forEach(d => d.close());

function setSyncFeedback(kind, message) {
  $('#cloud-status').textContent = message;
  $('#sync-indicator').dataset.state = kind;
  $('#dbt').title = 'Opciones y cuenta · ' + message;
  $('#dbt').setAttribute('aria-label', 'Opciones y cuenta. ' + message);
}

const SYNC_LABELS = { pending: 'Cambios pendientes…', saving: 'Guardando…', saved: 'Guardado en la nube', error: 'No se pudo guardar', conflict: 'Hay cambios en otro dispositivo' };
function cloudStatus(kind, error) {
  setSyncFeedback(kind, SYNC_LABELS[kind] || kind);
  if (kind === 'error' || kind === 'conflict') {
    setReady(false);
    closeDialogs();
    $('#cloud-error').hidden = false;
    $('#retry-save').hidden = kind === 'conflict';
    $('#cloud-error-text').textContent = kind === 'conflict'
      ? 'Tu borrador sigue en esta pestaña. Descárgalo antes de cargar la versión de la nube. No se fusionarán automáticamente.'
      : 'Tus cambios siguen en esta pestaña. Reintenta o descarga un respaldo antes de salir. Detalle: ' + (error?.message || 'Error de conexión.');
  } else if (kind === 'saved') {
    $('#cloud-error').hidden = true;
    setReady(true);
  }
}

// ——— Acceso ———
function setAccessStage(stage) {
  $('#access').dataset.error = 'false';
  const code = stage === 'code', loading = stage === 'loading';
  $('#access-title').textContent = loading ? 'Recuperando tu diario…' : code ? 'Revisa tu correo.' : 'Tu diario te espera.';
  $('#access-description').textContent = loading ? 'Un momento, estamos buscando tu espacio.'
    : code ? 'Introduce el código en esta pantalla. Puedes leer el correo desde otro dispositivo.'
      : 'Entra para continuar con tus planes, tus hábitos y tus ideas.';
}

async function updateAccountRole(uid, generation) {
  try {
    const { data, error } = await client.from('app_roles').select('role').eq('user_id', uid).maybeSingle();
    if (generation !== authGeneration || sessionUser?.id !== uid) return;
    $('#metrics').hidden = !!error || data?.role !== 'admin';
  } catch { if (generation === authGeneration) $('#metrics').hidden = true; }
}

async function loadUser(user) {
  const generation = ++authGeneration;
  cloud?.stop();
  cloud = null;
  sessionUser = user;
  setReady(false);
  closeDialogs();
  setState(normalize(blank()));
  $('#v').innerHTML = '';
  $('#pers').innerHTML = '';
  $('#planner').hidden = true;
  $('#cloud-error').hidden = true;
  $('#metrics-result').textContent = '';
  $('#account').hidden = !user;
  $('#account-email').textContent = user?.email || '';
  $('#access-logout').hidden = !user;
  $('#metrics').hidden = true;
  $('#metrics-result').hidden = true;
  $('#otp-email').textContent = '';
  setAccessStage(user ? 'loading' : 'email');
  setSyncFeedback('loading', 'Cargando diario…');
  applyTheme();
  $('#access').hidden = false;
  $('#login-form').hidden = true;
  $('#code-form').hidden = true;
  $('#retry-load').hidden = true;
  if (!user) { $('#auth-status').textContent = ''; $('#login-form').hidden = false; return; }
  $('#auth-status').textContent = 'Cargando tus datos…';
  const store = new CloudStore(client, user.id, (kind, error) => { if (cloud === store) cloudStatus(kind, error); });
  cloud = store;
  try {
    const row = await store.read();
    if (generation !== authGeneration) return;
    setState(row ? checkedState(row.data) : normalize(blank()));
    store.revision = row?.revision || null;
    const before = JSON.stringify(S);
    migrate();
    applyTheme();
    $('#access').hidden = true;
    $('#planner').hidden = false;
    setReady(true);
    render(true);
    cloudStatus('saved');
    if (!row || JSON.stringify(S) !== before) { store.schedule(() => checkedState(S)); await store.flush(); }
    if (generation !== authGeneration) return;
    showWelcome();
    void updateAccountRole(user.id, generation);
  } catch (error) {
    if (generation !== authGeneration) return;
    setReady(false);
    $('#access').hidden = false;
    $('#planner').hidden = true;
    $('#access').dataset.error = 'true';
    $('#auth-status').textContent = 'No se pudo cargar: ' + error.message + ' No se reemplazaron los datos de la nube.';
    $('#retry-load').hidden = false;
  }
}

const editing = () => document.querySelector('dialog[open]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;

/** Trae cambios hechos en otro dispositivo si aquí no hay nada pendiente ni se está escribiendo. */
async function poll() {
  if (!cloud || !ready || cloud.unsaved || polling || document.hidden || editing()) return;
  polling = true;
  const store = cloud, generation = authGeneration;
  const stale = () => store !== cloud || generation !== authGeneration || store.unsaved || !ready;
  try {
    const meta = await store.read(true);
    if (stale() || (meta?.revision || null) === store.revision) return;
    const row = await store.read();
    if (stale() || editing()) return;
    if (!row) throw Error('El diario ya no existe. Vuelve a iniciar sesión.');
    setState(checkedState(row.data));
    store.revision = row.revision;
    migrate();
    applyTheme();
    render();
    setSyncFeedback('saved', 'Actualizado desde otro dispositivo');
  } catch { setSyncFeedback('warning', 'No se pudo comprobar la sincronización. Reintenta con conexión.'); }
  finally { polling = false; }
}

let lastSent = 0, otpEmail = '';
async function sendCode() {
  if (Date.now() - lastSent < 60000) throw Error('Espera 60 segundos antes de solicitar otro código.');
  otpEmail = $('#email').value.trim().toLowerCase();
  const { error } = await client.auth.signInWithOtp({ email: otpEmail, options: { shouldCreateUser: true } });
  if (error) throw error;
  lastSent = Date.now();
  $('#login-form').hidden = true;
  $('#code-form').hidden = false;
  $('#code').value = '';
  setAccessStage('code');
  $('#otp-email').textContent = otpEmail;
  $('#auth-status').textContent = 'Si no lo ves, revisa también la carpeta de spam.';
  $('#code').focus();
}
async function authAction(form, action) {
  $('#access').dataset.error = 'false';
  form.setAttribute('aria-busy', 'true');
  const buttons = $$('button', form);
  buttons.forEach(b => { b.disabled = true; });
  try { await action(); }
  catch (error) { $('#access').dataset.error = 'true'; $('#auth-status').textContent = 'No pudimos continuar: ' + error.message; }
  finally { form.setAttribute('aria-busy', 'false'); buttons.forEach(b => { b.disabled = false; }); }
}

async function logout() {
  setReady(false);
  closeDialogs();
  if (cloud?.unsaved) {
    try { await cloud.flush(); }
    catch { if (!confirm('Hay cambios sin guardar. Descárgalos primero si quieres conservarlos. ¿Cerrar sesión y descartarlos?')) { setReady(true); return; } }
  }
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    await loadUser(null);
    $('#code').value = '';
    $('#email').value = '';
  } catch (error) {
    if (cloud && !cloud.error) setReady(true);
    alert('No se pudo cerrar sesión: ' + error.message);
  }
}

function wire() {
  renderNav();
  initInteractions(() => ready);
  initDialogs();
  initNotes();
  document.addEventListener('planner:download', downloadCurrent);
  $('#imp').onchange = importBackup;
  $('#save-now').onclick = async () => { closeDialogs(); try { await cloud?.flush(); await poll(); } catch { /* el estado ya se muestra */ } };
  $('#retry-save').onclick = async () => { try { await cloud.retry(); render(); } catch { /* el estado ya se muestra */ } };
  $('#rescue').onclick = downloadCurrent;
  $('#load-cloud').onclick = async () => {
    if (cloud?.unsaved && !confirm('¿Ya descargaste tus cambios? Cargar la nube descartará el borrador de esta pestaña.')) return;
    await loadUser(sessionUser);
  };
  $('#retry-load').onclick = () => loadUser(sessionUser);
  $('#logout').onclick = logout;
  $('#access-logout').onclick = logout;
  $('#metrics').onclick = async () => {
    $('#metrics-result').hidden = false;
    $('#metrics-result').textContent = 'Consultando…';
    try {
      const { data, error } = await client.rpc('operational_metrics');
      if (error) throw error;
      $('#metrics-result').textContent = `Agendas creadas: ${data.cuentas_con_agenda} · Actualizadas en los últimos 7 días: ${data.agendas_actualizadas_7_dias}`;
    } catch { $('#metrics-result').textContent = 'No disponible: necesitas el rol de administrador o revisar tu conexión.'; }
  };
  $('#login-form').onsubmit = e => { e.preventDefault(); authAction(e.target, sendCode); };
  $('#code-form').onsubmit = e => {
    e.preventDefault();
    authAction(e.target, async () => {
      const { data, error } = await client.auth.verifyOtp({ email: otpEmail, token: $('#code').value.trim(), type: 'email' });
      if (error) throw error;
      $('#code').value = '';
      if (sessionUser?.id !== data.user.id) await loadUser(data.user);
    });
  };
  $('#resend').onclick = () => authAction($('#code-form'), sendCode);
  $('#change-email').onclick = () => {
    $('#code-form').hidden = true;
    $('#login-form').hidden = false;
    $('#code').value = '';
    $('#auth-status').textContent = '';
    setAccessStage('email');
    $('#email').focus();
  };
  window.addEventListener('beforeunload', e => { if (cloud?.unsaved) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('online', poll);
  window.addEventListener('focus', poll);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  setInterval(poll, 60000);
}

// Las llamadas de Auth se difieren fuera del callback para no bloquear el SDK.
async function boot() {
  try {
    client = makeClient();
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      setTimeout(() => { if ((session?.user?.id || null) !== (sessionUser?.id || null)) loadUser(session?.user || null); }, 0);
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    await loadUser(data.session?.user || null);
  } catch (error) {
    $('#auth-status').textContent = 'No se pudo iniciar: ' + error.message;
    $('#retry-load').hidden = false;
    $('#retry-load').onclick = boot;
  }
}

applyTheme();
wire();
boot();
