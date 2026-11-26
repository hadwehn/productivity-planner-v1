// Punto de entrada: sesión, sincronización con la nube y arranque de la interfaz.
import { makeClient } from './client.js';
import { CloudStore, isOffline } from './store.js';
import { S, blank, checkedState, normalize, onSave, setState, summary } from './js/state.js';
import { migrate } from './js/migrate.js';
import { dropOldOverdue, undatedToDay } from './js/tasks.js';
import { U, applyTextSize, applyTheme, openRitualForNow, rollDay, storedAppearance, toast } from './js/ui.js';
import { render, renderNav, navDots } from './js/render.js';
import { initInteractions } from './js/interactions.js';
import { welcome } from './js/sheets.js';
import { relock, setAuth } from './js/lock.js';
import { setLang, storedLang, tr } from './js/i18n.js';
import { initNotes } from './js/views/notes.js';
import { refreshGreeting } from './js/views/today.js';
import { $, $$, today } from './js/util.js';

let cloud = null, ready = false, client = null, sessionUser = null, polling = false, authGeneration = 0;

onSave(() => {
  if (!cloud || !ready) return false;
  const queued = cloud.schedule(() => checkedState(S));
  writeLocalSoon();
  return queued;
});

// ——— Copia en el dispositivo (para abrir sin conexión) ———
// El diario se guarda también en este dispositivo (localStorage), con su revisión y lo que falte
// subir. Al abrir se muestra al instante desde aquí y después se pone al día con la nube. Sin
// conexión se sigue usando con normalidad; los cambios se suben solos al volver.
// Sigue la regla de conflictos: si hubo cambios aquí y también en otro dispositivo, no se mezclan.
const LOCAL = uid => `focus-local:${uid}`, LAST_USER = 'focus-last-user';
let localOk = false, localFor = null, localTimer = 0;
function readLocal(uid) {
  try {
    const copy = JSON.parse(localStorage.getItem(LOCAL(uid)) || 'null');
    return copy?.v === 1 && copy.data ? copy : null;
  } catch { return null; }
}
/** Guarda la copia (estado, revisión y lo pendiente). Solo después de cargar el diario de esta cuenta. */
function writeLocal() {
  clearTimeout(localTimer);
  if (!cloud || !sessionUser || localFor !== sessionUser.id) return;
  try {
    localStorage.setItem(LOCAL(sessionUser.id), JSON.stringify({
      v: 1, at: Date.now(), data: S, revision: cloud.revision, pending: cloud.pending, dirty: !!(cloud.dirty || cloud.error),
    }));
    localOk = true;
  } catch { localOk = false; } // sin espacio o almacenamiento bloqueado: queda solo en memoria
}
const writeLocalSoon = () => { clearTimeout(localTimer); localTimer = setTimeout(writeLocal, 300); };
function forgetLocal(uid) {
  try { localStorage.removeItem(LOCAL(uid)); localStorage.removeItem(LAST_USER); } catch { /* sin almacenamiento */ }
}
/** La última cuenta que abrió aquí, si tiene copia: sirve para abrir sin conexión. */
function lastUser() {
  try {
    const u = JSON.parse(localStorage.getItem(LAST_USER) || 'null');
    return u?.id && readLocal(u.id) ? u : null;
  } catch { return null; }
}

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
const downloadCurrent = () => download(envelope(), `focus-respaldo-${today()}.json`);

async function importBackup(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !ready) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw Error(tr('El archivo supera 10 MiB.', 'The file is larger than 10 MiB.'));
    const json = JSON.parse(await file.text());
    if (json?.format === 'con-intencion' && json.version !== 2) throw Error(tr('Versión no compatible.', 'Unsupported version.'));
    const next = checkedState(json?.format === 'con-intencion' ? json.data : json), info = summary(next);
    if (info.origenesAusentes) throw Error(tr(`Hay ${info.origenesAusentes} tareas cuyo origen semanal falta. Repara el respaldo o conserva el original; no se importó nada.`, `${info.origenesAusentes} tasks are missing their weekly origin. Repair the backup or keep the original; nothing was imported.`));
    await cloud.flush();
    if (!confirm(`${tr('Cuenta destino', 'Target account')}: ${sessionUser.email}\n${JSON.stringify(info, null, 2)}\n`
      + (json.ownerId && json.ownerId !== sessionUser.id ? tr('El respaldo pertenece a otra cuenta. ', 'This backup belongs to another account. ') : '')
      + tr('REEMPLAZARÁ todo este diario, no mezclará ni añadirá duplicados. Descargaremos primero la versión actual. ¿Continuar?', 'This will REPLACE your whole journal; nothing is merged or duplicated. We will download the current version first. Continue?'))) return;
    downloadCurrent();
    setState(next);
    migrate();
    applyTheme();
    cloud.schedule(() => checkedState(S));
    setReady(false);
    await cloud.flush();
    closeDialogs();
    render(true);
    toast(tr('Importación guardada. Comprueba el resumen y el contenido.', 'Import saved. Check the summary and content.'));
  } catch (error) { alert(tr('No se completó la importación: ', 'The import did not complete: ') + error.message); }
}

