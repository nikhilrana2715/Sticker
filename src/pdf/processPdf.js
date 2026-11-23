/** PDF mode: render each page, find stickers in the grid, make one label per sticker. */
import { $, fmt, nextFrame } from '../core/dom.js';
import { state, hasFile } from '../core/state.js';
import { status, clearStatus, progress, setStep, updateCounts, reset } from '../ui/status.js';
import { addPreview } from '../ui/preview.js';
import { curSize } from './sizes.js';
import { getWeight } from './settings.js';
import { setBoldPx } from './boldText.js';
import { detectCellBounds, createLabelCanvas } from './imageOps.js';

let pdfjsPromise = null;
/** Load PDF.js only when a PDF is processed (keeps first load small). */
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.js?url')
    ]).then(([lib, worker]) => {
      const pdfjsLib = lib.default?.getDocument ? lib.default : lib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjsLib;
    });
  }
  return pdfjsPromise;
}

export async function processPdf() {
  if (!state.selectedFile || state.busy) return;
  const cols = +$('columns').value, rows = +$('rows').value, threshold = +$('threshold').value;
  const { w: pageW, h: pageH } = curSize();
  if (!Number.isFinite(pageW) || !Number.isFinite(pageH) || pageW < 15 || pageW > 300 || pageH < 15 || pageH > 500) {
    status('Enter a valid label size: width 15–300 mm, height 15–500 mm.', 'error');
    return;
  }
  const dpi = +$('dpi').value, renderScale = dpi / 72, pxPerMm = dpi / 25.4;
  const opts = {
    outW: Math.round(pageW * pxPerMm), outH: Math.round(pageH * pxPerMm),
    paddingPx: Math.round(+$('padding').value * pxPerMm), marginPx: Math.round(+$('margin').value * pxPerMm),
    orient: $('orient').value, thicken: $('thicken').checked, deepBlack: $('deepBlack').checked
  };
  const smart = $('cropMode').value === 'smart';

  state.busy = true;
  $('processBtn').disabled = true;
  reset();
  clearStatus();
  $('previewSubtitle').textContent = 'Detecting each sticker…';
  try {
    status('Opening PDF…');
    progress(0);
    let pdfjsLib;
    try {
      pdfjsLib = await loadPdfjs();
    } catch {
      throw new Error('Lost connection to the app server. Press Ctrl+F5 and upload again.');
    }
    // isEvalSupported:false blocks CVE-2024-4367 (malicious font JS) in pdfjs-dist 3.x; rendering output is unchanged.
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await state.selectedFile.arrayBuffer()), isEvalSupported: false }).promise;
    state.origPages = pdf.numPages;
    $('pageCount').textContent = pdf.numPages;
    for (let p = 1; p <= pdf.numPages; p++) {
      status(`Scanning page ${p} of ${pdf.numPages}…`);
      progress(((p - 1) / pdf.numPages) * 100);
      const page = await pdf.getPage(p), viewport = page.getViewport({ scale: renderScale });
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(viewport.width);
      cv.height = Math.ceil(viewport.height);
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.fillStyle = '#fff';
      cx.fillRect(0, 0, cv.width, cv.height);
      setBoldPx((getWeight() * dpi) / 300);
      try {
        await page.render({ canvasContext: cx, viewport }).promise;
      } finally {
        setBoldPx(0);
      }
      const bounds = detectCellBounds(cv, cols, rows, threshold, dpi);
      for (let c = 0; c < bounds.length; c++) {
        const b = bounds[c];
        if (!b) continue;
        const lc = createLabelCanvas(cv, smart ? b : b.cell, smart ? opts : { ...opts, paddingPx: 0 });
        const label = { url: lc.toDataURL('image/png'), sourcePage: p, sourceCell: c + 1, on: true };
        lc.width = lc.height = 1;
        state.labels.push(label);
        addPreview(label, state.labels.length - 1);
        $('emptyState').classList.add('hidden');
        $('stickerCount').textContent = state.labels.length;
      }
      cv.width = cv.height = 1;
      page.cleanup();
      progress((p / pdf.numPages) * 100);
      await nextFrame();
    }
    await pdf.destroy();
    const n = state.labels.length;
    $('stickerCount').textContent = n;
    $('emptyState').classList.toggle('hidden', n > 0);
    if (n) {
      $('previewSubtitle').textContent = `${n} labels · ${fmt(pageW)} × ${fmt(pageH)} mm`;
      status(`Done: ${n} stickers from ${state.origPages} page${state.origPages > 1 ? 's' : ''}. Click Print; the dialog should show ${n} pages.`, 'success');
      setStep(3);
    } else {
      $('previewSubtitle').textContent = 'No sticker detected. Check columns/rows, or try Crop mode → Full grid cell.';
      status('No stickers detected. Check the grid settings or switch Detection to Sensitive.', 'error');
    }
  } catch (err) {
    console.error(err);
    status('Unable to process PDF: ' + (err?.message || 'Unknown error'), 'error');
  } finally {
    setBoldPx(0);
    state.busy = false;
    $('processBtn').disabled = !hasFile();
    updateCounts();
  }
}
