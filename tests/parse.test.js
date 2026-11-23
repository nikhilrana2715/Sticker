import { describe, it, expect } from 'vitest';
import { parseSheet, sizeFromName, isLabelText, cleanLabel, defaultGap } from '../src/excel/parse.js';

describe('sizeFromName', () => {
  it('reads W x H from the sheet name', () => {
    expect(sizeFromName('45X32')).toEqual({ w: 45, h: 32 });
    expect(sizeFromName('66X43 (SHIPPER)')).toEqual({ w: 66, h: 43 });
    expect(sizeFromName('34x28 (2)')).toEqual({ w: 34, h: 28 });
  });
  it('falls back to 45 x 32 for names without a usable size', () => {
    expect(sizeFromName('ROLLER')).toEqual({ w: 45, h: 32 });
    expect(sizeFromName('6X47')).toEqual({ w: 45, h: 32 });
  });
});

describe('labels', () => {
  it('detects label cells in their messy variants', () => {
    for (const s of ['BATCH NO: -', 'Qty:-', 'MAX. RETAIL PRICE ₹:', 'SR.NO', 'Sr.  No.', 'Material Code']) {
      expect(isLabelText(s)).toBe(true);
    }
    for (const s of ['BEARING', '297/-', '1', '(INCLUSIVE OF ALL TAXES)']) {
      expect(isLabelText(s)).toBe(false);
    }
  });
  it('strips trailing punctuation', () => {
    expect(cleanLabel('BATCH NO: -   ')).toBe('BATCH NO');
    expect(cleanLabel('Qty:-')).toBe('Qty');
  });
});

describe('parseSheet', () => {
  it('label/value block repeated across → one sticker, across = copies', () => {
    const rows = [
      ['628 2RS C3', '', '628 2RS C3', ''],
      [],
      ['CONTENT: -', 'BEARING', 'CONTENT: -', 'BEARING'],
      ['QUANTITY: -', '1', 'QUANTITY: -', '1'],
      ['MAX. RETAIL PRICE ₹:', '102/-', 'MAX. RETAIL PRICE ₹:', '102/-'],
      ['(INCLUSIVE OF ALL TAXES)', '', '(INCLUSIVE OF ALL TAXES)', '']
    ];
    const { stickers, across } = parseSheet(rows);
    expect(across).toBe(2);
    expect(stickers).toHaveLength(1);
    expect(stickers[0].title).toBe('628 2RS C3');
    expect(stickers[0].rows.map((r) => [r.label, r.value])).toEqual([
      ['CONTENT', 'BEARING'],
      ['QUANTITY', '1'],
      ['MAX. RETAIL PRICE ₹', '102/-'],
      ['(INCLUSIVE OF ALL TAXES)', '']
    ]);
  });

  it('two value columns under one label column → two stickers', () => {
    const rows = [
      ['6303 C3'],
      [],
      ['BATCH NO: -', 'ZE11', 'ZD01'],
      ['PACKED ON: -', '05/25', '07/26']
    ];
    const { stickers } = parseSheet(rows);
    expect(stickers.map((s) => s.rows[0].value)).toEqual(['ZE11', 'ZD01']);
  });

  it('table layout → one sticker per data row', () => {
    const rows = [
      ['Code', 'Description', 'Qty'],
      ['A1', 'Bearing 6203', '10'],
      ['A2', 'Bearing 6204', '20']
    ];
    const { stickers, across } = parseSheet(rows);
    expect(across).toBe(1);
    expect(stickers).toHaveLength(2);
    expect(stickers[1].rows.map((r) => r.value)).toEqual(['A2', 'Bearing 6204', '20']);
  });

  it('plain lines → title + note lines', () => {
    const rows = [['RO 7.925X25.4', '', 'RO 7.925X25.4'], [], ['500 PCS.', '', '500 PCS.']];
    const { stickers, across } = parseSheet(rows);
    expect(across).toBe(2);
    expect(stickers).toHaveLength(1);
    expect(stickers[0].title).toBe('RO 7.925X25.4');
    expect(stickers[0].rows[0]).toMatchObject({ label: '500 PCS.', value: '' });
  });
});

describe('defaultGap', () => {
  it('shrinks the gap so the roll row fits a 4-inch printer', () => {
    expect(defaultGap(2, 45, 105.7)).toBe(2);
    expect(defaultGap(3, 34, 105.7)).toBe(1);
  });
});
