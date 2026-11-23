# CLAUDE.md — MRS Sticker Print Studio

Read this first every session. Keep it updated when project changes.

## 1. Communication / Working Style
- User talks Hinglish (Hindi + English). Reply in same style, short and direct.
- Caveman mode (`/caveman`) preferred: terse, no filler, full technical accuracy. Off only on "stop caveman" / "normal mode".
- Code, commits, file content: write normal (not caveman).
- Act when enough info. Don't re-ask decided things. Give recommendation, not long option lists.
- Confirm before destructive / hard-to-reverse / external actions (delete, overwrite, publish, send, push, deploy).
- Report results honestly: failures with real output, skipped steps said clearly.

## 2. Project Overview
- Folder: `d:\Nikhil\Sticker`. Not a git repo yet. Goal: push to GitHub, deploy on Vercel.
- Vite + vanilla JS (ES modules) app. Restructured from single-file HTML on 2026-11-23; old file kept in `legacy/MRS Sticker Print Studio.html` (reference only, not built).
- Purpose: PDF mode = split multi-sticker packing-slip PDF → one sticker per label page. Excel mode = build stickers from Excel → print N across roll. Printer: TSC TE310, max width `TSC_MAX_W = 105.7` mm.
- Sample data: `samples/STICKER FORMATES 3-.xlsx` (26 sheets, git-ignored: company data). Labels have messy variants ("Qty:-", "BATCH NO: -   ") — parser normalizes.

## 3. Tech Stack / Commands
- Vite 8 (dev/build), Vitest 5 (tests). Node ≥ 20 (local: Node 26).
- Runtime deps (exact versions, lazy-loaded via dynamic `import()`):
  - `pdfjs-dist@3.11.174` — worker via `pdfjs-dist/build/pdf.worker.min.js?url`. `getDocument({ isEvalSupported:false })` (CVE-2024-4367 mitigation).
  - `jspdf@2.5.1` — output PDF. Known audit issues (ReDoS/DoS in html/addImage with untrusted input); we only add our own PNG data URLs. Upgrade to v4 = future TODO.
  - `xlsx@0.20.3` from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (official SheetJS source; npm registry copy is outdated).
- Commands: `npm run dev` (localhost:5173), `npm test`, `npm run build` (→ `dist/`), `npm run preview` (localhost:4173).
- Deploy: `vercel.json` (framework vite, build `npm run build`, output `dist`, immutable cache for `/assets/*`).

## 4. App Workflow
**CORE REQUIREMENT (user, 2026-11-23):** PDF 100 × 150 flow must NOT change. Excel = separate mode where user builds own sticker format and prints.

- Upload: single box `#dropzone`; click → menu `#uploadMenu` → "Upload PDF" (`#pickPdf` → `#pdfFile`) / "Upload Excel" (`#pickExcel` → `#excelFile`). Drag-drop auto-detects. One file at a time (`state.selectedFile` or `state.selectedExcelFile`).
- Mode: `body.mode-excel` → `.pdf-only` sections hidden, `.xl-only` shown. `#processTxt` = "Separate stickers" / "Create stickers". `#processBtn` → `processExcel()` or `processPdf()` (wired in `main.js`).

### PDF mode (unchanged behaviour)
- Settings: columns/rows grid, crop mode, detection threshold, label size (presets + custom), text weight, rotation, DPI, padding, margin, deep black, thicken.
- Changing any setting → `invalidateResults()` → must re-run.
- Output: one sticker per page at `curSize()`.

### Excel mode (sticker builder)
- Each sheet = one format. Sheet name `45X32` → 45 × 32 mm (`sizeFromName`; <10 mm or no match → 45×32).
- `parseSheet(rows)` strategies: (1) label/value — columns with ≥2 label cells (`isLabelText`: ends `:`/`:-` or in `LABEL_WORDS`), value cols to the right, title above; label column count = across; (2) table — distinct header + ≥2 data rows → sticker per row; (3) plain lines per column. Duplicates removed.
- UI: Sticker format (`#xlSheet`, `#xlW/#xlH`, `#xlAcross` 1–4, `#xlGap`, `#xlWarn`); Edit sticker (`#xlPick`, +Copy, Delete, `#xlTitle`, rows `#xlRows` [✓, label, value, ×], `#xlCopies`, `#xlAllCopies`); Design (`xd*` selects + `#xdLine`) + live canvas `#xlCanvas`.
- Empty value = full-width centered note line.
- **Create flow:** "Create stickers" → dialog `#piecesDlg` "How many pieces?" (per sticker; remembered `mrsps:xlPieces:<sheet>`) → sets copies for all stickers → `processExcel()`. Only the Create button (value `ok`) builds; Cancel/Esc do nothing.
- **Default layout `roll`** (`ROLL` in `excel/render.js`), measured from user's real 45×32 MRS kit sticker photo (2-across TSC TE310 roll): no printed border (die-cut label), title left 4.9 mm / centre 6.3 mm, rows left 2.9 mm, values at 59 % width, rows bottom-anchored (last 25.3 mm, step 3.55 mm), row text ≈ 2.5 mm, Calibri bold, no ":" after labels. All fractions of W/H so other sizes scale. Long labels condensed via `fillText` maxWidth. Alternate layout `fill` = older auto-fill design. Design saved under `mrsps:xlDesign2`.
- Storage: design `mrsps:xlDesign`; per sheet `mrsps:xlSheet:<name>` {w,h,across,gap}; `mrsps:xlLastSheet`. `defaultGap` picks 2/1/0 mm to keep roll row ≤ 105.7 mm.
- Output: `excelRoll(list)` → page = roll row `across*w + (across-1)*gap` × h.

