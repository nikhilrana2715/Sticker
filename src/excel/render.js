/** Draw one Excel sticker onto a canvas (300 dpi by default). */

/**
 * Default = "roll" layout, measured from the real MRS 45 × 32 mm kit sticker
 * printed on the TSC TE310 roll (die-cut rounded label, so no printed border).
 */
export const DESIGN_DEFAULT = {
  layout: 'roll', border: 'none', align: 'left', weight: '700', sep: '', split: 'auto',
  scale: '1', pad: '1.2', titleScale: '1.2', line: false
};

const FONT_STACK = 'Calibri, Carlito, "Segoe UI", Arial, Helvetica, sans-serif';

/**
 * Roll layout as fractions of sticker width (W) / height (H).
 * Measured on 45 × 32 mm: title left 4.9 mm, centre 6.3 mm from top; rows left 2.9 mm,
 * values from 26.6 mm (59 %); row centres 14.6 → 25.3 mm, 3.55 mm apart; row text ≈ 2.5 mm.
 */
export const ROLL = {
  titleX: 4.9 / 45, titleY: 6.3 / 32, titleSize: 3.0 / 32,
  rowX: 2.9 / 45, valueX: 26.6 / 45,
  lastRowY: 25.3 / 32, rowStep: 3.55 / 32, rowsTopMin: 12.2 / 32, rowSize: 2.5 / 32,
  rightPad: 1.6 / 45
};

function drawRoll(ctx, st, W, H, d) {
  const font = (px) => `${d.weight} ${Math.max(6, Math.round(px))}px ${FONT_STACK}`;
  const sc = +d.scale, tsc = +d.titleScale / 1.2;
  const rows = st.rows.filter((r) => r.show && (String(r.label).trim() || String(r.value).trim()));
  const title = String(st.title || '').trim();
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'middle';

  // Title
  if (title) {
    const tx = d.align === 'left' ? W * ROLL.titleX : W / 2;
    let ts = H * ROLL.titleSize * sc * tsc;
    ctx.font = font(ts);
    const maxW = W - W * ROLL.titleX - W * ROLL.rightPad;
    while (ts > 8 && ctx.measureText(title).width > maxW) { ts--; ctx.font = font(ts); }
    ctx.textAlign = d.align === 'left' ? 'left' : 'center';
    ctx.fillText(title, tx, H * ROLL.titleY, maxW);
    if (d.line) {
      const ly = H * (ROLL.titleY + ROLL.titleSize * 0.75);
      ctx.fillRect(W * ROLL.rowX, ly, W - W * ROLL.rowX - W * ROLL.rightPad, Math.max(2, H * 0.006));
    }
  }

  // Rows: anchored to the bottom like the original; more rows → tighter spacing.
  const n = rows.length;
  if (!n) return;
  const step = n > 1 ? Math.min(H * ROLL.rowStep, (H * (ROLL.lastRowY - ROLL.rowsTopMin)) / (n - 1)) : 0;
  const first = H * ROLL.lastRowY - step * (n - 1);
  const size = Math.min(H * ROLL.rowSize * sc, (step || H * ROLL.rowStep) * 0.82);
  const lx = W * ROLL.rowX;
  const vx = d.split === 'auto' ? W * ROLL.valueX : lx + (W - lx - W * ROLL.rightPad) * (+d.split / 100);
  const labelW = vx - lx - H * 0.02, valueW = W - vx - W * ROLL.rightPad;
  ctx.font = font(size);
  rows.forEach((r, i) => {
    const y = first + step * i;
    const lab = String(r.label).trim(), val = String(r.value).trim();
    if (!val) {
      ctx.textAlign = 'center';
      ctx.fillText(lab, W / 2, y, W - 2 * lx);
      return;
    }
    ctx.textAlign = 'left';
    // maxWidth condenses long text (e.g. "Material Description") instead of overlapping the value.
    if (lab) ctx.fillText(lab + d.sep, lx, y, labelW);
    ctx.fillText(val, lab ? vx : lx, y, lab ? valueW : W - 2 * lx);
  });
}

