/** Status line, progress bar, step indicator and result counters. */
import { $ } from '../core/dom.js';
import { state, hasFile, selected } from '../core/state.js';

export function status(msg, type = 'info') {
  const el = $('status');
  el.textContent = msg;
  el.className = 'status show ' + (type === 'success' ? 'good' : type === 'error' ? 'bad' : 'info');
}

export function clearStatus() {
  $('status').className = 'status';
  $('status').textContent = '';
}

export function progress(v) {
  $('progress').classList.add('show');
  $('progressBar').style.width = Math.max(0, Math.min(100, v)) + '%';
}

export function hideProgress() {
  $('progress').classList.remove('show');
}

/** Step indicator (optional in markup: elements #st1–#st3). */
export function setStep(n) {
  ['st1', 'st2', 'st3'].forEach((id, i) => {
    const el = $(id);
    if (!el) return;
    el.classList.toggle('done', i + 1 < n);
    el.classList.toggle('active', i + 1 === n);
  });
}

export function revokePdf() {
  if (state.pdfBlobUrl) {
    URL.revokeObjectURL(state.pdfBlobUrl);
    state.pdfBlobUrl = null;
  }
  state.pdfBlob = null;
}

export function updateCounts() {
  const { labels, busy, origPages } = state;
  const n = selected().length;
  $('selCount').textContent = labels.length ? n : '—';
  $('printBtn').disabled = !n || busy;
  $('downloadBtn').disabled = !n || busy;
  $('selAll').disabled = !labels.length;
  $('selNone').disabled = !labels.length;
  // Excel stickers print N across per page (roll row); PDF prints one per page.
  const pg = labels[0]?.fixedW ? Math.ceil(n / (labels[0].across || 1)) : n;
  $('expectPages').textContent = labels.length
    ? `${pg} page${pg === 1 ? '' : 's'}${origPages ? ` (not ${origPages})` : ''}`
    : 'one page per sticker';
  revokePdf();
}

export function reset() {
  state.labels = [];
  revokePdf();
  $('previewGrid').innerHTML = '';
  $('emptyState').classList.remove('hidden');
  $('stickerCount').textContent = '—';
  $('previewSubtitle').textContent = 'Click a card to include or exclude it.';
  updateCounts();
}

/** Any setting changed after labels were built: drop them so stale labels can't be printed. */
export function invalidateResults() {
  if (!state.labels.length || state.busy) return;
  const btn = $('processTxt').textContent;
  reset();
  setStep(hasFile() ? 2 : 1);
  $('previewSubtitle').textContent = `Settings changed. Click ${btn} again.`;
  status(`Settings changed. Click “${btn}” again.`, 'info');
}
