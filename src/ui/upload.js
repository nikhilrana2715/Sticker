/**
 * Upload box (click → PDF / Excel menu, or drag & drop) and the PDF ↔ Excel mode switch.
 * PDF mode keeps the original 100 × 150 flow untouched; Excel mode shows the builder.
 */
import { $ } from '../core/dom.js';
import { state } from '../core/state.js';
import { status, clearStatus, setStep, reset, hideProgress } from './status.js';
import { syncSize } from '../pdf/sizes.js';
import { loadExcel, updateXlSize, clearExcel } from '../excel/builder.js';

const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isExcel = (f) => /\.(xlsx|xls)$/i.test(f.name);
const pickDropped = (files) => [...(files || [])].find((x) => isPdf(x) || isExcel(x));

function setMode(m) {
  document.body.classList.toggle('mode-excel', m === 'excel');
  $('processTxt').textContent = m === 'excel' ? 'Create stickers' : 'Separate stickers';
  if (m === 'excel') updateXlSize();
  else { clearExcel(); syncSize(); }
}

function selectFile(file) {
  if (!file) return;
  const excel = isExcel(file);
  if (!excel && !isPdf(file)) { status('Please select a PDF or Excel (.xlsx / .xls) file.', 'error'); return; }
  state.selectedFile = excel ? null : file;
  state.selectedExcelFile = excel ? file : null;
  $('fileName').textContent = file.name;
  $('fileBox').classList.add('show');
  $('pageCount').textContent = '—';
  state.origPages = 0;
  // Excel: enabled by loadExcel() once the workbook is parsed.
  $('processBtn').disabled = excel;
  reset();
  clearStatus();
  hideProgress();
  setStep(2);
  setMode(excel ? 'excel' : 'pdf');
  if (excel) loadExcel(file);
}

function clearFile(e) {
  e.preventDefault();
  state.selectedFile = null;
  state.selectedExcelFile = null;
  $('fileBox').classList.remove('show');
  $('processBtn').disabled = true;
  $('pageCount').textContent = '—';
  state.origPages = 0;
  reset();
  clearStatus();
  hideProgress();
  setStep(1);
  setMode('pdf');
}

export function initUpload() {
  const dropzone = $('dropzone'), pdfInput = $('pdfFile'), excelInput = $('excelFile'), upMenu = $('uploadMenu');

  const toggleUpMenu = (show) => {
    const open = show ?? upMenu.classList.contains('hidden');
    upMenu.classList.toggle('hidden', !open);
    dropzone.setAttribute('aria-expanded', open);
  };
  dropzone.addEventListener('click', () => toggleUpMenu());
  dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleUpMenu(); } });
  $('pickPdf').addEventListener('click', () => { toggleUpMenu(false); pdfInput.click(); });
  $('pickExcel').addEventListener('click', () => { toggleUpMenu(false); excelInput.click(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#dropzone,#uploadMenu')) toggleUpMenu(false); });

  pdfInput.addEventListener('change', (e) => { selectFile(e.target.files[0]); pdfInput.value = ''; });
  excelInput.addEventListener('change', (e) => { selectFile(e.target.files[0]); excelInput.value = ''; });
  $('clearFile').addEventListener('click', clearFile);

  ['dragenter', 'dragover'].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); }));
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    const f = pickDropped(e.dataTransfer.files);
    f ? selectFile(f) : status('Drop a PDF or Excel file here.', 'error');
  });
  // Allow dropping anywhere on the page.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    if (e.target.closest && e.target.closest('#dropzone')) return;
    e.preventDefault();
    const f = pickDropped(e.dataTransfer?.files);
    if (f) selectFile(f);
  });
}
