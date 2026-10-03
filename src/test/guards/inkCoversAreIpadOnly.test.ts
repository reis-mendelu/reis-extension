import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Covers (the tape) exist only in the iPad's native PencilKit reader.
 *
 * Not a split chosen per tree: the ink reader itself is iPad-only
 * (`PdfInkPlugin.isAvailable` is true only on an iPad with iPadOS 16+), so the
 * iPhone, Android and the extension open PDFs in pdf.js, read-only — there is
 * no annotated page to cover. Making, saving and testing covers is all Swift
 * under native/capacitor-pdf-ink; the JS side only hands the reader its
 * translated strings. Spec: docs/superpowers/specs/2026-10-03-ipad-recall-covers-design.md.
 *
 * If an ink reader ever reaches another platform, covers are part of it.
 */
const root = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const NATIVE = 'native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/';
/** Shared files that changed for covers, and carry only the reader's copy. */
const SHARED_STRING_FILES = [
  'src/mobile/pdfInk.ts',
  'src/hooks/ui/usePdfInkStrings.ts',
  'src/i18n/locales/en.json',
  'src/i18n/locales/cs.json',
];

describe('ink covers are iPad-native only', () => {
  it('the native reader keeps covers in the archive', () => {
    expect(read(`${NATIVE}CoverLayerView.swift`)).toContain('final class CoverLayerView');
    expect(read(`${NATIVE}InkArchive.swift`)).toContain('var coverCards: [Int: [PageCover]]');
  });

  it('covers never travel with an exported PDF', () => {
    // A shared PDF is the student's notes; a study aid baked in would hide the
    // answer from whoever receives it (decided 2026-09-07, kept 2026-10-03).
    expect(read(`${NATIVE}InkExport.swift`)).not.toMatch(/cover/i);
  });

  it('the reader is iPad-only, which is why no other tree has covers', () => {
    expect(read(`${NATIVE}PdfInkPlugin.swift`)).toContain(
      'UIDevice.current.userInterfaceIdiom == .pad'
    );
  });

  it.each(SHARED_STRING_FILES)('%s carries the reader’s cover strings and nothing else', (file) => {
    const text = read(file);
    expect(text).toMatch(/"?cover"?:/);
    expect(text).not.toMatch(/PageCover|CoverLayerView/);
  });
});
