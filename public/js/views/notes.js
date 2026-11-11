// Notas del día: editor con formato breve. Se guarda HTML saneado (nRich) y texto plano (n).
import { get, setPath } from '../state.js';
import { $, esc } from '../util.js';

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI', 'H3', 'P', 'DIV', 'BR']);
const DROPPED = ['SCRIPT', 'STYLE', 'SVG', 'IFRAME', 'OBJECT', 'IMG', 'FORM'];

/** Conserva solo etiquetas de formato permitidas y nunca atributos. */
export function cleanNote(html) {
  const source = document.createElement('template');
  source.innerHTML = String(html || '');
  const convert = (node, depth = 0) => {
    if (depth > 35) return document.createTextNode('');
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE || DROPPED.includes(node.tagName)) return document.createTextNode('');
    const out = ALLOWED.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : document.createDocumentFragment();
    for (const child of [...node.childNodes]) out.appendChild(convert(child, depth + 1));
    return out;
  };
  const safe = document.createElement('div');
  for (const child of [...source.content.childNodes]) safe.appendChild(convert(child));
  return safe.innerHTML;
}

const BUTTONS = [['bold', 'B', 'Negrita'], ['italic', 'I', 'Cursiva'], ['title', 'T', 'Título'], ['bullet', '•', 'Lista con viñetas'], ['number', '1.', 'Lista numerada']];

export function notesEditor(date) {
  const base = `d.${date}.`, rich = get(base + 'nRich', null);
  const content = typeof rich === 'string' ? cleanNote(rich) : esc(get(base + 'n', '')).replace(/\n/g, '<br>');
  return `<section class="notes-card"><p class="section-note">Tus ideas, a tu manera.</p>
    <div class="notes-toolbar" role="toolbar" aria-label="Formato de notas">${BUTTONS.map(([action, label, title]) => `<button type="button" data-note-format="${action}" aria-label="${title}" title="${title}">${label}</button>`).join('')}</div>
    <div id="notesEditor" class="notes-editable" contenteditable="true" role="textbox" aria-label="Notas del día" aria-multiline="true" data-note-date="${date}" data-placeholder="Escribe tus notas…" spellcheck="true">${content}</div></section>`;
}

let lastSelection = null;
function rememberSelection() {
  const sel = window.getSelection(), editor = $('#notesEditor');
  if (sel?.rangeCount && editor && editor.contains(sel.anchorNode) && editor.contains(sel.focusNode)) lastSelection = sel.getRangeAt(0).cloneRange();
}
function restoreSelection() {
  const editor = $('#notesEditor'), sel = window.getSelection();
  if (!editor || !sel) return;
  if (lastSelection && editor.contains(lastSelection.startContainer) && editor.contains(lastSelection.endContainer)) {
    sel.removeAllRanges();
    sel.addRange(lastSelection);
  } else editor.focus();
}
function saveNotes() {
  const editor = $('#notesEditor');
  if (!editor) return;
  const key = `d.${editor.dataset.noteDate}.`;
  setPath(key + 'nRich', cleanNote(editor.innerHTML));
  setPath(key + 'n', editor.innerText || editor.textContent || '');
}

export function initNotes() {
  document.addEventListener('selectionchange', rememberSelection);
  // «1.» o «-» seguido de espacio al inicio de una línea crea una lista.
  document.addEventListener('beforeinput', e => {
    if (!e.target.closest?.('#notesEditor') || e.inputType !== 'insertText' || e.data !== ' ') return;
    const sel = window.getSelection();
    if (!sel?.rangeCount || !sel.isCollapsed) return;
    const range = sel.getRangeAt(0), node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const before = node.textContent.slice(0, range.startOffset);
    const kind = /^\s*1\.$/.test(before) ? 'insertOrderedList' : /^\s*[-*]$/.test(before) ? 'insertUnorderedList' : null;
    if (!kind) return;
    e.preventDefault();
    const start = document.createRange();
    start.setStart(node, 0);
    start.setEnd(node, range.startOffset);
    start.deleteContents();
    document.execCommand(kind, false, null);
    saveNotes();
  });
  document.addEventListener('input', e => { if (e.target.id === 'notesEditor') saveNotes(); });
  document.addEventListener('blur', e => { if (e.target.id === 'notesEditor') saveNotes(); }, true);
  document.addEventListener('pointerdown', e => { if (e.target.closest?.('[data-note-format]')) rememberSelection(); });
  document.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-note-format]'), editor = $('#notesEditor');
    if (!btn || !editor) return;
    restoreSelection();
    editor.focus({ preventScroll: true });
    const action = btn.dataset.noteFormat;
    if (action === 'bold') document.execCommand('bold', false, null);
    if (action === 'italic') document.execCommand('italic', false, null);
    if (action === 'bullet') document.execCommand('insertUnorderedList', false, null);
    if (action === 'number') document.execCommand('insertOrderedList', false, null);
    if (action === 'title') {
      const heading = window.getSelection()?.anchorNode?.parentElement?.closest('h3');
      document.execCommand('formatBlock', false, heading ? 'div' : 'h3');
    }
    saveNotes();
    rememberSelection();
  });
}