export function drawSticker(st, wMm, hMm, d, dpi = 300) {
  const k = dpi / 25.4, W = Math.round(wMm * k), H = Math.round(hMm * k);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // Border
  const bw = Math.max(3, Math.round(0.3 * k));
  if (d.border !== 'none') {
    const r = d.border === 'round' ? Math.min(2.2 * k, W / 6, H / 6) : 0, o = bw / 2;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = bw;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(o, o, W - bw, H - bw, r);
    else ctx.rect(o, o, W - bw, H - bw);
    ctx.stroke();
  }

  if (d.layout !== 'fill') {
    drawRoll(ctx, st, W, H, d);
    return cv;
  }

  const pad = +d.pad * k + (d.border !== 'none' ? bw : 0);
  const x0 = pad, y0 = pad, iw = W - 2 * pad, ih = H - 2 * pad;
  const rows = st.rows.filter((r) => r.show && (String(r.label).trim() || String(r.value).trim()));
  const title = String(st.title || '').trim();
  const tUnits = title ? 1.15 * +d.titleScale : 0;
  const lineH = ih / Math.max(1, tUnits + rows.length);
  const font = (px) => `${d.weight} ${px}px ${FONT_STACK}`;
  const fit = (text, maxW, start) => {
    let s = Math.max(6, Math.floor(start));
    ctx.font = font(s);
    while (s > 6 && ctx.measureText(text).width > maxW) { s--; ctx.font = font(s); }
    return s;
  };
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'middle';

  // Title
  let y = y0;
  if (title) {
    const th = lineH * tUnits, ts = fit(title, iw, Math.min(th * 0.78, lineH * 0.66 * +d.scale * +d.titleScale));
    ctx.font = font(ts);
    ctx.textAlign = d.align === 'left' ? 'left' : 'center';
    ctx.fillText(title, d.align === 'left' ? x0 : x0 + iw / 2, y + th / 2, iw);
    y += th;
    if (d.line) ctx.fillRect(x0, Math.round(y - bw * 0.6), iw, Math.max(2, Math.round(bw * 0.6)));
  }

  // Rows: label column + value column
  const gapPx = 0.8 * k, base = lineH * 0.62 * +d.scale;
  const labText = (r) => (String(r.label).trim() ? String(r.label).trim() + (String(r.value).trim() ? d.sep : '') : '');
  const pairs = rows.filter((r) => String(r.value).trim() && labText(r));
  let splitX, labFs = base;
  if (d.split === 'auto') {
    // Label column as wide as the longest label; shrink all text together if label + value don't fit.
    ctx.font = font(base);
    const mL = Math.max(0, ...pairs.map((r) => ctx.measureText(labText(r)).width));
    const mV = Math.max(0, ...pairs.map((r) => ctx.measureText(String(r.value).trim()).width));
    if (mL + gapPx + mV > iw) labFs = Math.max(6, Math.floor((base * iw) / (mL + gapPx + mV)));
    splitX = x0 + (mL * labFs) / base + gapPx;
  } else {
    splitX = x0 + iw * (+d.split / 100);
    pairs.forEach((r) => { labFs = Math.min(labFs, fit(labText(r), splitX - x0 - gapPx, base)); });
    labFs = Math.max(labFs, base * 0.55);
  }
  const labW = splitX - x0 - gapPx, valW = x0 + iw - splitX;

  rows.forEach((r) => {
    const cy = y + lineH / 2, lab = labText(r), val = String(r.value).trim();
    ctx.textAlign = 'left';
    if (!val) {
      // Note line, full width, centered
      const fs = fit(lab, iw, labFs * 0.95);
      ctx.font = font(fs);
      ctx.textAlign = 'center';
      ctx.fillText(lab, x0 + iw / 2, cy, iw);
    } else if (!lab) {
      const fs = fit(val, iw, labFs);
      ctx.font = font(fs);
      ctx.fillText(val, x0, cy, iw);
    } else {
      ctx.font = font(labFs);
      ctx.fillText(lab, x0, cy, labW);
      const fs = fit(val, valW, labFs);
      ctx.font = font(fs);
      ctx.fillText(val, splitX, cy, valW);
    }
    y += lineH;
  });
  return cv;
}
