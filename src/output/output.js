/** Print window + PDF download for both modes. */
import { $, fmt } from '../core/dom.js';
import { state, selected } from '../core/state.js';
import { status } from '../ui/status.js';
import { curSize } from '../pdf/sizes.js';

/** Roll layout for Excel stickers (null for the PDF flow). */
export function excelRoll(list) {
  const f = list[0];
  if (!f || !f.fixedW) return null;
  const n = f.across || 1, gap = f.gap || 0;
  return { n, gap, sw: f.fixedW, h: f.fixedH, pw: n * f.fixedW + (n - 1) * gap };
}

/** Load jsPDF only when a PDF is downloaded. */
const loadJsPdf = () => import('jspdf').then((m) => m.jsPDF || m.default?.jsPDF || m.default);

async function createPdfBlob() {
  const list = selected();
  if (!list.length) return null;
  if (state.pdfBlob) return state.pdfBlob;
  const jsPDF = await loadJsPdf();
  const xr = excelRoll(list);
  let doc;
  if (xr) {
    // Excel stickers: N across the roll with a gap, one roll row per PDF page.
    const { pw, h, sw, n, gap } = xr, orient = pw > h ? 'landscape' : 'portrait';
    doc = new jsPDF({ orientation: orient, unit: 'mm', format: [pw, h], compress: true });
    doc.setProperties({ title: 'MRS Excel Roll Stickers', subject: `${n} × ${sw} × ${h} mm across · ${gap} mm gap`, creator: 'MRS Sticker Print Studio' });
    for (let i = 0; i < list.length; i += n) {
      if (i > 0) doc.addPage([pw, h], orient);
      for (let k = 0; k < n && list[i + k]; k++) doc.addImage(list[i + k].url, 'PNG', k * (sw + gap), 0, sw, h, `lbl${i + k}`, 'FAST');
    }
  } else {
    // PDF flow: one sticker per page at the chosen label size.
    const { w, h } = curSize(), orient = w > h ? 'landscape' : 'portrait';
    doc = new jsPDF({ orientation: orient, unit: 'mm', format: [w, h], compress: true });
    doc.setProperties({ title: 'MRS Stickers', subject: `${w} x ${h} mm labels`, creator: 'MRS Sticker Print Studio' });
    list.forEach((l, i) => {
      if (i > 0) doc.addPage([w, h], orient);
      doc.addImage(l.url, 'PNG', 0, 0, w, h, `lbl${i}`, 'FAST');
    });
  }
  state.pdfBlob = doc.output('blob');
  state.pdfBlobUrl = URL.createObjectURL(state.pdfBlob);
  return state.pdfBlob;
}

async function downloadPdf() {
  try {
    if (!(await createPdfBlob())) return;
    const list = selected(), xr = excelRoll(list);
    const { w, h } = xr ? { w: xr.sw, h: xr.h } : curSize();
    const pages = xr ? Math.ceil(list.length / xr.n) : list.length;
    const base = (xr
      ? (state.selectedExcelFile?.name || 'excel-stickers') + '_' + (list[0].sourcePage || '')
      : state.selectedFile?.name || 'packing-slip'
    ).replace(/\.(pdf|xlsx|xls)/i, '').replace(/[^a-z0-9_-]+/gi, '_');
    const a = document.createElement('a');
    a.href = state.pdfBlobUrl;
    a.download = `${base}_${xr && xr.n > 1 ? xr.n + 'UP_' : ''}${fmt(w)}x${fmt(h)}mm_${list.length}_stickers.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    status(xr
      ? `Downloaded ${pages} roll row(s): ${xr.n} across, each ${fmt(w)} × ${fmt(h)} mm, ${xr.gap} mm gap.`
      : `Downloaded a ${pages}-page PDF with one sticker per page.`, 'success');
  } catch (e) {
    console.error(e);
    status('PDF creation failed: ' + (e?.message || 'Unknown error'), 'error');
  }
}

function printLabels() {
  const list = selected();
  if (!list.length) { status('Process a file and select at least one sticker first.', 'error'); return; }
  const xr = excelRoll(list);
  const w = xr ? xr.pw : curSize().w;
  const h = xr ? xr.h : curSize().h;
  // Must open synchronously inside the click, or pop-up blockers stop it.
  const win = window.open('', '_blank');
  if (!win) { status('The print window was blocked. Allow pop-ups for this page, then click Print again.', 'error'); return; }

  let pages;
  if (xr) {
    const rowsHtml = [];
    for (let i = 0; i < list.length; i += xr.n) {
      let cells = '';
      for (let k = 0; k < xr.n; k++) cells += list[i + k] ? `<img src="${list[i + k].url}" alt="Sticker ${i + k + 1}">` : '<div class="blank"></div>';
      rowsHtml.push(`<section class="p two">${cells}</section>`);
    }
    pages = rowsHtml.join('');
  } else {
    pages = list.map((l, i) => `<section class="p"><img src="${l.url}" alt="Sticker ${i + 1}"></section>`).join('');
  }

  win.document.open();
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>MRS Labels · ${list.length} stickers · ${fmt(w)}×${fmt(h)} mm</title>
<style>
@page{size:${w}mm ${h}mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
.p{width:${w}mm;height:${h}mm;overflow:hidden;break-after:page;page-break-after:always}
.p:last-child{break-after:auto;page-break-after:auto}
.p.two{display:flex;gap:${xr ? xr.gap : 0}mm}
.p.two img,.p.two .blank{display:block;flex:0 0 ${xr ? xr.sw : w}mm;width:${xr ? xr.sw : w}mm;height:${h}mm;object-fit:fill}
.p:not(.two) img{width:${w}mm;height:${h}mm}
@media screen{body{background:#e8edf2;padding:12px 0}.p{margin:12px auto;box-shadow:0 1px 8px #7b8794;background:#fff}}
</style></head><body>${pages}</body></html>`);
  win.document.close();
  const go = async () => {
    try { await Promise.all([...win.document.images].map((im) => im.decode().catch(() => {}))); } catch { /* ignore */ }
    win.focus();
    setTimeout(() => win.print(), 250);
  };
  if (win.document.readyState === 'complete') go();
  else win.addEventListener('load', go);
  status(xr
    ? `Choose printer “TSC TE310 - ${fmt(xr.sw)}x${fmt(xr.h)}” (paper ${fmt(xr.pw)} × ${fmt(xr.h)} mm), Margins None, Scale 100.`
    : `Print window opened with ${list.length} page(s) at ${w} × ${h} mm.`, 'success');
}

export function initOutput() {
  $('downloadBtn').addEventListener('click', downloadPdf);
  $('printBtn').addEventListener('click', printLabels);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && selected().length) {
      e.preventDefault();
      printLabels();
    }
  });
}
