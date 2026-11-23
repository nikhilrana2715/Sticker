/** Preview grid (click to include/exclude) and the zoom lightbox. */
import { $ } from '../core/dom.js';
import { state } from '../core/state.js';
import { updateCounts } from './status.js';

const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ZOOM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4M11 8.5v5M8.5 11h5"/></svg>';
let lbIndex = -1;

const sourceText = (l) => `${l.fixedW ? 'Sheet' : 'Page'} ${l.sourcePage}`;

export function addPreview(label, index) {
  const card = document.createElement('div');
  card.className = 'card on';
  card.tabIndex = 0;
  card.setAttribute('role', 'checkbox');
  card.setAttribute('aria-checked', 'true');
  card.innerHTML = `<span class="tick">${TICK}</span><button class="zoom" type="button" title="Enlarge" aria-label="Enlarge sticker ${index + 1}">${ZOOM}</button><div class="imgbox"><img alt="Sticker ${index + 1}"></div><div class="meta"><b>#${index + 1}</b><span></span></div>`;
  card.querySelector('.meta span').textContent = `${sourceText(label)} · ${label.fixedW ? 'sticker' : 'cell'} ${label.sourceCell}`;
  card.querySelector('img').src = label.url;
  const toggle = () => {
    label.on = !label.on;
    card.classList.toggle('on', label.on);
    card.setAttribute('aria-checked', label.on);
    updateCounts();
  };
  card.addEventListener('click', (e) => { if (e.target.closest('.zoom')) return; toggle(); });
  card.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
  card.querySelector('.zoom').addEventListener('click', (e) => { e.stopPropagation(); openLb(index); });
  label.card = card;
  $('previewGrid').append(card);
}

function setAll(v) {
  state.labels.forEach((l) => {
    l.on = v;
    l.card.classList.toggle('on', v);
    l.card.setAttribute('aria-checked', v);
  });
  updateCounts();
}

function openLb(i) {
  const l = state.labels[i];
  if (!l) return;
  lbIndex = i;
  $('lbImg').src = l.url;
  $('lbTitle').textContent = `Sticker #${i + 1} of ${state.labels.length} · ${sourceText(l)}`;
  $('lightbox').classList.add('show');
  $('lightbox').setAttribute('aria-hidden', 'false');
}

export function closeLb() {
  $('lightbox').classList.remove('show');
  $('lightbox').setAttribute('aria-hidden', 'true');
  lbIndex = -1;
}

export const isLbOpen = () => $('lightbox').classList.contains('show');

export function initPreview() {
  $('selAll').addEventListener('click', () => setAll(true));
  $('selNone').addEventListener('click', () => setAll(false));
  const n = () => state.labels.length;
  $('lbClose').onclick = closeLb;
  $('lbPrev').onclick = () => openLb((lbIndex - 1 + n()) % n());
  $('lbNext').onclick = () => openLb((lbIndex + 1) % n());
  $('lightbox').addEventListener('click', (e) => { if (e.target === $('lightbox')) closeLb(); });
  document.addEventListener('keydown', (e) => {
    if (!isLbOpen()) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowRight') $('lbNext').click();
    if (e.key === 'ArrowLeft') $('lbPrev').click();
  });
}
