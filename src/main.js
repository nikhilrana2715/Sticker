/**
 * MRS Sticker Print Studio — entry point.
 *
 * PDF mode  (src/pdf):   split a multi-sticker packing-slip PDF into one sticker per label page.
 * Excel mode (src/excel): build stickers from an Excel workbook and print them across the roll.
 * Shared:   src/core (state, storage, DOM helpers), src/ui (status, upload, preview), src/output (print / PDF).
 */
import './styles/main.css';
import './pdf/boldText.js';
import { $ } from './core/dom.js';
import { state } from './core/state.js';
import { initTheme } from './ui/theme.js';
import { initUpload } from './ui/upload.js';
import { initPreview } from './ui/preview.js';
import { initSizes } from './pdf/sizes.js';
import { initPdfSettings } from './pdf/settings.js';
import { processPdf } from './pdf/processPdf.js';
import { initExcelBuilder, askPiecesAndCreate } from './excel/builder.js';
import { initOutput } from './output/output.js';

initTheme();
initPdfSettings();
initSizes();
initExcelBuilder();
initUpload();
initPreview();
initOutput();

$('processBtn').addEventListener('click', () => (state.selectedExcelFile ? askPiecesAndCreate() : processPdf()));

// A lazy chunk failed to load (server restarted / new deploy): reload to get fresh files.
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); location.reload(); });

// Warm the heavy libraries in the background after first paint, so an upload later
// doesn't depend on the server still being reachable (and starts instantly).
const warm = () => Promise.allSettled([import('xlsx'), import('jspdf'), import('pdfjs-dist')]);
if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 });
else setTimeout(warm, 1500);
