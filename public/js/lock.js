// Código de 4 dígitos para el Diario (opcional, desactivado por defecto).
// Protege de miradas en el dispositivo; no cifra los datos. Se guarda solo un hash
// (SHA-256 con sal aleatoria) en cfg.journalLock, así funciona en todos los dispositivos.
import { S, save } from './state.js';
import { toast } from './ui.js';
import { icon } from './icons.js';
import { esc } from './util.js';
import { tr } from './i18n.js';

const LENGTH = 4, MAX_FAILURES = 5, WAIT_MS = 30000;

export const lockEnabled = () => !!S.cfg.journalLock?.hash;
let unlocked = false;
export const isUnlocked = () => unlocked || !lockEnabled();
export const relock = () => { unlocked = false; reset('unlock'); };

// Si sales del Diario y no vuelves en 5 minutos, se vuelve a proteger (además de al salir de la app).
const AWAY_MS = 5 * 60 * 1000;
let leftAt = 0;
/** Avisa del cambio de pestaña: al salir del Diario empieza a contar; al volver, revisa el tiempo. */
export function journalTab(from, to) {
  if (from === 'journal' && to !== 'journal') leftAt = Date.now();
  else if (to === 'journal' && from !== 'journal') {
    if (leftAt && Date.now() - leftAt >= AWAY_MS) relock();
    leftAt = 0;
  }
}

