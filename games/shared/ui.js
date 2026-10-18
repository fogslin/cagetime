// Tiny DOM helpers shared by the sim games.
import { flag } from './data.js';
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function avatar(f, size = 44, extra = '') {
  const c = f.col || ['#e5132b', '#f6c343'];
  const ini = ((f.first || '?')[0] + (f.last || '?')[0]).toUpperCase();
  return `<span class="av ${extra}" style="--a:${c[0]};--b:${c[1]};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px" aria-hidden="true">${esc(ini)}</span>`;
}
export const fl = (cc) => `<span class="fl" title="${esc(cc)}">${flag(cc)}</span>`;
export function tip(text) { return `<button type="button" class="tip" aria-label="Info: ${esc(text)}" data-tip="${esc(text)}">?</button>`; }
export function toast(msg, kind = '') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  while (box.children.length >= 3) box.firstChild.remove();
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.innerHTML = msg; box.appendChild(t);
  setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
}
export function modal(html, { onClose, wide } = {}) {
  closeModal();
  const m = document.createElement('div'); m.className = 'gx-modal'; m.id = 'gx-modal';
  m.innerHTML = `<div class="gx-modal-in ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><button type="button" class="gx-x" aria-label="Close">×</button>${html}</div>`;
  document.body.appendChild(m);
  const close = () => { closeModal(); onClose && onClose(); };
  m.querySelector('.gx-x').onclick = close;
  m.addEventListener('click', (e) => { if (e.target === m) close(); });
  const first = m.querySelector('button:not(.gx-x), [tabindex]'); if (first) first.focus();
  return m.querySelector('.gx-modal-in');
}
export function closeModal() { const m = $('#gx-modal'); if (m) m.remove(); }
// tap-to-show tooltips on touch screens
export function initTips() {
  const place = (e) => { const t = e.target.closest && e.target.closest('.tip'); if (!t) return; const r = t.getBoundingClientRect(), W = window.innerWidth; t.classList.toggle('tl', r.left < 130); t.classList.toggle('tr', W - r.right < 130 && r.left >= 130); };
  document.addEventListener('mouseover', place); document.addEventListener('focusin', place); document.addEventListener('touchstart', place, { passive: true });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.tip');
    $$('.tip.on').forEach(x => { if (x !== t) x.classList.remove('on'); });
    if (t) { t.classList.toggle('on'); e.preventDefault(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $$('.tip.on').forEach(x => x.classList.remove('on')); const m = $('#gx-modal'); if (m) m.querySelector('.gx-x').click(); } });
}
export function bar(v, max = 100, cls = '') { return `<span class="gx-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v / max * 100))}%"></i></span>`; }
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Could not save: browser storage is full. Delete an old save slot.', 'bad'); return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { } },
};
