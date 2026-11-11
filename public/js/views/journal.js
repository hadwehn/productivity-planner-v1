// «Diario»: mirar hacia atrás. Ánimo del mes, un recuerdo y lo escrito cada día.
import { S } from '../state.js';
import { U } from '../ui.js';
import { MOOD_LEVELS, moodColor, moodName } from '../categories.js';
import { icon } from '../icons.js';
import { dayMonth, monthYear, plural, tr } from '../i18n.js';
import { DAYS, DAY_SHORT, daysInMonth, esc, iso, p2, parseDate, shiftDate, today, weekday } from '../util.js';
import { pageHead, sectionHead, stickyHead } from './common.js';
import { isUnlocked, showUnlock } from '../lock.js';

const clean = v => String(v || '').trim();
const hasEntry = d => d && (clean(d.i) || clean(d.g) || clean(d.r) || clean(d.n) || d.mood);

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

function moodMonth(m) {
  const [y, mo] = m.split('-').map(Number), offset = weekday(new Date(y, mo - 1, 1)), n = daysInMonth(m);
  let cells = DAY_SHORT.map(d => `<span class="muted small" style="text-align:center;font-weight:600">${d.slice(0, 1)}</span>`).join('');
  for (let i = 0; i < offset; i++) cells += '<i class="blank"></i>';
  let count = 0;
  for (let d = 1; d <= n; d++) {
    const mood = S.d[`${m}-${p2(d)}`]?.mood;
    if (mood) count++;
    cells += `<i class="${mood ? 'has' : ''}" style="${mood ? `--c:${moodColor(mood)}` : ''}" title="${d}${mood ? ' · ' + moodName(mood) : ''}"></i>`;
  }
  return `<section class="section">${sectionHead(tr('Tu ánimo este mes', 'Your mood this month'), `<span class="muted small">${count} ${plural(count, 'día', 'días', 'day', 'days')}</span>`)}
    <div class="card"><div class="mood-month">${cells}</div><div class="legend">${MOOD_LEVELS.map(k => `<span style="--c:${moodColor(k)}"><i></i>${moodName(k)}</span>`).join('')}</div></div></section>`;
}

function entry(date, d) {
  const pd = parseDate(date), rows = [];
  if (clean(d.i)) rows.push([tr('Intención', 'Intention'), clean(d.i), true]);
  if (clean(d.g)) rows.push([tr('Gratitud', 'Gratitude'), clean(d.g)]);
  if (clean(d.r)) rows.push([tr('Reflexión', 'Reflection'), clean(d.r)]);
  if (clean(d.n)) rows.push([tr('Notas', 'Notes'), clean(d.n)]);
  const mood = d.mood ? `<span class="mood-tag" style="--c:${moodColor(d.mood)}">${icon('mood' + d.mood, 'icon face')}${moodName(d.mood)}</span>` : '';
  const title = `${DAYS[weekday(pd)]} ${pd.getDate()}`;
  return `<article class="card entry" data-a="openday" data-k="${date}" role="link" tabindex="0" aria-label="${tr('Abrir', 'Open')} ${title}"><div class="entry-head"><strong>${title}</strong>${mood}</div>
    ${rows.length ? `<dl>${rows.map(([t, v, serif]) => `<div><dt>${t}</dt><dd class="${serif ? 'serif' : ''}">${esc(v)}</dd></div>`).join('')}</dl>` : ''}</article>`;
}

export function journalView() {
  const title = tr('Diario', 'Journal');
  if (!isUnlocked()) return `<div class="view">${stickyHead(pageHead({ title }))}${showUnlock()}</div>`;
  const m = U.journalMonth, T = today();
  const days = Object.entries(S.d).filter(([date, d]) => date.startsWith(m) && date <= T && hasEntry(d)).sort(([a], [b]) => b.localeCompare(a));
  const nav = `<span class="range"><button class="mini" data-a="shiftjournal" data-n="-1" aria-label="${tr('Mes anterior', 'Previous month')}">${icon('left')}</button><span style="text-transform:capitalize">${monthYear(m)}</span><button class="mini" data-a="shiftjournal" data-n="1" aria-label="${tr('Mes siguiente', 'Next month')}"${m >= T.slice(0, 7) ? ' disabled' : ''}>${icon('right')}</button></span>`;
  return `<div class="view">${stickyHead(pageHead({ title, subtitle: nav }))}
    ${m === T.slice(0, 7) ? memory(T) : ''}
    ${moodMonth(m)}
    <section class="section">${sectionHead(tr('Lo que escribiste', 'What you wrote'))}
      ${days.length ? `<div style="display:grid;gap:12px">${days.map(([date, d]) => entry(date, d)).join('')}</div>`
        : `<div class="card"><p class="empty-note">${tr('Aquí se irán guardando tus intenciones, gratitudes y reflexiones. Escribe una línea al cerrar el día; con el tiempo, este será tu mejor registro.', 'Your intentions, gratitude and reflections will collect here. Write one line when you close the day; over time, this becomes your best record.')}</p></div>`}
    </section></div>`;
}
