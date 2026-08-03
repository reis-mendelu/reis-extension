import { describe, it, expect } from 'vitest';
import { chooseFilename } from '../openIsFile';

describe('chooseFilename', () => {
  it('prefers the caller override — study documents carry a chosen name', () => {
    // buildDocumentUrl targets tisk_dokumentu.pl, whose Content-Disposition is
    // IS's own name. STUDY_DOCUMENTS defines what the student should see.
    expect(chooseFilename('Potvrzeni_o_studiu.pdf', 'tisk_dokumentu.pdf')).toBe(
      'Potvrzeni_o_studiu.pdf'
    );
  });

  it('falls back to the Content-Disposition name — subject files have no chosen name', () => {
    expect(chooseFilename(undefined, 'Prednaska_04.pdf')).toBe('Prednaska_04.pdf');
  });

  it('ignores an empty override rather than saving a nameless file', () => {
    expect(chooseFilename('', 'Prednaska_04.pdf')).toBe('Prednaska_04.pdf');
  });
});
