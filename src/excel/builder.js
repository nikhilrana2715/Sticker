/** Excel mode UI: sheet picker, sticker editor, design options, live preview, create stickers. */
import { $, fmt, escapeHtml, nextFrame } from '../core/dom.js';
import { store } from '../core/store.js';
import { state, hasFile, TSC_MAX_W } from '../core/state.js';
import { status, clearStatus, progress, setStep, updateCounts, reset, invalidateResults } from '../ui/status.js';
import { addPreview } from '../ui/preview.js';
import { parseSheet, sizeFromName, defaultGap } from './parse.js';
import { drawSticker, DESIGN_DEFAULT } from './render.js';

/** sheets: [{ name, stickers, w, h, across, gap }], cur = sheet index, pick = sticker index */
export const xl = { sheets: [], cur: 0, pick: 0 };
// v2 key: new defaults (roll layout) must not be overridden by old saved designs.
const XD_KEY = 'xlDesign2';
const xd = Object.assign({}, DESIGN_DEFAULT, store.get(XD_KEY, {}));

const curSheet = () => xl.sheets[xl.cur];
const curSticker = () => curSheet()?.stickers[xl.pick];
const xlPageW = (s) => s.across * s.w + (s.across - 1) * s.gap;

/** Load the Excel reader only when an Excel file is opened. */
const loadXlsx = () => import('xlsx').then((m) => (m.read ? m : m.default));

export async function loadExcel(file) {
  try {
    status('Reading Excel workbook…');
    let XLSX;
    try {
      XLSX = await loadXlsx();
    } catch (e) {
      console.error(e);
      throw new Error('Lost connection to the app server. Press Ctrl+F5 and upload again.');
    }
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    if (state.selectedExcelFile !== file) return; // user picked another file meanwhile
    xl.sheets = wb.SheetNames.map((name) => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
      const p = parseSheet(rows), sz = sizeFromName(name);
      const saved = store.get('xlSheet:' + name, null);
      return Object.assign(
        { name, stickers: p.stickers, w: sz.w, h: sz.h, across: p.across, gap: defaultGap(p.across, sz.w, TSC_MAX_W) },
        saved || {}
      );
    }).filter((s) => s.stickers.length);
    if (!xl.sheets.length) { status('No stickers found in this Excel file.', 'error'); return; }
    const last = store.get('xlLastSheet', '');
    xl.cur = Math.max(0, xl.sheets.findIndex((s) => s.name === last));
    xl.pick = 0;
    renderSheetList();
    loadSheet();
    $('processBtn').disabled = false;
    status(`Excel loaded: ${xl.sheets.length} format(s).`, 'info');
  } catch (err) {
    console.error(err);
    status('Unable to read Excel: ' + (err?.message || 'Unknown error'), 'error');
  }
}

export function clearExcel() {
  xl.sheets = [];
  xl.cur = 0;
  xl.pick = 0;
}

function saveSheetLayout() {
  const s = curSheet();
  if (s) store.set('xlSheet:' + s.name, { w: s.w, h: s.h, across: s.across, gap: s.gap });
}

function renderSheetList() {
  $('xlSheet').innerHTML = xl.sheets
    .map((s, i) => `<option value="${i}">${escapeHtml(s.name)} · ${s.stickers.length} sticker${s.stickers.length > 1 ? 's' : ''}</option>`)
    .join('');
  $('xlSheet').value = xl.cur;
}

function loadSheet() {
  const s = curSheet();
  if (!s) return;
  $('xlW').value = s.w;
  $('xlH').value = s.h;
  $('xlAcross').value = s.across;
  $('xlGap').value = s.gap;
  xl.pick = Math.min(xl.pick, s.stickers.length - 1);
  renderPickList();
  loadSticker();
  updateXlSize();
}

function renderPickList() {
  const s = curSheet();
  $('xlPick').innerHTML = s.stickers
    .map((st, i) => `<option value="${i}">${i + 1}. ${escapeHtml(st.title || st.rows.find((r) => r.value)?.value || 'Sticker')}${st.copies > 1 ? ` ×${st.copies}` : ''}</option>`)
    .join('');
  $('xlPick').value = xl.pick;
  const total = s.stickers.reduce((a, st) => a + (st.copies || 1), 0);
  $('xlCountInfo').textContent = `${s.stickers.length} sticker${s.stickers.length > 1 ? 's' : ''} · ${total} to print`;
  $('xlDel').disabled = s.stickers.length < 2;
}

function loadSticker() {
  const st = curSticker();
  if (!st) return;
  $('xlTitle').value = st.title;
  $('xlCopies').value = st.copies || 1;
  renderRows();
  drawLive();
}

