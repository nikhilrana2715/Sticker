/** Light / dark toggle. Initial theme is set by the inline script in index.html. */
import { $ } from '../core/dom.js';
import { store } from '../core/store.js';

export function initTheme() {
  const root = document.documentElement;
  $('themeBtn').addEventListener('click', () => {
    const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = t;
    store.set('theme', t);
  });
}
