// «Diario»: mirar hacia atrás. Ánimo del mes, un recuerdo y lo escrito cada día.
import { S } from '../state.js';
import { U } from '../ui.js';
import { MOOD_LEVELS, moodColor, moodName } from '../categories.js';
import { icon } from '../icons.js';
import { dayMonth, monthYear, plural, tr } from '../i18n.js';
import { DAYS, DAY_SHORT, daysInMonth, esc, iso, p2, parseDate, shiftDate, shiftMonth, today, weekday } from '../util.js';
import { emptyState, sectionHead, segmented, settingsButton, stickyHead } from './common.js';
import { dayTasks } from '../tasks.js';
import { isDone, isDue } from '../habits.js';
import { isUnlocked, showUnlock } from '../lock.js';

const clean = v => String(v || '').trim();
const hasEntry = d => d && (clean(d.i) || clean(d.g) || clean(d.r) || clean(d.n) || d.mood);

// ——— Buscar en el Diario ———
// Busca en todo lo escrito (intención, gratitud, reflexión y notas), en cualquier mes, sin importar
// tildes ni mayúsculas, y resalta lo encontrado. La búsqueda es solo de la pantalla (no se guarda).
const MIN_QUERY = 2, MAX_RESULTS = 60;
const fold = ch => ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Texto escapado con las coincidencias de `q` dentro de <mark>. */
function highlight(text, q) {
  const needle = [...q].map(fold).join('');
  if (!needle) return esc(text);
  const chars = [...text], folded = chars.map(fold), flat = folded.join('');
  // Posición de cada carácter original dentro del texto plegado.
  const starts = []; let pos = 0;
  for (const f of folded) { starts.push(pos); pos += f.length; }
  let out = '', i = 0, from = 0;
  while ((i = flat.indexOf(needle, from)) !== -1) {
    const a = starts.findIndex(s => s >= i), endFlat = i + needle.length;
    let b = starts.findIndex(s => s >= endFlat); if (b === -1) b = chars.length;
    out += esc(chars.slice(starts.findIndex(s => s >= from) === -1 ? chars.length : starts.findIndex(s => s >= from), a).join('')) + `<mark>${esc(chars.slice(a, b).join(''))}</mark>`;
    from = endFlat;
  }
  const rest = starts.findIndex(s => s >= from);
  return out + (rest === -1 ? '' : esc(chars.slice(rest).join('')));
}
/**
 * Fragmento de `text` alrededor de lo buscado (como en un buscador): unas palabras antes y después,
 * con «…» donde se corta. Así la palabra siempre se ve, aunque esté al final de una nota larga.
 */
export function snippet(text, q, before = 60, after = 110) {
  const needle = [...q].map(fold).join(''), chars = [...text];
  if (!needle || chars.length <= before + after) return text;
  const folded = chars.map(fold), starts = [];
  let pos = 0;
  for (const f of folded) { starts.push(pos); pos += f.length; }
  const at = folded.join('').indexOf(needle);
  if (at === -1) return text;
  const a = Math.max(0, starts.findIndex(s => s >= at));
  let from = Math.max(0, a - before), to = Math.min(chars.length, a + needle.length + after);
  // Se corta en un espacio, para no partir palabras.
  if (from > 0) { const sp = chars.indexOf(' ', from); if (sp !== -1 && sp < a) from = sp + 1; }
  if (to < chars.length) { const sp = chars.lastIndexOf(' ', to); if (sp > a + needle.length) to = sp; }
  return (from > 0 ? '…' : '') + chars.slice(from, to).join('').replace(/\s+/g, ' ').trim() + (to < chars.length ? '…' : '');
}
const hit = (d, k, needle) => [...clean(d[k])].map(fold).join('').includes(needle);
const matches = (d, needle) => ['i', 'g', 'r', 'n'].some(k => hit(d, k, needle));
/** Tarjeta del día donde está lo buscado: intención y gratitud → Empieza tu día; reflexión → Cierra tu día. */
const cardFor = (d, needle) => (hit(d, 'i', needle) || hit(d, 'g', needle) ? 'morning' : hit(d, 'r', needle) ? 'evening' : hit(d, 'n', needle) ? 'notes' : '');

