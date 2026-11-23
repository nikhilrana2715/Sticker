/**
 * Bold text for PDF rendering: PDF.js draws glyphs with fillText, so we patch
 * fillText to also stroke each glyph when a bold width is active. Barcodes and
 * lines are drawn as paths, so they are not affected.
 */
let boldPx = 0;
export const setBoldPx = (px) => { boldPx = px; };

(function patchFillText() {
  const P = CanvasRenderingContext2D.prototype, orig = P.fillText;
  P.fillText = function (t, x, y, mw) {
    const hasMw = arguments.length > 3 && mw !== undefined;
    hasMw ? orig.call(this, t, x, y, mw) : orig.call(this, t, x, y);
    if (boldPx > 0) {
      this.save();
      const m = this.getTransform();
      const s = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
      this.lineWidth = boldPx / s;
      this.lineJoin = 'round';
      this.lineCap = 'round';
      this.strokeStyle = this.fillStyle;
      hasMw ? this.strokeText(t, x, y, mw) : this.strokeText(t, x, y);
      this.restore();
    }
  };
})();