// ——— Estado de sincronización ———
function setReady(value) { ready = value; $('#planner').inert = !value; }
const closeDialogs = () => $$('dialog[open]').forEach(d => d.close());

function setSyncFeedback(kind, message) {
  $('#cloud-status').textContent = message;
  document.documentElement.dataset.sync = kind;
}

const SYNC_LABELS = () => ({
  pending: tr('Cambios pendientes…', 'Pending changes…'), saving: tr('Guardando…', 'Saving…'), saved: tr('Guardado en la nube', 'Saved to the cloud'),
  error: tr('No se pudo guardar', 'Couldn’t save'), conflict: tr('Hay cambios en otro dispositivo', 'There are changes on another device'),
  offline: tr('Sin conexión · se guardará al volver', 'Offline · will save when back online'),
});
function cloudStatus(kind, error) {
  setSyncFeedback(kind, SYNC_LABELS()[kind] || kind);
  if (kind !== 'pending') writeLocal();
  if (kind === 'error' || kind === 'conflict') {
    setReady(false);
    closeDialogs();
    $('#cloud-error').hidden = false;
    $('#retry-save').hidden = kind === 'conflict';
    $('#cloud-error-text').textContent = kind === 'conflict'
      ? tr('Tu borrador sigue en esta pestaña. Descárgalo antes de cargar la versión de la nube. No se fusionarán automáticamente.', 'Your draft is still in this tab. Download it before loading the cloud version. They won’t be merged automatically.')
      : tr('Tus cambios siguen en esta pestaña. Reintenta o descarga un respaldo antes de salir. Detalle: ', 'Your changes are still in this tab. Retry or download a backup before leaving. Detail: ') + (error?.message || tr('Error de conexión.', 'Connection error.'));
  } else if (kind === 'saved') {
    $('#cloud-error').hidden = true;
    setReady(true);
  }
}