function renderRows() {
  const st = curSticker(), box = $('xlRows');
  box.innerHTML = '';
  st.rows.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'xl-row' + (r.show ? '' : ' off');
    row.innerHTML = `<input type="checkbox" ${r.show ? 'checked' : ''} aria-label="Show row ${i + 1}"><input type="text" aria-label="Label ${i + 1}" placeholder="Label"><input type="text" aria-label="Value ${i + 1}" placeholder="Value (empty = note line)"><button type="button" title="Remove row" aria-label="Remove row ${i + 1}">×</button>`;
    const [chk, lab, val] = row.querySelectorAll('input');
    lab.value = r.label;
    val.value = r.value;
    chk.addEventListener('change', () => { r.show = chk.checked; row.classList.toggle('off', !r.show); xlChanged(); });
    lab.addEventListener('input', () => { r.label = lab.value; xlChanged(); });
    val.addEventListener('input', () => { r.value = val.value; xlChanged(); });
    row.querySelector('button').addEventListener('click', () => { st.rows.splice(i, 1); renderRows(); xlChanged(); });
    box.append(row);
  });
}

function xlChanged(listToo) {
  if (listToo) renderPickList();
  drawLive();
  invalidateResults();
}

/** Show the Excel sticker size / roll width everywhere. */
export function updateXlSize() {
  const s = curSheet();
  if (!s) return;
  const t = `${fmt(s.w)} × ${fmt(s.h)}`, pw = xlPageW(s);
  $('outputSize').innerHTML = `${t} <em>mm</em>`;
  $('sizePill').textContent = t + ' mm';
  $('xlInfo').textContent = `roll row ${fmt(pw)} × ${fmt(s.h)} mm`;
  $('xlLiveSize').textContent = t + ' mm';
  document.querySelectorAll('.szW').forEach((e) => (e.textContent = fmt(pw)));
  document.querySelectorAll('.szH').forEach((e) => (e.textContent = fmt(s.h)));
  const warn = $('xlWarn');
  warn.textContent = pw > TSC_MAX_W
    ? `Roll row is ${fmt(pw)} mm wide: above TSC TE310 max print width (${TSC_MAX_W} mm). Reduce stickers across or gap.`
    : '';
  warn.classList.toggle('show', pw > TSC_MAX_W);
}

function drawLive() {
  const s = curSheet(), st = curSticker();
  if (!s || !st) return;
  const src = drawSticker(st, s.w, s.h, xd, 300), cv = $('xlCanvas');
  cv.width = src.width;
  cv.height = src.height;
  cv.getContext('2d').drawImage(src, 0, 0);
  const sc = Math.min(300 / src.width, 200 / src.height);
  cv.style.width = Math.round(src.width * sc) + 'px';
  cv.style.height = Math.round(src.height * sc) + 'px';
  src.width = src.height = 1;
}

export async function processExcel() {
  const s = curSheet();
  if (!s || state.busy) return;
  state.busy = true;
  $('processBtn').disabled = true;
  reset();
  clearStatus();
  progress(0);
  try {
    const jobs = [];
    s.stickers.forEach((st, i) => { for (let c = 0; c < (st.copies || 1); c++) jobs.push([st, i, c]); });
    if (!jobs.length) throw new Error('No stickers to create.');
    for (let j = 0; j < jobs.length; j++) {
      const [st, i, c] = jobs[j];
      const cv = drawSticker(st, s.w, s.h, xd, 300);
      const label = {
        url: cv.toDataURL('image/png'),
        sourcePage: s.name,
        sourceCell: `${i + 1}${st.copies > 1 ? ' · copy ' + (c + 1) : ''}`,
        on: true,
        fixedW: s.w, fixedH: s.h, across: s.across, gap: s.gap
      };
      cv.width = cv.height = 1;
      state.labels.push(label);
      addPreview(label, state.labels.length - 1);
      if (j % 20 === 19) { progress(((j + 1) / jobs.length) * 100); await nextFrame(); }
    }
    progress(100);
    const n = state.labels.length;
    $('pageCount').textContent = Math.ceil(n / s.across); // roll rows = printed pages
    $('stickerCount').textContent = n;
    $('emptyState').classList.add('hidden');
    $('previewSubtitle').textContent = `${n} stickers · ${fmt(s.w)} × ${fmt(s.h)} mm · ${s.across} across`;
    state.origPages = 0;
    setStep(3);
    updateCounts();
    status(`Done: ${n} sticker(s) from sheet “${s.name}”. Print gives ${s.across} across per roll row (${fmt(xlPageW(s))} × ${fmt(s.h)} mm).`, 'success');
  } catch (err) {
    console.error(err);
    status('Unable to create Excel stickers: ' + (err?.message || 'Unknown error'), 'error');
  } finally {
    state.busy = false;
    $('processBtn').disabled = !hasFile();
    updateCounts();
  }
}

