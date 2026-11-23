/** PDF mode: text weight control + settings that invalidate built labels. */
import { store } from '../core/store.js';
import { $ } from '../core/dom.js';
import { invalidateResults } from '../ui/status.js';

let weight = store.get('weight', 2);
export const getWeight = () => weight;

function renderWeight() {
  document.querySelectorAll('#weightSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === weight));
}

export function initPdfSettings() {
  document.querySelectorAll('#weightSeg button').forEach((b) =>
    b.addEventListener('click', () => {
      weight = +b.dataset.v;
      store.set('weight', weight);
      renderWeight();
      invalidateResults();
    })
  );
  ['columns', 'rows', 'orient', 'threshold', 'padding', 'margin', 'dpi', 'cropMode', 'deepBlack', 'thicken']
    .forEach((id) => $(id).addEventListener('change', invalidateResults));
  renderWeight();
}
