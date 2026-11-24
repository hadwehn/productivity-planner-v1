// Notas del día: editor con formato breve (negrita, cursiva, título y listas).
// Se guarda HTML saneado (nRich) y texto plano (n). El contenido siempre queda en bloques
// (<div>, <h3>, <ul>/<ol>): así Enter, las listas y los botones se comportan igual en todos los navegadores.
import { get, setPath } from '../state.js';
import { $, $$, esc } from '../util.js';
import { icon } from '../icons.js';
import { tr } from '../i18n.js';

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI', 'H3', 'P', 'DIV', 'BR']);
const DROPPED = ['SCRIPT', 'STYLE', 'SVG', 'IFRAME', 'OBJECT', 'IMG', 'FORM'];
const BLOCKS = new Set(['UL', 'OL', 'H3', 'P', 'DIV']);
const EMPTY_BLOCK = '<div><br></div>';

/** Conserva solo etiquetas de formato permitidas (nunca atributos) y deja todo dentro de bloques. */
export function cleanNote(html) {
  const source = document.createElement('template');
  source.innerHTML = String(html || '');
  const convert = (node, depth = 0) => {
    if (depth > 35) return document.createTextNode('');
    if (node.nodeType === Node.TEXT_NODE) {
      // Las notas antiguas guardaban los saltos de línea como texto: se convierten en <br>.
      const lines = (node.textContent || '').split('\n');
      if (lines.length === 1) return document.createTextNode(lines[0]);
      const out = document.createDocumentFragment();
      lines.forEach((line, i) => { if (i) out.appendChild(document.createElement('br')); if (line) out.appendChild(document.createTextNode(line)); });
      return out;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || DROPPED.includes(node.tagName)) return document.createTextNode('');
    const out = ALLOWED.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : document.createDocumentFragment();
    for (const child of [...node.childNodes]) out.appendChild(convert(child, depth + 1));
    return out;
  };
  const flat = document.createElement('div');
  for (const child of [...source.content.childNodes]) flat.appendChild(convert(child));
  // Texto suelto en la raíz → un <div> por línea.
  const safe = document.createElement('div');
  let line = null;
  const closeLine = () => { if (line && !line.childNodes.length) line.appendChild(document.createElement('br')); line = null; };
  for (const child of [...flat.childNodes]) {
    if (child.nodeType === Node.ELEMENT_NODE && BLOCKS.has(child.tagName)) { closeLine(); safe.appendChild(child); continue; }
    if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'BR') { if (!line) line = safe.appendChild(document.createElement('div')); closeLine(); continue; }
    if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'LI') { // un <li> sin lista
      closeLine();
      const last = safe.lastElementChild, list = last && last.tagName === 'UL' ? last : safe.appendChild(document.createElement('ul'));
      list.appendChild(child);
      continue;
    }
    if (!line) line = safe.appendChild(document.createElement('div'));
    line.appendChild(child);
  }
  closeLine();
  return safe.innerHTML;
}

const isBlank = html => !String(html).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() && !/<li\b/i.test(html);

const BUTTONS = () => [
  ['bold', '<b>B</b>', tr('Negrita', 'Bold')],
  ['italic', '<i>I</i>', tr('Cursiva', 'Italic')],
  ['title', icon('heading'), tr('Título', 'Heading')],
  ['bullet', icon('listBullet'), tr('Lista con viñetas', 'Bulleted list')],
  ['number', icon('listNumber'), tr('Lista numerada', 'Numbered list')],
];

export function notesEditor(date) {
  const base = `d.${date}.`, rich = get(base + 'nRich', null), text = get(base + 'n', '');
  const content = typeof rich === 'string' ? cleanNote(rich)
    : text ? String(text).split('\n').map(line => `<div>${esc(line) || '<br>'}</div>`).join('') : '';
  const blank = isBlank(content);
  return `<div class="notes"><div class="notes-toolbar" role="toolbar" aria-label="${tr('Formato de notas', 'Note formatting')}">${BUTTONS().map(([action, label, title]) => `<button type="button" data-note-format="${action}" aria-label="${title}" title="${title}" aria-pressed="false">${label}</button>`).join('')}</div>
    <div id="notesEditor" class="notes-editable${blank ? ' is-empty' : ''}" contenteditable="true" role="textbox" aria-label="${tr('Notas del día', 'Notes for the day')}" aria-multiline="true" data-note-date="${date}" data-placeholder="${tr('Escribe tus notas…', 'Write your notes…')}" spellcheck="true">${blank ? '' : content}</div>
    <div class="notes-foot"><button type="button" class="btn small notes-done" data-a="notesdone">${icon('check')}${tr('Guardar', 'Save')}</button></div></div>`;
}

