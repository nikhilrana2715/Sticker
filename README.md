# MRS Sticker Print Studio

**Live:** https://mrs-sticker.vercel.app

A browser app for printing stickers on a TSC thermal roll printer (TE310, 4-inch head).

- **PDF mode:** upload a packing-slip PDF that has several stickers on each A4 page. The app finds each sticker, makes the text bold, scales it to the label size (default 100 × 150 mm) and outputs one sticker per page.
- **Excel mode:** upload a workbook where each sheet is one sticker format (a sheet named `45X32` gives a 45 × 32 mm sticker). Edit the title and rows, set copies and design, then print several stickers across the roll.

Everything runs in the browser. Files are never uploaded to a server.

## Tech

- [Vite](https://vite.dev) with vanilla JavaScript (ES modules), no UI framework
- [pdf.js](https://mozilla.github.io/pdf.js/) `pdfjs-dist@3.11.174` renders the PDF
- [jsPDF](https://github.com/parallax/jsPDF) `2.5.1` builds the output PDF
- [SheetJS](https://sheetjs.com) `xlsx@0.20.3` reads Excel (installed from the SheetJS CDN, as SheetJS recommends)
- [Vitest](https://vitest.dev) for unit tests

pdf.js, jsPDF and SheetJS are loaded on demand, so the first page load stays small.

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm test         # unit tests (Excel parser)
npm run build    # production build in dist/
npm run preview  # serve the production build locally
```

## Project structure

```
index.html              page markup (entry point for Vite)
public/                 static files copied as-is (favicon)
src/
  main.js               entry: wires all modules together
  styles/main.css       all styles (light + dark theme tokens)
  core/                 shared state, localStorage wrapper, DOM helpers
  ui/                   theme toggle, upload box + mode switch, status bar, preview grid
  pdf/                  PDF mode: label sizes, settings, bold text, pixel ops, processing
  excel/                Excel mode: parser (pure), sticker renderer, builder UI
  output/               print window and PDF download (both modes)
tests/                  Vitest unit tests
samples/                local test files (git-ignored: company data)
```

## Excel sheet format

Each sheet is one sticker format:

| A | B |
|---|---|
| `6303 C3` (title) | |
| | |
| `CONTENT: -` | `BEARING` |
| `QUANTITY: -` | `1` |
| `BATCH NO: -` | `ZE11` |
| `MAX. RETAIL PRICE ₹:` | `297/-` |
| `(INCLUSIVE OF ALL TAXES)` | |

- The sheet name sets the size: `45X32` → 45 × 32 mm. Names without a size fall back to 45 × 32 mm, which you can change in the app.
- A block repeated to the right (columns C–D, E–F …) sets how many stickers print across the roll.
- A simple table (header row plus data rows) also works: each data row becomes one sticker.

## Deploy on Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel detects Vite automatically (`vercel.json` also sets `npm run build` and the `dist` output). Click **Deploy**.

No environment variables are needed.

## Printing tips (TSC TE310)

The browser cannot change the printer driver's paper size, so add the same TSC printer twice in Windows:

| Use | Printer | Paper size |
|---|---|---|
| PDF mode | `TSC TE310` | 100 × 150 mm |
| Excel 45 × 32 roll (2 across) | `TSC TE310 - 45x32` | 92 × 32 mm |

- Media type **Gap / Die-cut**.
- In the print dialog: Margins **None**, Scale **100**, "Fit to page" off.
- Raise **Darkness** to 10–12 for darker text.

## License

[Apache-2.0](LICENSE)