/** Lista de «Escritos»: lo del mes o, con una búsqueda, lo que coincide en todo el Diario. */
export function journalEntries() {
  const m = U.journalMonth, T = today(), q = clean(U.journalQuery);
  if (q.length >= MIN_QUERY) {
    const needle = [...q].map(fold).join('');
    const found = Object.entries(S.d).filter(([date, d]) => date <= T && hasEntry(d) && matches(d, needle)).sort(([a], [b]) => b.localeCompare(a));
    const shown = found.slice(0, MAX_RESULTS);
    const head = sectionHead(tr('En todo tu diario', 'Across your journal'), `<span class="muted small">${found.length} ${plural(found.length, 'resultado', 'resultados', 'result', 'results')}</span>`);
    const more = found.length > shown.length ? `<p class="muted small" style="margin:0 4px 10px">${tr(`Mostrando los ${shown.length} más recientes de ${found.length}. Escribe algo más preciso para afinar.`, `Showing the ${shown.length} most recent of ${found.length}. Type something more specific to narrow it down.`)}</p>` : '';
    return `<section class="section">${head}${more}${shown.length ? `<div class="entry-grid">${shown.map(([date, d]) => entry(date, d, q, true)).join('')}</div>`
      : `<div class="card"><p class="empty-note">${tr(`No encontramos «${esc(q)}» en lo que has escrito.`, `We couldn’t find “${esc(q)}” in what you’ve written.`)}</p></div>`}</section>`;
  }
  const days = Object.entries(S.d).filter(([date, d]) => date.startsWith(m) && date <= T && hasEntry(d)).sort(([a], [b]) => b.localeCompare(a));
  return `<section class="section">${sectionHead(tr('Lo que escribiste', 'What you wrote'), days.length ? `<span class="muted small">${days.length} ${plural(days.length, 'día', 'días', 'day', 'days')}</span>` : '')}
      ${days.length ? `<div class="entry-grid">${days.map(([date, d]) => entry(date, d)).join('')}</div>`
        : Object.entries(S.d).some(([date, d]) => date <= T && hasEntry(d))
          // Ya escribió otros meses: este mes vacío es algo común y va en una línea.
          ? `<div class="card"><p class="empty-note">${tr('Este mes todavía no tienes nada escrito.', 'Nothing written this month yet.')}</p></div>`
          // Nunca ha escrito: la invitación del primer uso.
          : emptyState({ iconName: 'journal', tone: 'gold', title: tr('Tu diario empieza hoy', 'Your journal starts today'),
            text: tr('Lo que escribas al empezar y cerrar tus días se irá guardando aquí. Con el tiempo, será tu mejor registro.', 'What you write when you start and close your days will collect here. Over time, it becomes your best record.'),
            action: `<button class="btn" data-a="go" data-k="today">${icon('today')}${tr('Ir a Hoy', 'Go to Today')}</button>` })}
    </section>`;
}
function searchBox() {
  const q = U.journalQuery || '';
  return `<div class="journal-search">${icon('search')}<input type="search" data-journal-search value="${esc(q)}" placeholder="${tr('Buscar en tu diario', 'Search your journal')}" aria-label="${tr('Buscar en tu diario', 'Search your journal')}" autocomplete="off" autocapitalize="none" enterkeyhint="search"><button type="button" class="icon-btn" data-a="journalclear" aria-label="${tr('Borrar búsqueda', 'Clear search')}"${q ? '' : ' hidden'}>${icon('close')}</button></div>`;
}

const written = d => clean(d?.g) || clean(d?.r);
/** El mismo día de hace `n` meses, si ese día existe (el 31 no existe en todos los meses). */
function monthsAgo(T, n) {
  const [y, m, d] = T.split('-').map(Number), x = new Date(y, m - 1 - n, d);
  return x.getDate() === d ? iso(x) : '';
}
/** Número estable a partir de un texto (FNV-1a), para elegir lo mismo todo el día. */
const hash = str => [...str].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

/**
 * Un recuerdo por día. Primero los aniversarios: lo escrito hace un año, hace un mes o hace una
 * semana (en ese orden). Si esos días están vacíos, uno al azar de hace más de una semana,
 * estable durante el día.
 */
