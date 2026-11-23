/**
 * Excel → sticker objects. Pure functions (no DOM), unit-tested in tests/parse.test.js.
 *
 * Each sheet is one sticker format. Typical sheet:
 *   A1: title            (e.g. "6303 C3")
 *   A3: "CONTENT: -"     B3: "BEARING"
 *   A4: "QUANTITY: -"    B4: "1"
 *   …the same block repeated to the right = stickers across the roll.
 *
 * Sticker shape: { title, rows: [{ label, value, show }], copies }
 */

export function normCell(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[.:]/g, '');
}

export function excelCell(rows, r, c) {
  if (r < 0 || c < 0 || !rows[r]) return '';
  return String(rows[r][c] ?? '').replace(/\s+/g, ' ').trim();
}

const LABEL_WORDS = [
  'sr no', 'srno', 's no', 'material code', 'material description', 'material desc', 'qty', 'quantity', 'content',
  'batch no', 'batch', 'packed on', 'packed by', 'packed qty', 'date', 'customer part no', 'part no', 'part number',
  'bearing type', 'name of operator', 'operator', 'weight', 'item code', 'grade', 'mrp', 'max retail price', 'size', 'type', 'model'
];

/** "BATCH NO: -  " → "BATCH NO" */
export const cleanLabel = (s) => String(s || '').replace(/\s+/g, ' ').replace(/[\s:\-–]+$/, '').trim();

/** A label cell ends with ":" / ":-" or is a known field name. */
export function isLabelText(s) {
  if (!s || !/[a-z]/i.test(s)) return false;
  if (/:\s*-?\s*$/.test(s)) return true;
  const n = normCell(cleanLabel(s)).replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  return LABEL_WORDS.some((w) => n === w);
}

const junk = (s) => !s || /^[.\s]*$/.test(s);
const sig = (st) => JSON.stringify([st.title, st.rows.map((r) => [r.label, r.value])]);

function uniq(list) {
  const seen = new Set();
  return list.filter((s) => {
    const k = sig(s);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Sheet name "45X32" → { w: 45, h: 32 } mm. Falls back to 45 × 32. */
export function sizeFromName(name) {
  const m = String(name).match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (m) {
    const w = +m[1], h = +m[2];
    if (w >= 10 && h >= 10 && w <= 300 && h <= 300) return { w, h };
  }
  return { w: 45, h: 32 };
}

/**
 * Parse one sheet (2-D array of cell strings) into stickers.
 * Returns { stickers, across } where across = copies repeated side by side.
 */
export function parseSheet(rows) {
  const R = rows.length, C = Math.max(0, ...rows.map((r) => (r || []).length));
  const cell = (r, c) => excelCell(rows, r, c);

  // 1) Label/value layout: columns that hold ≥2 label cells.
  const labelCols = [];
  for (let c = 0; c < C; c++) {
    let n = 0;
    for (let r = 0; r < R; r++) if (isLabelText(cell(r, c))) n++;
    if (n >= 2) labelCols.push(c);
  }
  if (labelCols.length) {
    const out = [];
    labelCols.forEach((lc, i) => {
      const end = i + 1 < labelCols.length ? labelCols[i + 1] : C;
      const labelRows = [];
      for (let r = 0; r < R; r++) if (isLabelText(cell(r, lc))) labelRows.push(r);
      const r0 = labelRows[0];
      let r1 = r0, empty = 0;
      for (let r = r0; r < R && empty < 2; r++) {
        if (cell(r, lc)) { r1 = r; empty = 0; } else empty++;
      }
      let title = '';
      for (let r = r0 - 1; r >= Math.max(0, r0 - 4) && !title; r--)
        for (let c = lc; c < end && !title; c++) {
          const v = cell(r, c);
          if (!junk(v) && !isLabelText(v)) title = v;
        }
      const valueCols = [];
      for (let c = lc + 1; c < end; c++) if (labelRows.some((r) => !junk(cell(r, c)))) valueCols.push(c);
      if (!valueCols.length) valueCols.push(lc + 1);
      valueCols.forEach((vc) => {
        const st = { title, rows: [], copies: 1 };
        for (let r = r0; r <= r1; r++) {
          const lab = cell(r, lc), val = junk(cell(r, vc)) ? '' : cell(r, vc);
          if (!lab && !val) continue;
          st.rows.push({ label: isLabelText(lab) ? cleanLabel(lab) : lab, value: val, show: true });
        }
        if (st.rows.length) out.push(st);
      });
    });
    return { stickers: uniq(out), across: Math.min(4, Math.max(1, labelCols.length)) };
  }

  // 2) Table layout: header row + data rows → one sticker per data row.
  for (let r = 0; r < R; r++) {
    const head = [];
    for (let c = 0; c < C; c++) { const v = cell(r, c); if (v) head.push([c, v]); }
    if (!head.length) continue;
    const distinct = new Set(head.map((h) => h[1])).size === head.length;
    const data = [];
    for (let k = r + 1; k < R; k++) if (head.filter(([c]) => cell(k, c)).length >= 2) data.push(k);
    if (head.length >= 2 && distinct && data.length >= 2) {
      const stickers = data.map((k) => ({
        title: '', copies: 1,
        rows: head.map(([c, v]) => ({ label: cleanLabel(v), value: cell(k, c), show: true }))
      }));
      return { stickers, across: 1 };
    }
    break;
  }

  // 3) Plain lines: each filled column = one sticker, lines top → bottom.
  const out = [];
  let cols = 0;
  for (let c = 0; c < C; c++) {
    const lines = [];
    for (let r = 0; r < R; r++) { const v = cell(r, c); if (!junk(v)) lines.push(v); }
    if (!lines.length) continue;
    cols++;
    out.push({ title: lines[0], rows: lines.slice(1).map((l) => ({ label: l, value: '', show: true })), copies: 1 });
  }
  return { stickers: uniq(out), across: Math.min(4, Math.max(1, cols)) };
}

/** Widest gap (2 → 1 → 0 mm) that keeps the roll row within maxW. */
export function defaultGap(across, w, maxW) {
  return [2, 1, 0].find((g) => across * w + (across - 1) * g <= maxW) ?? 2;
}
