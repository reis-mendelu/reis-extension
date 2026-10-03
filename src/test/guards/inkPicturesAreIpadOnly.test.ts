import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Pictures on a page exist only in the iPad's native PencilKit reader.
 *
 * Not a split chosen per tree: the ink reader itself is iPad-only
 * (`PdfInkPlugin.isAvailable` is true only on an iPad with iPadOS 16+), so the
 * iPhone, Android and the extension have no annotated page to put a picture on —
 * they open PDFs in pdf.js, read-only. Placing, arranging, saving and exporting
 * a picture is all Swift under native/capacitor-pdf-ink; the JS side only hands
 * the reader its translated strings.
 *
 * If an ink reader ever reaches another platform, pictures are part of it.
 */
const root = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const NATIVE = 'native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/';
/** Shared files that changed for pictures, and carry only the reader's copy. */
const SHARED_STRING_FILES = [
  'src/mobile/pdfInk.ts',
  'src/hooks/ui/usePdfInkStrings.ts',
  'src/i18n/locales/en.json',
  'src/i18n/locales/cs.json',
];

describe('ink pictures are iPad-native only', () => {
  it('the native reader places, saves and exports pictures', () => {
    expect(read(`${NATIVE}PdfInkViewController+Pictures.swift`)).toContain(
      'PHPickerViewController'
    );
    expect(read(`${NATIVE}InkArchive.swift`)).toContain('var pictures: [Int: [PagePicture]]');
    expect(read(`${NATIVE}InkExport.swift`)).toContain('pictures[index]');
  });

  it('the reader is iPad-only, which is why no other tree has pictures', () => {
    expect(read(`${NATIVE}PdfInkPlugin.swift`)).toContain(
      'UIDevice.current.userInterfaceIdiom == .pad'
    );
  });

  it.each(SHARED_STRING_FILES)(
    '%s carries the reader’s picture strings and nothing else',
    (file) => {
      const text = read(file);
      expect(text).toMatch(/photoLibrary/);
      expect(text).not.toMatch(/PHPicker|PagePicture/);
    }
  );
});