const editorEl = () => $('#notesEditor');
/** El bloque (línea, título o elemento de lista) donde está el cursor. */
function currentBlock(editor) {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !editor.contains(sel.anchorNode)) return null;
  let node = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
  while (node && node !== editor && !['DIV', 'P', 'H3', 'LI'].includes(node.tagName)) node = node.parentElement;
  return node && node !== editor ? node : null;
}
const inEditor = () => { const sel = window.getSelection(), editor = editorEl(); return !!(editor && sel?.rangeCount && editor.contains(sel.anchorNode)); };
function caretTo(node, atEnd = true) {
  const range = document.createRange(), sel = window.getSelection();
  range.selectNodeContents(node);
  range.collapse(!atEnd);
  sel.removeAllRanges();
  sel.addRange(range);
}
/** Un editor vacío parte con una línea en blanco (un bloque), para que nunca haya texto suelto. */
function seed(editor) {
  if (editor.children.length || editor.textContent) return;
  editor.innerHTML = EMPTY_BLOCK;
  caretTo(editor.firstChild, false);
}
/**
 * Ordena lo que deja el navegador tras un cambio de formato: saca las listas y títulos que quedaron
 * dentro de una línea y envuelve en una línea el texto suelto. Conserva la posición del cursor.
 */
function tidy(editor) {
  const sel = window.getSelection();
  const saved = sel?.rangeCount && editor.contains(sel.anchorNode) ? [sel.anchorNode, sel.anchorOffset, sel.focusNode, sel.focusOffset] : null;
  let changed = false;
  for (let i = 0; i < 6; i++) {
    const inner = $$('div > ul, div > ol, div > h3, p > ul, p > ol, p > h3', editor).find(el => el.parentElement !== editor);
    if (!inner) break;
    inner.parentElement.replaceWith(...inner.parentElement.childNodes);
    changed = true;
  }
  let line = null;
  for (const child of [...editor.childNodes]) {
    if (child.nodeType === Node.ELEMENT_NODE && BLOCKS.has(child.tagName)) { line = null; continue; }
    if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'BR' && line) { child.remove(); line = null; continue; }
    if (child.nodeType === Node.TEXT_NODE && !child.textContent.trim() && !line) { child.remove(); continue; }
    if (!line) { line = document.createElement('div'); child.before(line); }
    line.appendChild(child);
    changed = true;
  }
  if (changed && saved) try { sel.setBaseAndExtent(...saved); } catch { /* el cursor queda donde lo dejó el navegador */ }
}
function refresh(editor = editorEl()) {
  if (!editor) return;
  editor.classList.toggle('is-empty', isBlank(editor.innerHTML));
  const block = inEditor() ? currentBlock(editor) : null;
  const list = block?.closest('ul, ol'), state = cmd => { try { return inEditor() && document.queryCommandState(cmd); } catch { return false; } };
  const on = { bold: state('bold'), italic: state('italic'), title: !!block?.closest('h3'), bullet: list?.tagName === 'UL', number: list?.tagName === 'OL' };
  $$('[data-note-format]').forEach(b => b.setAttribute('aria-pressed', String(!!on[b.dataset.noteFormat])));
}
function saveNotes() {
  const editor = editorEl();
  if (!editor) return;
  const key = `d.${editor.dataset.noteDate}.`, blank = isBlank(editor.innerHTML);
  setPath(key + 'nRich', blank ? '' : cleanNote(editor.innerHTML));
  setPath(key + 'n', blank ? '' : (editor.innerText || editor.textContent || '').replace(/\n{3,}/g, '\n\n').trim());
}