## 5. Code Map (`src/`)
- `main.js` — imports CSS, inits modules, wires `#processBtn`.
- `core/dom.js` (`$`, `fmt`, `escapeHtml`, `nextFrame`), `core/store.js` (localStorage `mrsps:` prefix, try/catch), `core/state.js` (`state`, `TSC_MAX_W`, `hasFile`, `selected`).
- `ui/status.js` (`status`, `clearStatus`, `progress`, `hideProgress`, `setStep`, `revokePdf`, `updateCounts`, `reset`, `invalidateResults`), `ui/theme.js`, `ui/upload.js` (`selectFile`, `setMode`, menu, drag-drop), `ui/preview.js` (`addPreview`, select all/none, lightbox).
- `pdf/sizes.js` (`SIZES`, `curSize`, `syncSize`, `initSizes`), `pdf/settings.js` (weight, invalidating listeners), `pdf/boldText.js` (patches `fillText`, `setBoldPx`), `pdf/imageOps.js` (`detectCellBounds`, `thickenInk`, `deepBlack`, `chooseRotate`, `createLabelCanvas`), `pdf/processPdf.js`.
- `excel/parse.js` (pure: `normCell`, `excelCell`, `cleanLabel`, `isLabelText`, `sizeFromName`, `parseSheet`, `defaultGap`), `excel/render.js` (`drawSticker`, `DESIGN_DEFAULT`), `excel/builder.js` (`xl`, `loadExcel`, editor UI, `updateXlSize`, `processExcel`, `initExcelBuilder`).
- `output/output.js` (`excelRoll`, PDF download, print window, Ctrl+P).
- Markup: `index.html` (inline theme script before paint). Styles: `src/styles/main.css`.
- Tests: `tests/parse.test.js` (Excel parser).

## 6. Label Size Presets (mm)
- Shipping: 100×150 (default), 102×152, 100×100, 102×102, 100×75, 102×76, 100×50, 102×51, 100×200, 100×120, 105×148 (A6).
- Medium: 75×100, 80×50, 76×51, 75×50, 74×105 (A7), 70×40.
- Small: 60×40, 58×40, 50×50, 50×30, 50×25, 40×30, 38×25, 25×15.
- Excel: from sheet name (sample: 34X28, 41X30, 45X32, 50X35, 58X39, 66X43, 74X47, 33X17), editable.

## 7. Design / Styling Rules
- CSS tokens on `:root`; themes via `:root[data-theme=light|dark]`. Use tokens, never hardcode UI colors.
- Brand: red logo gradient `#e62b35 → #b5161f`, primary blue `#2457e6`.
- Font: Inter / Segoe UI / system-ui. Radius 14px / 9px.
- Must work in light + dark mode and at phone width.

## 7a. Printing setup (learned 2026-11-23)
- Browser can't change the TSC driver paper size. Driver set to 100×150 (PDF flow) + Excel 92×32 page → Chrome rotates/shrinks it onto 100×150 → sideways text every ~4 labels (user photo).
- Fix: add the same TSC TE310 twice in Windows. `TSC TE310` = 100×150 (PDF). `TSC TE310 - 45x32` = stock 92 × 32 mm (2 × 45 + 2 mm gap), Gap/Die-cut media. Excel print status tells user which printer to choose.

## 7b. UI Copy
- User wants minimal text (2026-11-23): no intro/marketing paragraphs, no long hints or tips. Short labels only; help only in the collapsed "Printer settings" accordion.
- Removed: hero heading + intro paragraph, step pills (`setStep` is a no-op if `#st1–3` missing), upload/layout hints, "Important" + "Tips" accordions.

## 8. Coding Rules
- Keep module boundaries: pure logic (parse/render/imageOps) separate from DOM wiring. New pure logic → add Vitest test.
- Don't touch PDF-mode behaviour (`src/pdf/*`, PDF branch of `output.js`) unless user asks.
- Heavy libs only via dynamic `import()`. Any new lazily imported npm lib must be added to `optimizeDeps.include` in `vite.config.js`, else dev server returns 504 "Outdated Optimize Dep".
- localStorage only through `store`.
- After changes: `npm test` + `npm run build`; for UI changes run both modes in a browser (headless Chrome virtual-time mode stalls on the PDF.js worker — use real-time puppeteer from scratchpad).
- Never commit `samples/` data, `.env`, `node_modules/`, `dist/`.
- Don't commit/push/deploy unless asked.

## 9. Privacy
- User's personal details (name, email) never sent to external services without explicit permission.
- Sample Excel = company data → git-ignored.

## 10. Open Notes / TODO
- Upgrade jspdf 2.5.1 → 4.x (major) and pdfjs-dist 3 → current (major); retest PDF output after.
- `git init` + first commit + GitHub repo + Vercel project when user asks.