// ——— Acceso ———
function setAccessStage(stage) {
  $('#access').dataset.error = 'false';
  const code = stage === 'code', loading = stage === 'loading';
  $('#access-title').textContent = loading ? tr('Recuperando tu diario…', 'Getting your journal…') : code ? tr('Revisa tu correo.', 'Check your email.') : tr('Tu diario te espera.', 'Your journal is waiting.');
  $('#access-description').textContent = loading ? tr('Un momento, estamos buscando tu espacio.', 'One moment, we’re finding your space.')
    : code ? tr('Introduce el código en esta pantalla. Puedes leer el correo desde otro dispositivo.', 'Enter the code on this screen. You can read the email on another device.')
      : tr('Entra para continuar con tus planes, tus hábitos y tus ideas.', 'Sign in to continue with your plans, habits and ideas.');
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
  relock();
  cloud?.stop();
  cloud = null;
  sessionUser = user;
  setReady(false);
  closeDialogs();
  setState(normalize(blank()));
  $('#v').innerHTML = '';
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
  setSyncFeedback('loading', tr('Cargando diario…', 'Loading journal…'));
  applyTheme(storedAppearance()); // aún no hay datos: se usa la última apariencia de este dispositivo
  $('#access').hidden = false;
  $('#login-form').hidden = true;
  $('#code-form').hidden = true;
  $('#retry-load').hidden = true;
  if (!user) { $('#auth-status').textContent = ''; $('#login-form').hidden = false; return; }
  $('#auth-status').textContent = tr('Cargando tus datos…', 'Loading your data…');
  const store = new CloudStore(client, user.id, (kind, error) => { if (cloud === store) cloudStatus(kind, error); });
  cloud = store;
  localFor = null;
  // 1) Si hay copia en este dispositivo, se abre al instante con ella (también sin conexión).
  const local = readLocal(user.id);
  let shown = false;
  if (local) {
    try {
      setState(checkedState(local.data));
      store.revision = local.revision || null;
      store.pending = local.pending || null; // si se cerró a medio guardar, se reintenta igual (sin duplicar)
      if (local.dirty) { store.dirty = true; store.getState = () => checkedState(S); }
      startPlanner(store, user, generation, false);
      setSyncFeedback('loading', tr('Sincronizando…', 'Syncing…'));
      shown = true;
    } catch { setState(normalize(blank())); } // copia dañada: se ignora y se usa la nube
  }
  // 2) Se trae la nube.
  let row;
  try {
    row = await store.read();
    if (generation !== authGeneration) return;
    if (row) checkedState(row.data);
  } catch (error) {
    if (generation !== authGeneration) return;
    if (shown) {
      // Con la copia a la vista, sin conexión se sigue trabajando; lo pendiente se sube al volver.
      if (isOffline(error)) cloudStatus('offline');
      else setSyncFeedback('warning', tr('No se pudo comprobar la nube. Sigues con la copia de este dispositivo.', 'Couldn’t check the cloud. You’re using this device’s copy.'));
      if (store.unsaved) store.flush().catch(() => {});
      return;
    }
    setReady(false);
    $('#access').hidden = false;
    $('#planner').hidden = true;
    $('#access').dataset.error = 'true';
    $('#auth-status').textContent = isOffline(error)
      ? tr('Sin conexión. Conéctate una vez para descargar tu diario en este dispositivo; después abrirá aunque no haya señal.', 'You’re offline. Connect once to download your journal to this device; after that it will open without a connection.')
      : tr('No se pudo cargar: ', 'Couldn’t load: ') + error.message + tr(' No se reemplazaron los datos de la nube.', ' Your cloud data was not replaced.');
    $('#retry-load').hidden = false;
    return;
  }
  // 3) Sin copia: se abre con la nube, como siempre.
  if (!shown) {
    setState(row ? checkedState(row.data) : normalize(blank()));
    store.revision = row?.revision || null;
    const changed = startPlanner(store, user, generation, true);
    cloudStatus('saved');
    if (!row || changed) { store.schedule(() => checkedState(S)); try { await store.flush(); } catch { /* el estado ya se muestra */ } }
    return;
  }
  // 4) Con copia: se pone al día. Si aquí hay cambios sin subir, se suben (si también cambió la nube,
  // aparece el aviso de conflicto de siempre, sin mezclar). Si no, se toma la versión de la nube.
  if (store.unsaved) {
    try { await store.flush(); } catch { /* el estado ya se muestra */ }
  } else if ((row?.revision || null) !== store.revision && row) {
    setState(checkedState(row.data));
    store.revision = row.revision;
    const before = JSON.stringify(S);
    migrate();
    applyTheme();
    applyTextSize();
    setLang(S.cfg.lang || 'es');
    renderNav();
    render();
    cloudStatus('saved');
    if (JSON.stringify(S) !== before) store.schedule(() => checkedState(S));
  } else cloudStatus('saved');
}

/**
 * Muestra el diario ya cargado en S (desde la nube o desde la copia del dispositivo) y hace lo de
 * cada apertura: migraciones, soltar lo pendiente muy antiguo, bienvenida y avisos. Devuelve si
 * cambió algo que haya que guardar.
 */
function startPlanner(store, user, generation, fromCloud) {
  U.date = today();
  const before = JSON.stringify(S);
  migrate();
  // Lo pendiente de hace más de tres semanas se suelta (queda en su día). Y la antigua lista
  // «Algún día», ya retirada, pasa a hoy para que cada tarea se decida ahí.
  const dropped = dropOldOverdue(today()), fromSomeday = undatedToDay(today());
  applyTheme();
  applyTextSize();
  setLang(S.cfg.lang || 'es'); // español es el idioma base
  renderNav();
  $('#access').hidden = true;
  $('#planner').hidden = false;
  setReady(true);
  openRitualForNow();
  render(true);
  localFor = user.id;
  try { localStorage.setItem(LAST_USER, JSON.stringify({ id: user.id, email: user.email })); } catch { /* sin almacenamiento */ }
  const changed = JSON.stringify(S) !== before;
  if (changed && !fromCloud) store.schedule(() => checkedState(S));
  writeLocal();
  setTimeout(() => {
    if (generation !== authGeneration) return;
    welcome();
    const notices = [];
    if (fromSomeday) notices.push(fromSomeday === 1 ? tr('Una tarea de «Algún día» pasó a hoy.', 'A “Someday” task moved to today.')
      : tr(`${fromSomeday} tareas de «Algún día» pasaron a hoy.`, `${fromSomeday} “Someday” tasks moved to today.`));
    if (dropped) notices.push(dropped === 1 ? tr('Una tarea pendiente de hace más de tres semanas quedó en su día.', 'A task left over from over three weeks ago stayed on its day.')
      : tr(`${dropped} tareas pendientes de hace más de tres semanas quedaron en su día.`, `${dropped} tasks left over from over three weeks ago stayed on their day.`));
    if (notices.length) toast(notices.join(' '));
    void updateAccountRole(user.id, generation);
  }, 0);
  return changed;
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
    if (!row) throw Error(tr('El diario ya no existe. Vuelve a iniciar sesión.', 'The journal no longer exists. Sign in again.'));
    setState(checkedState(row.data));
    store.revision = row.revision;
    migrate();
    applyTheme();
    setLang(S.cfg.lang || 'es');
    renderNav();
    render();
    writeLocal();
    setSyncFeedback('saved', tr('Actualizado desde otro dispositivo', 'Updated from another device'));
  } catch (error) {
    if (isOffline(error)) setSyncFeedback('offline', tr('Sin conexión', 'Offline'));
    else setSyncFeedback('warning', tr('No se pudo comprobar la sincronización. Reintenta con conexión.', 'Couldn’t check sync. Try again when online.'));
  }
  finally { polling = false; }
}