function memory(T) {
  const anniversaries = [[monthsAgo(T, 12), tr('Hace un año', 'One year ago')], [monthsAgo(T, 1), tr('Hace un mes', 'One month ago')], [shiftDate(T, -7), tr('Hace una semana', 'One week ago')]];
  let [date, label] = anniversaries.find(([day]) => day && written(S.d[day])) || [];
  if (!date) {
    const limit = shiftDate(T, -7);
    const pool = Object.keys(S.d).filter(day => day < limit && written(S.d[day])).sort();
    if (!pool.length) return '';
    date = pool[hash(T) % pool.length];
    label = tr('Un recuerdo', 'A memory');
  }
  const d = S.d[date], text = written(d), grateful = !!clean(d.g);
  const when = dayMonth(parseDate(date)) + (date.slice(0, 4) !== T.slice(0, 4) ? tr(` de ${date.slice(0, 4)}`, `, ${date.slice(0, 4)}`) : '');
  const caption = grateful ? tr(`El ${when} agradeciste esto`, `On ${when} you were grateful for this`) : tr(`El ${when} escribiste esto`, `On ${when} you wrote this`);
  return `<section class="section"><div class="card memory"><p class="label">${icon('leaf')}${label}</p><p>“${esc(text.length > 220 ? text.slice(0, 219) + '…' : text)}”</p>
    <button class="link" data-a="openday" data-k="${date}">${caption}</button></div></section>`;
}

/**
 * Resumen del mes: días cerrados, ánimo más frecuente, tareas hechas y el hábito más constante.
 * En el mes en curso cuenta hasta hoy («hasta ahora»). No aparece si el mes no tiene nada.
 */
function monthSummary(m, T) {
  const last = m === T.slice(0, 7) ? Number(T.slice(8)) : daysInMonth(m);
  const dates = Array.from({ length: last }, (_, i) => `${m}-${p2(i + 1)}`);
  let closed = 0, done = 0, total = 0;
  const moods = {};
  for (const date of dates) {
    const d = S.d[date];
    if (!d) continue;
    if (d.closed?.e) closed++;
    if (d.mood) moods[d.mood] = (moods[d.mood] || 0) + 1;
    const { focus, rest } = dayTasks(date);
    for (const t of [...focus, ...rest]) { total++; if (t.row.c) done++; }
  }
  const topMood = Object.entries(moods).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
  let best = null;
  for (const h of S.h) {
    const due = dates.filter(date => isDue(h, date));
    if (due.length < 3) continue; // con muy pocos días no dice mucho
    const pct = Math.round(due.filter(date => isDone(h, date)).length / due.length * 100);
    if (!best || pct > best.pct) best = { name: h.name, pct };
  }
  if (!closed && !topMood && !total && !best?.pct) return '';
  const stat = (value, label, extra = '') => `<div class="stat"><b${extra}>${value}</b><span>${label}</span></div>`;
  const current = m === T.slice(0, 7);
  return `<section class="section">${sectionHead(current ? tr('Tu mes hasta ahora', 'Your month so far') : tr('Tu mes', 'Your month'))}
    <div class="card month-summary">
      ${stat(closed, plural(closed, 'día cerrado', 'días cerrados', 'day closed', 'days closed'))}
      ${stat(total ? `${done}<small>/${total}</small>` : '—', tr('tareas hechas', 'tasks done'))}
      ${stat(topMood ? `${icon('mood' + topMood, 'icon face')}` : '—', topMood ? tr(`ánimo más frecuente: ${moodName(+topMood).toLowerCase()}`, `most frequent mood: ${moodName(+topMood).toLowerCase()}`) : tr('sin ánimo registrado', 'no mood logged'), topMood ? ` style="color:${moodColor(+topMood)}"` : '')}
      ${stat(best ? `${best.pct}%` : '—', best ? tr(`constancia en «${esc(best.name)}»`, `consistency in “${esc(best.name)}”`) : tr('sin hábitos suficientes', 'not enough habit data'))}
    </div></section>`;
}

function moodMonth(m) {
  const [y, mo] = m.split('-').map(Number), offset = weekday(new Date(y, mo - 1, 1)), n = daysInMonth(m);
  let cells = DAY_SHORT.map(d => `<span class="muted small" style="text-align:center;font-weight:600">${d.slice(0, 1)}</span>`).join('');
  for (let i = 0; i < offset; i++) cells += '<i class="blank"></i>';
  let count = 0;
  const T = today();
  for (let d = 1; d <= n; d++) {
    // Hoy lleva un anillo y los días que faltan se ven más tenues: así el mes se lee de un vistazo.
    const date = `${m}-${p2(d)}`, mood = S.d[date]?.mood, cls = [mood && 'has', date === T && 'today', date > T && 'future'].filter(Boolean).join(' ');
    if (mood) count++;
    cells += `<i class="${cls}" style="${mood ? `--c:${moodColor(mood)}` : ''}" title="${d}${mood ? ' · ' + moodName(mood) : ''}"></i>`;
  }
  return `<section class="section">${sectionHead(tr('Tu ánimo este mes', 'Your mood this month'), `<span class="muted small">${count} ${plural(count, 'día', 'días', 'day', 'days')}</span>`)}
    <div class="card"><div class="mood-month">${cells}</div><div class="legend">${MOOD_LEVELS.map(k => `<span style="--c:${moodColor(k)}"><i></i>${moodName(k)}</span>`).join('')}</div></div></section>`;
}

