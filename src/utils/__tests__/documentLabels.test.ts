import { describe, it, expect } from 'vitest';
import { documentTitle, attachmentLabel, middleTruncate } from '../documentLabels';

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

describe('middleTruncate', () => {
  const LONG = 'Cviceni_5_Uzivatele_a_bezpecnost_postupne_s_ukazkami.ipynb';

  it('leaves a name that fits alone', () => {
    expect(middleTruncate('ig-c04-fyzicka_vrstva.pdf', 40)).toBe('ig-c04-fyzicka_vrstva.pdf');
  });

  it('cuts the middle of the stem to the length asked, never the extension', () => {
    for (const keep of [12, 20, 30, 44]) {
      const cut = middleTruncate(LONG, keep);
      expect(cut).toHaveLength(keep);
      expect(cut.endsWith('.ipynb')).toBe(true);
      expect(cut).toContain('…');
    }
    expect(middleTruncate(LONG, 30).startsWith('Cviceni_5_')).toBe(true);
  });

  it('cuts a name with no extension at its end', () => {
    expect(middleTruncate('a'.repeat(60), 44)).toBe(`${'a'.repeat(43)}…`);
  });
});