let lastSent = 0, otpEmail = '';
async function sendCode() {
  if (Date.now() - lastSent < 60000) throw Error(tr('Espera 60 segundos antes de solicitar otro código.', 'Wait 60 seconds before requesting another code.'));
  otpEmail = $('#email').value.trim().toLowerCase();
  const { error } = await client.auth.signInWithOtp({ email: otpEmail, options: { shouldCreateUser: true } });
  if (error) throw error;
  lastSent = Date.now();
  $('#login-form').hidden = true;
  $('#code-form').hidden = false;
  $('#code').value = '';
  setAccessStage('code');
  $('#otp-email').textContent = otpEmail;
  $('#auth-status').textContent = tr('Si no lo ves, revisa también la carpeta de spam.', 'If you don’t see it, check your spam folder too.');
  $('#code').focus();
}
async function authAction(form, action) {
  $('#access').dataset.error = 'false';
  form.setAttribute('aria-busy', 'true');
  const buttons = $$('button', form);
  buttons.forEach(b => { b.disabled = true; });
  try { await action(); }
  catch (error) { $('#access').dataset.error = 'true'; $('#auth-status').textContent = tr('No pudimos continuar: ', 'We couldn’t continue: ') + error.message; }
  finally { form.setAttribute('aria-busy', 'false'); buttons.forEach(b => { b.disabled = false; }); }
}

async function logout() {
  setReady(false);
  closeDialogs();
  if (cloud?.unsaved) {
    try { await cloud.flush(); }
    catch { if (!confirm(tr('Hay cambios sin guardar. Descárgalos primero si quieres conservarlos. ¿Cerrar sesión y descartarlos?', 'There are unsaved changes. Download them first if you want to keep them. Sign out and discard them?'))) { setReady(true); return; } }
  }
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    if (sessionUser) forgetLocal(sessionUser.id); // al cerrar sesión, el diario no queda en este dispositivo
    await loadUser(null);
    $('#code').value = '';
    $('#email').value = '';
  } catch (error) {
    if (cloud && !cloud.error) setReady(true);
    alert(tr('No se pudo cerrar sesión: ', 'Couldn’t sign out: ') + error.message);
  }
}