function entry(date, d, q = '', withYear = false) {
  const pd = parseDate(date), rows = [];
  const needle = q ? [...q].map(fold).join('') : '';
  // En una búsqueda se muestran solo los campos donde está lo buscado, con el fragmento que lo contiene.
  const add = (k, label, serif = false) => {
    if (!clean(d[k]) || (needle && !hit(d, k, needle))) return;
    rows.push([label, needle ? snippet(clean(d[k]), q) : clean(d[k]), serif]);
  };
  add('i', tr('Intención', 'Intention'), true);
  add('g', tr('Gratitud', 'Gratitude'));
  add('r', tr('Reflexión', 'Reflection'));
  add('n', tr('Notas', 'Notes'));
  const mood = d.mood ? `<span class="mood-tag" style="--c:${moodColor(d.mood)}">${icon('mood' + d.mood, 'icon face')}${moodName(d.mood)}</span>` : '';
  // En los resultados de una búsqueda (de cualquier mes) va la fecha completa.
  const title = withYear ? `${DAYS[weekday(pd)]} ${dayMonth(pd)}${pd.getFullYear() !== new Date().getFullYear() ? ` ${pd.getFullYear()}` : ''}` : `${DAYS[weekday(pd)]} ${pd.getDate()}`;
  const target = q ? cardFor(d, [...q].map(fold).join('')) : '';
  return `<article class="card entry" data-a="openday" data-k="${date}"${target ? ` data-f="${target}"` : ''} role="link" tabindex="0" aria-label="${tr('Abrir', 'Open')} ${title}"><div class="entry-head"><strong>${title}</strong>${mood}</div>
    ${rows.length ? `<dl>${rows.map(([t, v, serif]) => `<div><dt>${t}</dt><dd class="${serif ? 'serif' : ''}">${q ? highlight(v, q) : esc(v)}</dd></div>`).join('')}</dl>` : ''}</article>`;
}

export function journalView() {
  const title = tr('Diario', 'Journal');
  // Con código: sin cabecera. Solo Ajustes arriba y el teclado, que cabe en la pantalla sin desplazarse.
  if (!isUnlocked()) return `<div class="view locked"><h1 class="sr-only">${title}</h1><div class="lock-top">${settingsButton()}</div>${showUnlock()}</div>`;
  const m = U.journalMonth, T = today();
  const days = Object.entries(S.d).filter(([date, d]) => date.startsWith(m) && date <= T && hasEntry(d)).sort(([a], [b]) => b.localeCompare(a));
  // Bajo el título, el mes en tres paneles (anterior, actual, siguiente): se cambia deslizando, como en Plan.
  const monthPanel = o => {
    const mm = shiftMonth(m, o), side = o !== 0, skip = side ? ' tabindex="-1"' : '';
    const arrow = (n, label, name, off) => `<button type="button" data-a="shiftjournal" data-n="${n}" aria-label="${label}" title="${label}"${skip}${off ? ' disabled' : ''}>${icon(name)}</button>`;
    return `<div class="plan-head-panel"${side ? ' aria-hidden="true"' : ''}><div class="plan-range short"><b><span class="cap">${monthYear(mm)}</span></b><span class="range-nav">${arrow(-1, tr('Mes anterior', 'Previous month'), 'left')}${arrow(1, tr('Mes siguiente', 'Next month'), 'right', mm >= T.slice(0, 7))}</span></div></div>`;
  };
  const head = `<header class="plan-head"><h1 class="title">${title}</h1><div class="plan-swipe" data-swipe="journal"><div class="strip-track">${[-1, 0, 1].map(monthPanel).join('')}</div></div>${settingsButton()}</header>`;
  // Dos pestañas, como «Semana | Mes» en Plan: el resumen del mes y lo que escribiste.
  const tabs = segmented('journaltab', [['summary', tr('Resumen', 'Summary')], ['entries', tr('Escritos', 'Entries')]], U.journalTab);
  const body = U.journalTab === 'entries'
    ? `${searchBox()}<div id="journal-results">${journalEntries()}</div>`
    : `<div class="cols"><div class="col">${m === T.slice(0, 7) ? memory(T) : ''}${monthSummary(m, T)}</div><div class="col">${moodMonth(m)}</div></div>`;
  return `<div class="view">${stickyHead(head + tabs)}${body}</div>`;
}
