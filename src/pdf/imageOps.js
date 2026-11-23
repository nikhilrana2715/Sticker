/** Pixel operations for the PDF flow: find stickers, clean ink, fit to label. */

/** Split the page into a cols × rows grid and find the ink bounding box in each cell. */
export function detectCellBounds(canvas, cols, rows, threshold, dpi) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const W = canvas.width, H = canvas.height, data = ctx.getImageData(0, 0, W, H).data;
  const cells = Array.from({ length: cols * rows }, () => ({ minX: W, minY: H, maxX: -1, maxY: -1, count: 0 }));
  const cellW = W / cols, cellH = H / rows;
  for (let y = 0; y < H; y++) {
    const row = Math.min(rows - 1, Math.floor(y / cellH));
    let i = y * W * 4;
    for (let x = 0; x < W; x++, i += 4) {
      if (Math.min(data[i], data[i + 1], data[i + 2]) < threshold) {
        const c = cells[row * cols + Math.min(cols - 1, Math.floor(x / cellW))];
        if (x < c.minX) c.minX = x;
        if (x > c.maxX) c.maxX = x;
        if (y < c.minY) c.minY = y;
        if (y > c.maxY) c.maxY = y;
        c.count++;
      }
    }
  }
  const k = dpi / 300, minCount = 500 * k * k, minW = 140 * k, minH = 100 * k;
  return cells.map((c, idx) => {
    const w = c.maxX - c.minX + 1, h = c.maxY - c.minY + 1;
    if (c.count < minCount || w < minW || h < minH) return null;
    return {
      x: c.minX, y: c.minY, width: w, height: h,
      cell: { x: (idx % cols) * cellW, y: Math.floor(idx / cols) * cellH, width: cellW, height: cellH }
    };
  });
}

/** Min-filter (3×3) on the darkest channel: thickens all ink (for scanned PDFs). */
export function thickenInk(ctx, W, H) {
  const img = ctx.getImageData(0, 0, W, H), d = img.data, n = W * H;
  const L = new Uint8ClampedArray(n), T = new Uint8ClampedArray(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) L[p] = Math.min(d[i], d[i + 1], d[i + 2]);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      let m = L[o + x];
      if (x > 0 && L[o + x - 1] < m) m = L[o + x - 1];
      if (x < W - 1 && L[o + x + 1] < m) m = L[o + x + 1];
      T[o + x] = m;
    }
  }
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      let m = T[o + x];
      if (y > 0 && T[o + x - W] < m) m = T[o + x - W];
      if (y < H - 1 && T[o + x + W] < m) m = T[o + x + W];
      L[o + x] = m;
    }
  }
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const m = L[p];
    if (d[i] > m) d[i] = m;
    if (d[i + 1] > m) d[i + 1] = m;
    if (d[i + 2] > m) d[i + 2] = m;
  }
  ctx.putImageData(img, 0, 0);
}

/** Grey text → pure black (crisper thermal prints). */
export function deepBlack(ctx, W, H) {
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum < 165) {
      d[i] = d[i + 1] = d[i + 2] = 0;
    } else if (lum < 215) {
      const v = Math.round(((lum - 165) / 50) * 255);
      d[i] = d[i + 1] = d[i + 2] = Math.min(v, d[i], d[i + 1], d[i + 2]);
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function chooseRotate(sw, sh, outW, outH, mode) {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  const s0 = Math.min(outW / sw, outH / sh), s1 = Math.min(outW / sh, outH / sw);
  return s1 > s0 * 1.02;
}

/** Crop one sticker from the page and scale it onto a label-size canvas. */
export function createLabelCanvas(source, rect, o) {
  const sx = Math.max(0, Math.floor(rect.x - o.paddingPx)), sy = Math.max(0, Math.floor(rect.y - o.paddingPx));
  const ex = Math.min(source.width, Math.ceil(rect.x + rect.width + o.paddingPx));
  const ey = Math.min(source.height, Math.ceil(rect.y + rect.height + o.paddingPx));
  const sw = Math.max(1, ex - sx), sh = Math.max(1, ey - sy);
  const crop = document.createElement('canvas');
  crop.width = sw;
  crop.height = sh;
  const cctx = crop.getContext('2d', { willReadFrequently: true });
  cctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  if (o.thicken) thickenInk(cctx, sw, sh);
  if (o.deepBlack) deepBlack(cctx, sw, sh);

  const out = document.createElement('canvas');
  out.width = o.outW;
  out.height = o.outH;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, o.outW, o.outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const rotate = chooseRotate(sw, sh, o.outW - 2 * o.marginPx, o.outH - 2 * o.marginPx, o.orient);
  const oW = rotate ? sh : sw, oH = rotate ? sw : sh;
  const scale = Math.min((o.outW - 2 * o.marginPx) / oW, (o.outH - 2 * o.marginPx) / oH);
  const dW = sw * scale, dH = sh * scale;
  ctx.save();
  ctx.translate(o.outW / 2, o.outH / 2);
  if (rotate) ctx.rotate(Math.PI / 2);
  ctx.drawImage(crop, -dW / 2, -dH / 2, dW, dH);
  ctx.restore();
  crop.width = crop.height = 1;
  return out;
}