function wire() {
  renderNav();
  initInteractions(() => ready);
  // Cerrar una hoja tocando fuera de ella.
  for (const dialog of $$('dialog.sheet')) dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  initNotes();
  document.addEventListener('planner:download', downloadCurrent);
  $('#imp').onchange = importBackup;
  $('#save-now').onclick = async () => { closeDialogs(); try { await cloud?.flush(); await poll(); } catch { /* el estado ya se muestra */ } };
  $('#retry-save').onclick = async () => { try { await cloud.retry(); render(); } catch { /* el estado ya se muestra */ } };
  $('#rescue').onclick = downloadCurrent;
  $('#load-cloud').onclick = async () => {
    if (cloud?.unsaved && !confirm(tr('¿Ya descargaste tus cambios? Cargar la nube descartará el borrador de esta pestaña.', 'Did you download your changes? Loading the cloud will discard this tab’s draft.'))) return;
    cloud?.stop();
    if (sessionUser) { try { localStorage.removeItem(LOCAL(sessionUser.id)); } catch { /* sin almacenamiento */ } }
    await loadUser(sessionUser);
  };
  $('#retry-load').onclick = () => loadUser(sessionUser);
  $('#logout').onclick = logout;
  $('#access-logout').onclick = logout;
  $('#metrics').onclick = async () => {
    $('#metrics-result').hidden = false;
    $('#metrics-result').textContent = tr('Consultando…', 'Checking…');
    try {
      const { data, error } = await client.rpc('operational_metrics');
      if (error) throw error;
      $('#metrics-result').textContent = tr(`Agendas creadas: ${data.cuentas_con_agenda} · Actualizadas en los últimos 7 días: ${data.agendas_actualizadas_7_dias}`, `Journals created: ${data.cuentas_con_agenda} · Updated in the last 7 days: ${data.agendas_actualizadas_7_dias}`);
    } catch { $('#metrics-result').textContent = tr('No disponible: necesitas el rol de administrador o revisar tu conexión.', 'Not available: you need the admin role or a connection.'); }
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
  window.addEventListener('beforeunload', e => { writeLocal(); if (cloud?.unsaved && !localOk) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('pagehide', writeLocal);
  // Al volver la conexión se sube lo pendiente y se traen los cambios de otros dispositivos.
  window.addEventListener('online', async () => {
    if (cloud?.unsaved && !cloud.error) { try { await cloud.flush(); } catch { /* el estado ya se muestra */ } }
    poll();
  });
  window.addEventListener('focus', poll);
  document.addEventListener('visibilitychange', () => {
    // Al salir de la app el Diario se vuelve a proteger, y las tareas y hábitos de Hoy se reordenan al volver.
    if (document.hidden) { writeLocal(); relock(); U.habitSort = U.taskSort = U.weekSort = null; if (U.tab === 'journal' && ready) render(); }
    else { const rolled = ready && rollDay(); if (ready && (rolled || U.tab === 'today' || U.tab === 'week')) render(); if (ready) navDots(); poll(); }
  });
  setAuth({
    email: () => sessionUser?.email,
    send: async () => {
      const { error } = await client.auth.signInWithOtp({ email: sessionUser.email, options: { shouldCreateUser: false } });
      if (error) throw error;
    },
    verify: async token => {
      const { data, error } = await client.auth.verifyOtp({ email: sessionUser.email, token, type: 'email' });
      if (error) throw error;
      if (data.user?.id !== sessionUser.id) throw Error(tr('La cuenta no coincide.', 'The account doesn’t match.'));
    },
  });
  setInterval(() => { if (ready && !document.hidden && !editing() && rollDay()) render(); if (ready) { navDots(); refreshGreeting(); } poll(); }, 60000);
}

// Las llamadas de Auth se difieren fuera del callback para no bloquear el SDK.
async function boot() {
  try {
    client = makeClient();
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      setTimeout(() => { if ((session?.user?.id || null) !== (sessionUser?.id || null)) loadUser(session?.user || null); }, 0);
    });
    // Recuperar la sesión puede necesitar internet (renovar el acceso). Si hay copia en el
    // dispositivo y tarda más de 3 s o no hay conexión, se abre con la última cuenta de aquí.
    const last = lastUser(), session = client.auth.getSession();
    const quick = last ? await Promise.race([session.catch(error => ({ error })), new Promise(r => setTimeout(() => r(null), 3000))]) : await session;
    if (quick === null || (last && (quick.error || !quick.data?.session) && !navigator.onLine) || (last && quick.error && isOffline(quick.error))) {
      await loadUser(last);
      // Si después responde con otra cuenta (o ninguna, con conexión), se respeta.
      session.then(({ data, error }) => {
        if (error || !navigator.onLine) return;
        const id = data.session?.user?.id || null;
        if (id !== (sessionUser?.id || null)) loadUser(data.session?.user || null);
      }).catch(() => {});
      return;
    }
    const { data, error } = quick;
    if (error) throw error;
    await loadUser(data.session?.user || null);
  } catch (error) {
    $('#auth-status').textContent = tr('No se pudo iniciar: ', 'Couldn’t start: ') + error.message;
    $('#retry-load').hidden = false;
    $('#retry-load').onclick = boot;
  }
}

// Antes de tener datos: idioma y apariencia que este dispositivo usó por última vez.
setLang(storedLang(), false);
applyTheme(storedAppearance());
setAccessStage('loading');
$('#auth-status').textContent = tr('Recuperando sesión…', 'Restoring your session…');
wire();
boot();

// La app queda guardada en el dispositivo para abrir sin conexión (ver sw.js). Se le pasan los
// archivos que ya cargó esta página, para que la primera visita también quede guardada.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(reg => {
    const urls = [new URL('./', location).href, new URL('index.html', location).href,
      ...performance.getEntriesByType('resource').map(r => r.name)];
    reg.active?.postMessage({ type: 'cache', urls });
  }).catch(() => { /* sin service worker: funciona igual, solo que no abre sin conexión */ });
}