// Funciones de sesión que entrega app.js (para «olvidé mi código»).
let auth = null;
export const setAuth = a => { auth = a; };

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function hashPin(pin, salt) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`)));
}
const matches = async pin => lockEnabled() && (await hashPin(pin, S.cfg.journalLock.salt)) === S.cfg.journalLock.hash;

// ——— Estado del teclado ———
const st = { mode: 'unlock', buf: '', first: '', msg: '', failures: 0, until: 0, shake: false };
function reset(mode) { Object.assign(st, { mode, buf: '', first: '', msg: '', shake: false }); }

const TITLES = () => ({
  unlock: [tr('Diario protegido', 'Journal locked'), tr('Ingresa tu código para verlo.', 'Enter your code to open it.')],
  create: [tr('Crea un código', 'Create a code'), tr('Cuatro dígitos que recuerdes con facilidad.', 'Four digits you can remember easily.')],
  confirm: [tr('Confirma el código', 'Confirm the code'), tr('Escríbelo otra vez.', 'Type it again.')],
  disable: [tr('Quitar la protección', 'Turn off the lock'), tr('Ingresa tu código actual.', 'Enter your current code.')],
  change: [tr('Cambiar código', 'Change code'), tr('Primero, ingresa tu código actual.', 'First, enter your current code.')],
});

export function keypad() {
  const [title, sub] = TITLES()[st.mode];
  const dots = Array.from({ length: LENGTH }, (_, i) => `<i class="${i < st.buf.length ? 'on' : ''}"></i>`).join('');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(k => (k === '' ? '<span></span>'
    : k === 'del' ? `<button type="button" class="key quiet" data-a="pindel" aria-label="${tr('Borrar', 'Delete')}">⌫</button>`
      : `<button type="button" class="key" data-a="pin" data-k="${k}">${k}</button>`)).join('');
  return `<div class="lock${st.shake ? ' shake' : ''}" data-keypad>
    <span class="lock-icon">${icon('lock')}</span>
    <h2 class="lock-title">${title}</h2><p class="lock-sub">${sub}</p>
    <div class="pin-dots" aria-label="${st.buf.length} ${tr('de', 'of')} ${LENGTH}">${dots}</div>
    <p class="lock-msg" role="alert">${esc(st.msg)}</p>
    <div class="keys">${keys}</div>
    ${st.mode === 'unlock' || st.mode === 'disable' || st.mode === 'change' ? `<button type="button" class="link" data-a="pinforgot">${tr('¿Olvidaste tu código?', 'Forgot your code?')}</button>` : ''}
  </div>`;
}

// La vista o la hoja que muestra el teclado se vuelve a dibujar con este aviso.
const redraw = () => document.dispatchEvent(new CustomEvent('planner:lock'));
const settingsChanged = () => document.dispatchEvent(new CustomEvent('planner:settings'));

function fail() {
  st.failures++;
  st.shake = true;
  st.msg = tr('Código incorrecto.', 'Wrong code.');
  if (st.failures >= MAX_FAILURES) {
    st.failures = 0;
    st.until = Date.now() + WAIT_MS;
    st.msg = tr('Demasiados intentos. Espera 30 segundos.', 'Too many tries. Wait 30 seconds.');
  }
}

export async function pressDigit(d) {
  if (Date.now() < st.until) { st.msg = tr('Espera unos segundos antes de intentar de nuevo.', 'Wait a few seconds before trying again.'); redraw(); return; }
  if (st.buf.length >= LENGTH) return;
  st.buf += d;
  st.shake = false;
  if (st.buf.length < LENGTH) { st.msg = ''; redraw(); return; }
  redraw();
  const pin = st.buf;
  st.buf = '';
  if (st.mode === 'unlock') {
    if (await matches(pin)) { unlocked = true; st.failures = 0; st.msg = ''; } else fail();
  } else if (st.mode === 'create') {
    Object.assign(st, { first: pin, mode: 'confirm', msg: '' });
  } else if (st.mode === 'confirm') {
    if (pin !== st.first) { reset('create'); st.msg = tr('Los códigos no coinciden. Vuelve a crearlo.', 'The codes don’t match. Create it again.'); st.shake = true; }
    else {
      const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      S.cfg.journalLock = { hash: await hashPin(pin, salt), salt };
      save();
      unlocked = false;
      reset('unlock');
      document.dispatchEvent(new CustomEvent('planner:closesheet'));
      settingsChanged();
      toast(tr('Diario protegido con código', 'Journal locked with a code'));
      return;
    }
  } else if (st.mode === 'disable') {
    if (await matches(pin)) {
      delete S.cfg.journalLock;
      save();
      reset('unlock');
      document.dispatchEvent(new CustomEvent('planner:closesheet'));
      settingsChanged();
      toast(tr('Protección del Diario desactivada', 'Journal lock turned off'));
      return;
    }
    fail();
  } else if (st.mode === 'change') {
    if (await matches(pin)) Object.assign(st, { mode: 'create', msg: '', failures: 0 }); else fail();
  }
  redraw();
}
export function pressDelete() { st.buf = st.buf.slice(0, -1); st.msg = ''; st.shake = false; redraw(); }

/** Abre el teclado en una hoja para crear, cambiar o quitar el código. */
export function startFlow(mode) { reset(mode); return keypad(); }
export const lockMode = () => st.mode;
export const showUnlock = () => { if (st.mode !== 'unlock') reset('unlock'); return keypad(); };

// ——— Olvidé mi código: se confirma la identidad con un código enviado al correo ———
export function forgotHTML(sent = false, error = '') {
  const email = auth?.email?.() || tr('tu correo', 'your email');
  return `<div class="lock" data-forgot>
    <span class="lock-icon">${icon('lock')}</span>
    <h2 class="lock-title">${tr('¿Olvidaste tu código?', 'Forgot your code?')}</h2>
    <p class="lock-sub">${sent ? tr(`Escribe el código que enviamos a <b>${esc(email)}</b>.`, `Enter the code we sent to <b>${esc(email)}</b>.`) : tr(`Te enviaremos un código a <b>${esc(email)}</b>, como al iniciar sesión. Con él quitamos la protección del Diario; luego puedes crear un código nuevo.`, `We’ll send a code to <b>${esc(email)}</b>, just like when you sign in. With it we turn off the Journal lock; then you can create a new code.`)}</p>
    ${sent ? `<form data-form="forgotverify" style="width:100%;max-width:280px"><input class="input" id="forgotCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="${tr('Código del correo', 'Code from the email')}" style="text-align:center;letter-spacing:.2em;font-size:20px"><button class="btn" style="margin-top:12px">${tr('Verificar', 'Verify')}</button></form>`
      : `<button type="button" class="btn" data-a="forgotsend" style="max-width:280px">${tr('Enviarme el código', 'Send me the code')}</button>`}
    <p class="lock-msg" role="alert">${esc(error)}</p>
  </div>`;
}
export async function sendForgotCode() {
  if (!auth) throw Error(tr('Sesión no disponible.', 'Session not available.'));
  await auth.send();
}
export async function verifyForgotCode(code) {
  if (!auth) throw Error(tr('Sesión no disponible.', 'Session not available.'));
  await auth.verify(code);
  delete S.cfg.journalLock;
  save();
  unlocked = false;
  reset('unlock');
  settingsChanged();
}
