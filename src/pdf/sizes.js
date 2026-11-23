/** PDF mode: output label size picker (presets + custom). */
import { $, fmt } from '../core/dom.js';
import { store } from '../core/store.js';
import { TSC_MAX_W } from '../core/state.js';
import { invalidateResults } from '../ui/status.js';

export const SIZES = [
  { g: 'shipping', w: 100, h: 150, n: 'Standard shipping' },
  { g: 'shipping', w: 102, h: 152, n: '4 × 6 in' },
  { g: 'shipping', w: 100, h: 100, n: 'Square' },
  { g: 'shipping', w: 102, h: 102, n: '4 × 4 in' },
  { g: 'shipping', w: 100, h: 75, n: 'Landscape' },
  { g: 'shipping', w: 102, h: 76, n: '4 × 3 in' },
  { g: 'shipping', w: 100, h: 50, n: 'Strip' },
  { g: 'shipping', w: 102, h: 51, n: '4 × 2 in' },
  { g: 'shipping', w: 100, h: 200, n: 'Long' },
  { g: 'shipping', w: 100, h: 120, n: 'Courier' },
  { g: 'shipping', w: 105, h: 148, n: 'A6' },
  { g: 'medium', w: 75, h: 100, n: 'Portrait' },
  { g: 'medium', w: 80, h: 50, n: 'Product' },
  { g: 'medium', w: 76, h: 51, n: '3 × 2 in' },
  { g: 'medium', w: 75, h: 50, n: 'Carton' },
  { g: 'medium', w: 74, h: 105, n: 'A7' },
  { g: 'medium', w: 70, h: 40, n: 'Bin label' },
  { g: 'small', w: 60, h: 40, n: 'Part label' },
  { g: 'small', w: 58, h: 40, n: 'Receipt' },
  { g: 'small', w: 50, h: 50, n: 'Square S' },
  { g: 'small', w: 50, h: 30, n: 'Barcode' },
  { g: 'small', w: 50, h: 25, n: 'Barcode S' },
  { g: 'small', w: 40, h: 30, n: 'Tag' },
  { g: 'small', w: 38, h: 25, n: 'Mini' },
  { g: 'small', w: 25, h: 15, n: 'Micro' }
];
const TABS = [['all', 'All'], ['shipping', 'Shipping 4"'], ['medium', 'Medium'], ['small', 'Small']];
let activeTab = 'all';

export function curSize() {
  return { w: Number($('labelWidth').value), h: Number($('labelHeight').value) };
}

function renderTabs() {
  $('sizeTabs').innerHTML = '';
  TABS.forEach(([k, l]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = l;
    if (k === activeTab) b.className = 'on';
    b.onclick = () => { activeTab = k; renderTabs(); renderSizes(); };
    $('sizeTabs').append(b);
  });
  $('sizeCount').textContent = SIZES.length + ' presets + custom';
}

function renderSizes() {
  const grid = $('sizeGrid');
  grid.innerHTML = '';
  const maxDim = 30;
  SIZES.filter((s) => activeTab === 'all' || s.g === activeTab).forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.w = s.w;
    b.dataset.h = s.h;
    b.title = `${s.w} × ${s.h} mm · ${s.n}`;
    const k = maxDim / Math.max(s.w, s.h);
    b.innerHTML = `<span class="box"><div style="width:${Math.max(6, s.w * k)}px;height:${Math.max(6, s.h * k)}px"></div></span><b>${s.w} × ${s.h}</b><small>${s.n}</small>`;
    b.onclick = () => setSize(s.w, s.h);
    grid.append(b);
  });
  markChips();
}

function markChips() {
  const { w, h } = curSize();
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', +c.dataset.w === w && +c.dataset.h === h));
}

function setSize(w, h) {
  $('labelWidth').value = w;
  $('labelHeight').value = h;
  syncSize();
}

/** Push the PDF label size into every place that shows it. */
export function syncSize() {
  const { w, h } = curSize(), t = `${fmt(w)} × ${fmt(h)}`;
  $('outputSize').innerHTML = `${t} <em>mm</em>`;
  $('sizePill').textContent = t + ' mm';
  document.querySelectorAll('.szW').forEach((e) => (e.textContent = fmt(w)));
  document.querySelectorAll('.szH').forEach((e) => (e.textContent = fmt(h)));
  $('widthWarn').classList.toggle('show', w > TSC_MAX_W);
  markChips();
  if (w > 0 && h > 0) store.set('size', { w, h });
  invalidateResults();
}

export function initSizes() {
  const saved = store.get('size', { w: 100, h: 150 });
  $('labelWidth').value = saved.w;
  $('labelHeight').value = saved.h;
  $('labelWidth').addEventListener('input', syncSize);
  $('labelHeight').addEventListener('input', syncSize);
  $('swapBtn').addEventListener('click', () => { const { w, h } = curSize(); setSize(h, w); });
  renderTabs();
  renderSizes();
  syncSize();
}
