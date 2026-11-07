import { describe, it, expect } from 'vitest';
import {
  documentTitle,
  attachmentLabel,
  prettifyFileName,
  prettifyTitle,
  fileExtension,
  middleCut,
} from '../documentLabels';

const doc = { file_name: 'Harmonograminfo', title: 'Harmonogram+info' };

describe('documentTitle', () => {
  it('prefers the title as IS prints it', () => {
    expect(documentTitle(doc)).toBe('Harmonogram+info');
  });

  it('falls back to file_name for rows cached before titles were kept', () => {
    expect(documentTitle({ file_name: 'Přednáška 1' })).toBe('Přednáška 1');
  });
});

describe('attachmentLabel', () => {
  const a = (filename?: string) => ({ name: 'x', type: 'pdf', link: 'l', filename });

  it('calls a lone file by its document title', () => {
    expect(attachmentLabel(doc, a('harm.pdf'), 0, 1)).toBe('Harmonogram+info');
  });

  it('calls one of several files by its own name', () => {
    expect(attachmentLabel(doc, a('org-info.pdf'), 1, 2)).toBe('org-info.pdf');
  });

  it('numbers files whose name IS did not give', () => {
    expect(attachmentLabel(doc, a(), 1, 2)).toBe('Harmonogram+info (2)');
  });

  it('falls back to file_name and a number for a row cached before both existed', () => {
    expect(attachmentLabel({ file_name: 'Harmonograminfo' }, a(), 1, 2)).toBe(
      'Harmonograminfo (2)'
    );
  });
});

describe('prettifyFileName', () => {
  /**
   * Dominik, 2026-11-07: an extension at the end of every row and "_ | . | -"
   * between words read oddly, and the badge on the right already says PDF. The
   * shown name drops the extension and turns separators into spaces; the real
   * name stays on hover, in the reader, in saved files and in reIS for Claude.
   */
  it('turns _ - and inner . into spaces and drops the extension', () => {
    expect(prettifyFileName('ig-harm_kombinovani_PPS-ZS2026.pdf')).toBe(
      'ig harm kombinovani PPS ZS2026'
    );
    expect(prettifyFileName('Tyden5_Uzivatele_a_bezpecnost.pptx')).toBe(
      'Tyden5 Uzivatele a bezpecnost'
    );
    expect(prettifyFileName('instrukce.v2.final.docx')).toBe('instrukce v2 final');
  });

  it('keeps dots and hyphens between digits: numbers, versions, dates, ranges', () => {
    expect(prettifyFileName('verze_2.1.pdf')).toBe('verze 2.1');
    expect(prettifyFileName('zadani_04.10.2026.pdf')).toBe('zadani 04.10.2026');
    expect(prettifyFileName('ig-c03-Cviceni_v_laboratori_Q1-48.pdf')).toBe(
      'ig c03 Cviceni v laboratori Q1-48'
    );
  });

  it('collapses repeated separators and trims', () => {
    expect(prettifyFileName('__P3__final--.zip')).toBe('P3 final');
  });

  it('leaves a title alone: no extension, a spaced dash, a number with a dot', () => {
    expect(prettifyFileName('Reading week - Pisařovic - Flexbox')).toBe(
      'Reading week - Pisařovic - Flexbox'
    );
    expect(prettifyFileName('Prezentace – přednáška č. 4')).toBe('Prezentace – přednáška č. 4');
    expect(prettifyFileName('Studijní opora 2.0')).toBe('Studijní opora 2.0');
  });

  it('keeps a name that is only an extension', () => {
    expect(prettifyFileName('.pdf')).toBe('.pdf');
    expect(prettifyFileName('.gitignore')).toBe('.gitignore');
  });
});

describe('prettifyTitle', () => {
  /**
   * Dominik, 2026-11-07: "we should clean up the document titles". A title gets
   * the separators of a file name read as spaces, and nothing else: it keeps
   * its dots and any extension-like ending, a spaced dash and a plus.
   */
  it('turns _ and - between words into spaces, keeping " + " and a spaced dash', () => {
    expect(prettifyTitle('ig-03-fyzicka_vrstva + ig-04-Ethernet + ig-05-sitova_vrstva')).toBe(
      'ig 03 fyzicka vrstva + ig 04 Ethernet + ig 05 sitova vrstva'
    );
    expect(prettifyTitle('Kombinovani - Harmonogram+organizacni informace')).toBe(
      'Kombinovani - Harmonogram+organizacni informace'
    );
    expect(prettifyTitle('Moderni_smery_managementu_1')).toBe('Moderni smery managementu 1');
  });

  it('keeps dates, versions, codes and dots', () => {
    expect(prettifyTitle('Zadani 04.10.2026 v2.1 (Q1-48)')).toBe('Zadani 04.10.2026 v2.1 (Q1-48)');
    expect(prettifyTitle('Prezentace – přednáška č. 4')).toBe('Prezentace – přednáška č. 4');
    expect(prettifyTitle('Odkaz na Seznam.cz')).toBe('Odkaz na Seznam.cz');
  });

  it('never strips an extension-like ending from a title', () => {
    // A lone file's row shows its document's title, which a teacher may type
    // like a file name; prettifyFileName once cut these on that row.
    expect(prettifyTitle('Cvičení 2.1a')).toBe('Cvičení 2.1a');
    expect(prettifyTitle('Prednaska01.pdf')).toBe('Prednaska01.pdf');
    expect(prettifyTitle('.NET_zaklady')).toBe('.NET zaklady');
  });
});

describe('fileExtension', () => {
  it('is the extension in lower case, without the dot', () => {
    expect(fileExtension('instrukce.MD')).toBe('md');
    expect(fileExtension('Studijní opora 2.0')).toBeUndefined();
    expect(fileExtension(undefined)).toBeUndefined();
  });
});

describe('middleCut', () => {
  it('leaves text that fits alone', () => {
    expect(middleCut('ig harm kombinovani', 30)).toBe('ig harm kombinovani');
  });

  it('never splits an emoji, at any length', () => {
    const text = '📘 skripta 📗 cvičení 📕 zkouška 📙';
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    for (let keep = 2; keep <= 30; keep++) expect(middleCut(text, keep)).not.toMatch(lone);
  });

  it('cuts the middle to the length asked, keeping both ends', () => {
    const cut = middleCut('ig organizacni informace kombinovani', 20);
    expect(cut.length).toBeLessThanOrEqual(20);
    expect(cut.startsWith('ig organiz')).toBe(true);
    expect(cut.endsWith('novani')).toBe(true);
    expect(cut).toContain('…');
  });
});