/**
 * "Create stickers" in Excel mode: ask how many pieces of each sticker, then build.
 * The answer sets copies for every sticker in the sheet and is remembered per sheet.
 */
export function askPiecesAndCreate() {
  const s = curSheet();
  if (!s || state.busy) return;
  const dlg = $('piecesDlg'), input = $('piecesInput');
  const types = s.stickers.length;
  const calc = () => {
    const n = Math.max(1, Math.min(999, Math.round(+input.value) || 1));
    const total = n * types, rows = Math.ceil(total / s.across);
    $('piecesCalc').textContent = `${total} sticker${total > 1 ? 's' : ''} → ${rows} row${rows > 1 ? 's' : ''} (${s.across} across)`;
  };
  $('piecesSub').textContent = `${s.name} · ${fmt(s.w)} × ${fmt(s.h)} mm${types > 1 ? ` · ${types} stickers, pieces each` : ''}`;
  input.value = store.get('xlPieces:' + s.name, curSticker()?.copies || 1);
  input.oninput = calc;
  calc();
  $('piecesCancel').onclick = () => dlg.close('cancel');
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok') return; // Cancel button or Esc
    const n = Math.max(1, Math.min(999, Math.round(+input.value) || 1));
    store.set('xlPieces:' + s.name, n);
    s.stickers.forEach((st) => (st.copies = n));
    $('xlCopies').value = n;
    renderPickList();
    processExcel();
  };
  dlg.returnValue = '';
  dlg.showModal();
  input.select();
}

export function initExcelBuilder() {
  $('xlSheet').addEventListener('change', (e) => {
    xl.cur = +e.target.value;
    xl.pick = 0;
    store.set('xlLastSheet', curSheet().name);
    loadSheet();
    invalidateResults();
  });
  $('xlPick').addEventListener('change', (e) => { xl.pick = +e.target.value; loadSticker(); });
  $('xlTitle').addEventListener('input', (e) => { curSticker().title = e.target.value; xlChanged(true); });
  $('xlCopies').addEventListener('input', (e) => {
    curSticker().copies = Math.max(1, Math.min(999, Math.round(+e.target.value) || 1));
    xlChanged(true);
  });
  $('xlAllCopies').addEventListener('change', (e) => {
    if (!+e.target.value) return;
    const n = Math.max(1, Math.min(999, Math.round(+e.target.value)));
    curSheet().stickers.forEach((st) => (st.copies = n));
    $('xlCopies').value = n;
    e.target.value = '';
    xlChanged(true);
  });
  $('xlAddRow').addEventListener('click', () => {
    curSticker().rows.push({ label: '', value: '', show: true });
    renderRows();
    xlChanged();
    $('xlRows').lastElementChild?.querySelector('input[type=text]')?.focus();
  });
  $('xlDup').addEventListener('click', () => {
    const s = curSheet(), copy = structuredClone(curSticker());
    s.stickers.splice(xl.pick + 1, 0, copy);
    xl.pick++;
    renderSheetList();
    renderPickList();
    loadSticker();
    invalidateResults();
  });
  $('xlDel').addEventListener('click', () => {
    const s = curSheet();
    if (s.stickers.length < 2) return;
    s.stickers.splice(xl.pick, 1);
    xl.pick = Math.max(0, xl.pick - 1);
    renderSheetList();
    renderPickList();
    loadSticker();
    invalidateResults();
  });
  [['xlW', 'w'], ['xlH', 'h']].forEach(([id, key]) =>
    $(id).addEventListener('input', (e) => {
      const v = +e.target.value;
      if (!(v >= 10 && v <= 300)) return;
      curSheet()[key] = v;
      saveSheetLayout();
      updateXlSize();
      drawLive();
      invalidateResults();
    })
  );
  $('xlAcross').addEventListener('change', (e) => { curSheet().across = +e.target.value; saveSheetLayout(); updateXlSize(); invalidateResults(); });
  $('xlGap').addEventListener('change', (e) => { curSheet().gap = +e.target.value; saveSheetLayout(); updateXlSize(); invalidateResults(); });

  const XD_IDS = { xdLayout: 'layout', xdBorder: 'border', xdAlign: 'align', xdWeight: 'weight', xdSep: 'sep', xdSplit: 'split', xdScale: 'scale', xdPad: 'pad', xdTitleScale: 'titleScale' };
  Object.entries(XD_IDS).forEach(([id, key]) => {
    $(id).value = xd[key];
    $(id).addEventListener('change', (e) => { xd[key] = e.target.value; store.set(XD_KEY, xd); drawLive(); invalidateResults(); });
  });
  $('xdLine').checked = !!xd.line;
  $('xdLine').addEventListener('change', (e) => { xd.line = e.target.checked; store.set(XD_KEY, xd); drawLive(); invalidateResults(); });
}
