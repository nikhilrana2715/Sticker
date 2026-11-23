/** App-wide mutable state, shared between modules. */

/** TSC TE310 maximum print width in mm (4-inch head). */
export const TSC_MAX_W = 105.7;

export const state = {
  /** PDF chosen in PDF mode. */
  selectedFile: null,
  /** Excel chosen in Excel mode. Only one of the two is set at a time. */
  selectedExcelFile: null,
  /**
   * Generated label pages. PDF labels: { url, sourcePage, sourceCell, on, card }.
   * Excel labels also carry { fixedW, fixedH, across, gap }.
   */
  labels: [],
  busy: false,
  pdfBlob: null,
  pdfBlobUrl: null,
  /** Page count of the source PDF (0 for Excel). */
  origPages: 0
};

export const hasFile = () => !!(state.selectedFile || state.selectedExcelFile);
export const selected = () => state.labels.filter((l) => l.on);
