// «Diario»: mirar hacia atrás. Ánimo del mes, un recuerdo y lo escrito cada día.
import { S } from '../state.js';
import { U } from '../ui.js';
import { MOODS, moodColor, moodName } from '../categories.js';
import { icon } from '../icons.js';
import { DAYS, DAY_SHORT, MONTHS, daysInMonth, esc, monthTitle, p2, parseDate, shiftDate, today, weekday } from '../util.js';
import { pageHead, sectionHead } from './common.js';

const clean = v => String(v || '').trim();
const hasEntry = d => d && (clean(d.i) || clean(d.g) || clean(d.r) || clean(d.n) || d.mood);

/** Un recuerdo estable por día: gratitud o reflexión de hace al menos una semana. */
function memory(T) {
  const limit = shiftDate(T, -7);
  const pool = Object.entries(S.d).filter(([date, d]) => date <= limit && (clean(d.g) || clean(d.r))).sort(([a], [b]) => a.localeCompare(b));
  if (!pool.length) return '';
  const seed = [...T].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const [date, d] = pool[seed % pool.length], text = clean(d.g) || clean(d.r), kind = clean(d.g) ? 'agradeciste' : 'escribiste';
  const pd = parseDate(date);
  return `<section class="section"><div class="card memory"><p class="label">${icon('leaf')}Un recuerdo</p><p>“${esc(text.length > 220 ? text.slice(0, 219) + '…' : text)}”</p>
    <button class="link" data-a="openday" data-k="${date}">El ${pd.getDate()} de ${MONTHS[pd.getMonth()]} ${kind} esto</button></div></section>`;
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
  return `<section class="section">${sectionHead('Tu ánimo este mes', `<span class="muted small">${count} ${count === 1 ? 'día' : 'días'}</span>`)}
    <div class="card"><div class="mood-month">${cells}</div><div class="legend">${MOODS.map(([k, label]) => `<span style="--c:${moodColor(k)}"><i></i>${label}</span>`).join('')}</div></div></section>`;
}

function entry(date, d) {
  const pd = parseDate(date), rows = [];
  if (clean(d.i)) rows.push(['Intención', clean(d.i), true]);
  if (clean(d.g)) rows.push(['Gratitud', clean(d.g)]);
  if (clean(d.r)) rows.push(['Reflexión', clean(d.r)]);
  if (clean(d.n)) rows.push(['Notas', clean(d.n)]);
  const mood = d.mood ? `<span class="mood-tag" style="--c:${moodColor(d.mood)}"><i></i>${moodName(d.mood)}</span>` : '';
  return `<article class="card entry" data-a="openday" data-k="${date}" role="link" tabindex="0" aria-label="Abrir ${DAYS[weekday(pd)]} ${pd.getDate()}"><div class="entry-head"><strong>${DAYS[weekday(pd)]} ${pd.getDate()}</strong>${mood}</div>
    ${rows.length ? `<dl>${rows.map(([t, v, serif]) => `<div><dt>${t}</dt><dd class="${serif ? 'serif' : ''}">${esc(v)}</dd></div>`).join('')}</dl>` : ''}</article>`;
}

export function journalView() {
  const m = U.journalMonth, T = today();
  const days = Object.entries(S.d).filter(([date, d]) => date.startsWith(m) && date <= T && hasEntry(d)).sort(([a], [b]) => b.localeCompare(a));
  const nav = `<span class="range"><button class="mini" data-a="shiftjournal" data-n="-1" aria-label="Mes anterior">${icon('left')}</button><span style="text-transform:capitalize">${monthTitle(m)}</span><button class="mini" data-a="shiftjournal" data-n="1" aria-label="Mes siguiente"${m >= T.slice(0, 7) ? ' disabled' : ''}>${icon('right')}</button></span>`;
  return `<div class="view">${pageHead({ title: 'Diario', subtitle: nav })}
    ${m === T.slice(0, 7) ? memory(T) : ''}
    ${moodMonth(m)}
    <section class="section">${sectionHead('Lo que escribiste')}
      ${days.length ? `<div style="display:grid;gap:12px">${days.map(([date, d]) => entry(date, d)).join('')}</div>`
        : '<div class="card"><p class="empty-note">Aquí se irán guardando tus intenciones, gratitudes y reflexiones. Escribe una línea al cerrar el día; con el tiempo, este será tu mejor registro.</p></div>'}
    </section></div>`;
}
