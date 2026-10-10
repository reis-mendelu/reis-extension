import { describe, it, expect } from 'vitest';
import { downloadName, filenameFromContentDisposition } from '../contentDisposition';

const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

describe('filenameFromContentDisposition', () => {
  // Captured from IS on 2026-10-03: IS transliterates, so every name it sends
  // is ASCII in a plain quoted `filename=` — even for a Czech title.
  it('reads the header IS actually sends', () => {
    expect(filenameFromContentDisposition('attachment; filename="algo05.pptx"')).toBe(
      'algo05.pptx'
    );
    expect(
      filenameFromContentDisposition(
        'attachment; filename="Pozadavky_na_ukonceni_predmetu_Management.docx"'
      )
    ).toBe('Pozadavky_na_ukonceni_predmetu_Management.docx');
  });

  it('reads an unquoted token', () => {
    expect(filenameFromContentDisposition('attachment; filename=x.pdf')).toBe('x.pdf');
  });

  it('percent-decodes filename* (RFC 5987) and prefers it over filename', () => {
    expect(
      filenameFromContentDisposition(
        'attachment; filename="Prednaska 4.pptx"; filename*=UTF-8\'\'P%C5%99edn%C3%A1%C5%A1ka%204.pptx'
      )
    ).toBe('Přednáška 4.pptx');
    // Order in the header does not matter.
    expect(
      filenameFromContentDisposition(
        'attachment; filename*=UTF-8\'\'P%C5%99edn%C3%A1%C5%A1ka.pptx; filename="Prednaska.pptx"'
      )
    ).toBe('Přednáška.pptx');
  });

  it('is case-insensitive in parameter names and charset, and skips a language tag', () => {
    expect(
      filenameFromContentDisposition("Attachment; FILENAME*=utf-8'cs'%C4%8Cesk%C3%BD.docx")
    ).toBe('Český.docx');
    expect(filenameFromContentDisposition('attachment; FileName="a.pdf"')).toBe('a.pdf');
  });

  it('decodes an ISO-8859-1 filename*', () => {
    expect(filenameFromContentDisposition("attachment; filename*=ISO-8859-1''na%EFve.txt")).toBe(
      'naïve.txt'
    );
  });

  it('falls back to filename= when filename* has a broken percent sequence', () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename*=UTF-8''bad%E0%A4%A.pdf; filename=ok.pdf"
      )
    ).toBe('ok.pdf');
    expect(filenameFromContentDisposition("attachment; filename*=UTF-8''bad%ZZ.pdf")).toBeNull();
  });

  it('unescapes a quoted-string and ignores trailing separators and whitespace', () => {
    expect(filenameFromContentDisposition('attachment; filename="say \\"hi\\".txt" ;  ')).toBe(
      'say "hi".txt'
    );
    expect(filenameFromContentDisposition('attachment; filename="a; b.pdf"; size=10')).toBe(
      'a; b.pdf'
    );
  });

  // The native path writes this name to the filesystem.
  it('strips any path, so a name can never climb out of the download folder', () => {
    expect(filenameFromContentDisposition('attachment; filename="../../etc/passwd"')).toBe(
      'passwd'
    );
    expect(filenameFromContentDisposition('attachment; filename=C:\\x\\evil.exe')).toBe('evil.exe');
  });

  it('is null when there is no usable name', () => {
    expect(filenameFromContentDisposition(null)).toBeNull();
    expect(filenameFromContentDisposition(undefined)).toBeNull();
    expect(filenameFromContentDisposition('')).toBeNull();
    expect(filenameFromContentDisposition('inline')).toBeNull();
    expect(filenameFromContentDisposition('attachment; filename=""')).toBeNull();
    expect(filenameFromContentDisposition('attachment; filename="../"')).toBeNull();
  });
});

describe('downloadName', () => {
  it("uses IS's name when the header has one, over the row's title", () => {
    expect(
      downloadName(
        { contentDisposition: 'attachment; filename="algo05.pptx"', contentType: PPTX },
        { name: 'Přednáška 4 -- Cykly', type: 'pptx' }
      )
    ).toBe('algo05.pptx');
  });

  // IS links are `slozka.pl?download=…` — the URL is never a name.
  it("falls back to the row's title plus an extension from the content type", () => {
    expect(
      downloadName(
        { contentDisposition: null, contentType: PPTX },
        { name: 'Přednáška 4 -- Cykly', type: 'unknown' }
      )
    ).toBe('Přednáška 4 -- Cykly.pptx');
  });

  // IS reports .ipynb as application/x-unknown, so the mime says nothing.
  it("uses the row's own type when the content type does not map", () => {
    expect(
      downloadName(
        { contentDisposition: null, contentType: 'application/x-unknown' },
        { name: 'cvičení 1', type: 'ipynb' }
      )
    ).toBe('cvičení 1.ipynb');
  });

  it('adds no extension when nothing knows one, and never an "unknown" one', () => {
    expect(
      downloadName(
        { contentDisposition: null, contentType: 'application/x-unknown' },
        { name: 'cvičení 1', type: 'unknown' }
      )
    ).toBe('cvičení 1');
  });

  it('keeps an extension the title already carries', () => {
    expect(
      downloadName({ contentDisposition: null, contentType: PPTX }, { name: 'slides.pptx' })
    ).toBe('slides.pptx');
  });

  it('makes the title safe to save', () => {
    expect(
      downloadName(
        { contentDisposition: null, contentType: 'application/pdf' },
        { name: 'a/b: c?' }
      )
    ).toBe('a_b_ c_.pdf');
  });

  it('uses the default name when there is no row', () => {
    expect(downloadName({ contentDisposition: null, contentType: 'application/pdf' })).toBe(
      'dokument.pdf'
    );
    expect(downloadName({ contentDisposition: null, contentType: null })).toBe('dokument');
  });
});
