// pdf.js 6 ships two builds. The default one calls Map.prototype.getOrInsertComputed
// and Math.sumPrecise unguarded, and Chromium 143 has neither: every PDF opened
// in the side pane failed with react-pdf's "Failed to load PDF file." (a Windows
// Vivaldi student, 2026-10-21). The legacy build polyfills them, and is what
// pdf.js says to use below its latest-browsers target.
//
// react-pdf imports pdf.js by these two bare specifiers, so each app build
// redirects them here. The worker is imported by its legacy path directly in
// src/components/SubjectFileDrawer/pdfWorkerSource.ts; the two must match.
// Guard: src/test/guards/pdfjsRunsOnOlderBrowsers.test.ts
export const pdfjsLegacyAliases: { find: RegExp; replacement: string }[] = [
  { find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' },
  {
    find: /^pdfjs-dist\/web\/pdf_viewer\.mjs$/,
    replacement: 'pdfjs-dist/legacy/web/pdf_viewer.mjs',
  },
];