const exec = (cmd, value = null) => document.execCommand(cmd, false, value);
function format(action) {
  const editor = editorEl();
  if (!editor) return;
  if (!inEditor()) { editor.focus({ preventScroll: true }); seed(editor); if (!inEditor() || !currentBlock(editor)) caretTo(editor.lastElementChild || editor); }
  const block = currentBlock(editor), list = block?.closest('ul, ol'), heading = block?.closest('h3');
  // Algunos navegadores mandan el cursor al inicio de la línea al crear una lista: se recuerda dónde estaba.
  const sel = window.getSelection();
  let typed = -1; // letras entre el inicio de la línea y el cursor
  if (block && sel.isCollapsed) {
    const before = document.createRange();
    before.selectNodeContents(block);
    before.setEnd(sel.anchorNode, sel.anchorOffset);
    typed = before.toString().length;
  }
  const restoreCaret = () => {
    const now = currentBlock(editor);
    if (typed <= 0 || !now || !sel.isCollapsed) return;
    const walker = document.createTreeWalker(now, NodeFilter.SHOW_TEXT);
    let left = typed;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (left <= node.textContent.length) { sel.collapse(node, left); return; }
      left -= node.textContent.length;
    }
  };
  if (action === 'bold' || action === 'italic') exec(action);
  else if (action === 'title') {
    if (list) exec(list.tagName === 'UL' ? 'insertUnorderedList' : 'insertOrderedList'); // primero sale de la lista
    exec('formatBlock', heading ? 'div' : 'h3');
  } else {
    if (heading) exec('formatBlock', 'div'); // un título no va dentro de una lista
    exec(action === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList');
  }
  tidy(editor);
  if (action !== 'bold' && action !== 'italic') restoreCaret();
  saveNotes();
  refresh(editor);
}

export function initNotes() {
  try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch { /* no disponible */ }
  document.addEventListener('focusin', e => { if (e.target.id === 'notesEditor') { seed(e.target); refresh(e.target); } });
  document.addEventListener('selectionchange', () => { if (editorEl()) refresh(); });
  // «- », «1. » o «# » al inicio de una línea crean una lista o un título.
  document.addEventListener('beforeinput', e => {
    const editor = e.target.closest?.('#notesEditor');
    if (!editor || e.inputType !== 'insertText' || e.data !== ' ') return;
    const sel = window.getSelection(), block = currentBlock(editor);
    if (!block || !sel.isCollapsed) return;
    const before = document.createRange();
    before.selectNodeContents(block);
    before.setEnd(sel.anchorNode, sel.anchorOffset);
    const typed = before.toString();
    const action = /^1[.)]$/.test(typed) ? 'number' : /^[-*•]$/.test(typed) ? 'bullet' : typed === '#' ? 'title' : null;
    if (!action || (action !== 'title' && block.closest('li')) || (action === 'title' && block.closest('h3, li'))) return;
    e.preventDefault();
    before.deleteContents();
    for (const child of [...block.childNodes]) if (child.nodeType === Node.TEXT_NODE && !child.textContent) child.remove();
    if (!block.childNodes.length) block.appendChild(document.createElement('br'));
    caretTo(block, false);
    format(action);
  });
  document.addEventListener('input', e => {
    if (e.target.id !== 'notesEditor') return;
    seed(e.target); // si se borró todo, vuelve a quedar una línea en blanco
    if (!e.isComposing) tidy(e.target);
    saveNotes();
    refresh(e.target);
  });
  document.addEventListener('focusout', e => {
    if (e.target.id !== 'notesEditor') return;
    saveNotes();
    if (isBlank(e.target.innerHTML)) e.target.innerHTML = '';
    refresh(e.target);
  });
  // Pegar siempre como texto, sin el formato de otras páginas.
  document.addEventListener('paste', e => {
    if (!e.target.closest?.('#notesEditor')) return;
    const text = e.clipboardData?.getData('text/plain');
    if (text == null) return;
    e.preventDefault();
    exec('insertText', text);
  });
  // Los botones no le quitan el foco al editor: la selección (y el teclado del celular) se mantiene.
  const keepFocus = e => { if (e.target.closest?.('[data-note-format]')) e.preventDefault(); };
  document.addEventListener('pointerdown', keepFocus);
  document.addEventListener('mousedown', keepFocus);
  document.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-note-format]');
    if (btn) format(btn.dataset.noteFormat);
  });
}
