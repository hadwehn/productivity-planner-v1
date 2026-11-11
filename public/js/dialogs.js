// Diálogos: hábito, evento, llevar tarea semanal a un día y bienvenida.
import { S, get, save } from './state.js';
import { U, toast } from './ui.js';
import { categoryChoices } from './categories.js';
import { modeCards } from './prefs.js';
import { planWeeklyTask } from './tasks.js';
import { render } from './render.js';
import { $, $$, DAYS, esc, newId, today } from './util.js';

const head = (title, closeAction = 'dismiss') => `<div class="modal-head"><h2>${title}</h2><button class="ib" type="button" data-a="${closeAction}" aria-label="Cerrar">×</button></div>`;

export function habitEditor(id) {
  const h = S.h.find(x => x.id === id), dlg = $('#editDlg');
  dlg.innerHTML = head(h ? 'Editar hábito' : 'Nuevo hábito') + `<form id="habitForm" class="modal-body">
    <label class="q" for="habitName">Algo pequeño que te haga bien</label>
    <input id="habitName" type="text" required maxlength="100" placeholder="Por ejemplo, caminar 10 minutos" value="${esc(h?.name || '')}">
    <fieldset class="category-field"><legend>Categoría</legend><div class="category-list">${categoryChoices('habitColor', h?.color ?? 0)}</div></fieldset>
    <fieldset><legend>¿Qué días quieres hacerlo?</legend><div class="schedule">${DAYS.map((d, i) => `<label>${d.slice(0, 3)}<input type="checkbox" name="days" value="${i}"${!h?.days || h.days.includes(i) ? ' checked' : ''}></label>`).join('')}</div></fieldset>
    <button class="btn" type="submit">Guardar hábito</button>
    ${h ? `<button class="btn ghost" type="button" data-a="habitdelete" data-id="${esc(id)}">Eliminar hábito</button>` : ''}
    <p class="sub">Los días libres no cuentan en el progreso. Puedes volver a empezar cuando quieras.</p></form>`;
  dlg.showModal();
  $('#habitForm').onsubmit = e => {
    e.preventDefault();
    const color = Number($('#habitForm input[name=habitColor]:checked')?.value ?? 0);
    const name = $('#habitName').value.trim();
    const days = $$('#habitForm input[name=days]:checked').map(x => +x.value);
    if (!name || !days.length) { toast('Escribe un nombre y elige al menos un día.'); return; }
    if (h) Object.assign(h, { name, days, color });
    else S.h.push({ color, id: newId(), name, days, createdOn: today() });
    save();
    dlg.close();
    render();
    toast(h ? 'Hábito actualizado' : 'Hábito creado');
  };
}

export function deleteHabit(id) {
  const h = S.h.find(x => x.id === id);
  if (!h || !confirm(`¿Eliminar «${h.name}» y sus registros? Puedes descargar un respaldo antes.`)) return;
  S.h = S.h.filter(x => x.id !== id);
  Object.values(S.hl).forEach(o => delete o[id]);
  save();
  $('#editDlg').close();
  render();
}

