/** Small DOM + formatting helpers shared by every module. */

export const $ = (id) => document.getElementById(id);

/** Format a number with at most 1 decimal ("100", "45.5"). */
export function fmt(n) {
  return Number.isFinite(n) ? (+n.toFixed(1)).toString() : '?';
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Yield to the browser so the UI can repaint during long loops. */
export const nextFrame = () => new Promise((r) => setTimeout(r, 0));
