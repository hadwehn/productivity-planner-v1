// Vista Semana: plan (intención y tareas) y revisión.
import { S, get } from '../state.js';
import { U } from '../ui.js';
import { visible, WEEK_QUESTIONS } from '../prefs.js';
import { MONTHS, addDays, esc, iso, monday, parseDate } from '../util.js';
import { check, emptyState, field, pagerHeader, ring, segmented } from './common.js';

const SLOTS = [0, 1, 2, 3, 4];
const filledText = v => !!String(v ?? '').trim();

export function weekProgress(week) {
  const items = ['a', 'b'].flatMap(r => Object.values(S.w[week]?.[r] || {})).filter(x => filledText(x?.t));
  const done = items.filter(x => x.c).length, total = items.length, left = total - done;
  const message = !total ? 'Elige unas pocas tareas que valgan tu tiempo.'
    : !left ? '¡Todas tus tareas están listas!'
      : `Te ${left === 1 ? 'queda' : 'quedan'} ${left} ${left === 1 ? 'tarea pendiente' : 'tareas pendientes'}. ¡Sigue así!`;
  return { done, total, percent: total ? Math.round(done / total * 100) : 0, message };
}

function monthContext(week) {
  const p = Object.values(S.m[week.slice(0, 7)]?.p || {}).filter(filledText);
  return p.length ? `<div class="context"><b>Tu norte del mes</b><br>${p.map(esc).join(' · ')}</div>` : '';
}

function taskRows(base, list) {
  return SLOTS.map(i => {
    const P = `${base}${list}.${i}.`, done = !!get(P + 'c', false), filled = filledText(get(P + 't'));
    return `<div class="row week-task${done ? ' done' : ''}"><span class="num">${i + 1}</span>${check(P + 'c')}${field(P + 't', 'Tarea ' + (i + 1))}`
      + `<button class="tiny-action plan-action" data-a="move" data-r="${list}" data-i="${i}" aria-label="Llevar a un día" title="Llevar a un día"${filled ? '' : ' hidden'}>↘</button></div>`;
  }).join('');
}

export function weekView() {
  const k = U.wk, a = parseDate(k), b = addDays(a, 6), W = `w.${k}.`;
  const short = d => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  const head = `<div class="sticky-page-head page-offset">${pagerHeader({
    nav: 'data-a="wk"', title: 'Semana', subtitle: `${short(a)} – ${short(b)}`, prev: 'Semana anterior', next: 'Semana siguiente',
    reset: k !== iso(monday(new Date())) ? 'data-a="hoyw"' : '', resetLabel: 'Esta semana',
  })}${segmented('wt', [['p', 'Plan'], ['r', 'Revisión']], U.wt)}</div>`;

  if (U.wt === 'r') {
    const cards = WEEK_QUESTIONS.map((q, i) => (visible('w_r' + i) ? `<div class="card"><label class="q">${i + 1}. ${q}</label>${field(W + 'r.' + i, '', 4)}</div>` : '')).join('');
    return head + (cards || emptyState());
  }
  const pr = weekProgress(k);
  const sections = [
    ['w_prog', `<div class="card"><div class="row">${ring(pr.percent, `${pr.done}/${pr.total}`, true, 'weekProgress')}<div><b>Tu semana</b><div class="sub" id="weekProgressText">${pr.message}</div></div></div></div>`],
    ['w_int', `<div class="card intent"><h2>Intención de la semana</h2>${field(W + 'i', '¿Cuál es mi intención para esta semana?', 2)}</div>`],
    ['w_imp', `<div class="card pr"><h2>Prioridades de la semana</h2><p class="sub card-note">Hasta cinco. No necesitas llenar todos los espacios.</p>${taskRows(W, 'a')}</div>`],
    ['w_sec', `<div class="card"><h2>Otras tareas de la semana</h2>${taskRows(W, 'b')}</div>`],
  ].filter(([key]) => visible(key)).map(([, html]) => html).join('');
  return head + monthContext(k) + (sections || emptyState());
}