export function eventEditor(index = null) {
  const current = index === null ? null : S.ev[U.cd]?.[index];
  if (index !== null && !current) return;
  const draft = current ? { ...current } : { t: '', h: '09:00', c: -1 }, allDay = !draft.h, dlg = $('#eventDlg');
  dlg.innerHTML = head(current ? 'Editar evento' : 'Nuevo evento') + `<form id="eventForm" class="modal-body">
    <label class="q" for="eventTitle">Actividad</label>
    <input id="eventTitle" type="text" required maxlength="200" placeholder="¿Qué tienes planeado?" value="${esc(draft.t)}">
    <div class="event-time"><label class="time-label" for="eventHour">Hora<input id="eventHour" type="time" step="300" value="${esc(draft.h || '09:00')}"${allDay ? ' disabled' : ''}></label>
    <label class="event-all-day"><input id="eventAllDay" type="checkbox"${allDay ? ' checked' : ''}><span>Todo el día</span></label></div>
    <fieldset class="category-field"><legend>Categoría <span class="optional-hint">(opcional · sin elegir, gris)</span></legend><div class="category-list">${categoryChoices('eventCategory', draft.c)}</div></fieldset>
    <button class="btn" type="submit">${current ? 'Guardar cambios' : 'Guardar evento'}</button>
    ${current ? '<button class="btn ghost" type="button" id="eventDelete">Eliminar evento</button>' : ''}</form>`;
  dlg.showModal();
  $('#eventTitle').focus({ preventScroll: true });
  $('#eventAllDay').onchange = e => { $('#eventHour').disabled = e.target.checked; };
  // La categoría es opcional: pulsar de nuevo la elegida la desmarca.
  const radios = $$('#eventForm input[name=eventCategory]');
  radios.forEach(radio => {
    radio.dataset.was = String(radio.checked);
    radio.addEventListener('click', () => {
      if (radio.dataset.was === 'true') { radio.checked = false; radio.dataset.was = 'false'; }
      else radios.forEach(r => { r.dataset.was = String(r === radio); });
    });
  });
  $('#eventForm').onsubmit = e => {
    e.preventDefault();
    const t = $('#eventTitle').value.trim(), h = $('#eventAllDay').checked ? '' : $('#eventHour').value;
    const c = Number($('#eventForm input[name=eventCategory]:checked')?.value ?? -1);
    if (!t) { toast('Escribe una actividad.'); return; }
    const list = S.ev[U.cd] = S.ev[U.cd] || [];
    if (index === null) list.push({ t, h, c }); else list[index] = { t, h, c };
    save();
    dlg.close();
    render();
    toast('Evento guardado');
  };
  $('#eventDelete')?.addEventListener('click', () => {
    if (!confirm('¿Eliminar este evento?')) return;
    S.ev[U.cd].splice(index, 1);
    save();
    dlg.close();
    render();
    toast('Evento eliminado');
  });
}

export function planTaskDialog(list, i) {
  const path = `w.${U.wk}.${list}.${i}`, dlg = $('#moveDlg');
  dlg.innerHTML = head('Llevar al día') + `<form id="moveForm" class="modal-body"><p>${esc(get(path + '.t'))}</p>
    <label class="q" for="moveDate">¿Cuándo quieres darle espacio?</label><input id="moveDate" type="date" required value="${today()}">
    <fieldset class="move-kind-group"><legend class="q">¿Dónde quieres ubicarla?</legend>
      <label class="move-kind-option"><input type="radio" name="moveKind" value="priority" required><span>Llevar a tareas más importantes</span></label>
      <label class="move-kind-option"><input type="radio" name="moveKind" value="secondary" required><span>Llevar a tareas secundarias</span></label></fieldset>
    <p class="sub">La tarea se mantiene en tu semana y el estado de completado se comparte con el día. Si le cambias el nombre, dejan de estar vinculadas.</p>
    <button class="btn">Planificar tarea</button></form>`;
  dlg.showModal();
  $('#moveForm').onsubmit = e => {
    e.preventDefault();
    const date = $('#moveDate').value, kind = $('#moveForm input[name=moveKind]:checked')?.value;
    if (!date || !kind) return;
    const result = planWeeklyTask(path, date, kind === 'priority' ? 'priority' : 'other');
    if (result.error) { toast(result.error); return; }
    dlg.close();
    Object.assign(U, { dd: date, dt: 'p', tab: 'd' });
    render(true);
    toast('Tarea planificada');
  };
}

export function showWelcome() {
  if (S.cfg.welcomed) return;
  $('#welcomeDlg').innerHTML = head('Bienvenida', 'welcome') + `<div class="modal-body"><p class="welcome-lead">Haz espacio para lo que importa.</p>
    <p class="sub">Elige cuánto espacio quieres para planificar y reflexionar. Puedes cambiarlo después desde ⋯.</p>
    ${modeCards('startpreset', 'balanced')}<button class="link" data-a="welcome">Elegir más tarde</button></div>`;
  $('#welcomeDlg').showModal();
}

/** Cierra un diálogo al tocar fuera, sin confundirlo con un arrastre que empezó dentro. */
export function initDialogs() {
  for (const dialog of $$('#dlg,#editDlg,#moveDlg,#eventDlg')) {
    let outside = false;
    const hit = e => {
      const r = dialog.getBoundingClientRect();
      return e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
    };
    dialog.addEventListener('pointerdown', e => { outside = hit(e); });
    dialog.addEventListener('pointercancel', () => { outside = false; });
    dialog.addEventListener('click', e => { if (outside && hit(e)) dialog.close(); outside = false; });
  }
  $('#welcomeDlg').addEventListener('cancel', () => { S.cfg.welcomed = true; save(); });
}
