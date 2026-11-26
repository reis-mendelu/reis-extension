import { describe, it, expect } from 'vitest';
import { foldMapped, foldPlain, parseQuery } from '../searchFold';
import { snippetFor } from '../searchSnippet';

describe('folding', () => {
  it('ignores case and diacritics both ways', () => {
    expect(foldPlain('Zápočet PÍSEMNÁ Řešení Ůžasný')).toBe('zapocet pisemna reseni uzasny');
    expect(foldPlain('zapocet')).toBe(foldPlain('ZÁPOČET'));
    // a decomposed spelling (letter plus combining mark) is the same word
    expect(foldPlain('zápocet')).toBe('zapocet');
    // a PDF's ligature is spelled out
    expect(foldPlain('ﬁnanční')).toBe('financni');
    // Greek final sigma folds the same whole-string and letter by letter
    expect(foldMapped('ΟΔΟΣ ΤΕΛΟΣ').text).toBe(foldPlain('ΟΔΟΣ ΤΕΛΟΣ'));
  });

  it('maps a folded position back to the original text', () => {
    const f = foldMapped('Úvod: zápočtový test');
    const at = f.text.indexOf('zapoctovy');
    expect(f.origin(at)).toBe('Úvod: '.length);
    expect(f.origin(f.text.length)).toBe('Úvod: zápočtový test'.length);
  });
});

describe('parseQuery', () => {
  it('ands plain words and keeps a quoted phrase whole', () => {
    expect(parseQuery('Zápočtový test').terms).toEqual(['zapoctovy', 'test']);
    expect(parseQuery('termín "zápočtové  písemné práce"').terms).toEqual([
      'termin',
      'zapoctove pisemne prace',
    ]);
    expect(parseQuery('„písemná práce“ 12.').terms).toEqual(['pisemna prace', '12.']);
    // a Czech opening quote closed with a straight one is still a phrase
    expect(parseQuery('„zápočtová práce" test').terms).toEqual(['zapoctova prace', 'test']);
  });

  it('drops stray punctuation and repeats, and caps the number of words', () => {
    expect(parseQuery('" - test test').terms).toEqual(['test']);
    expect(parseQuery('   ').terms).toEqual([]);
    expect(parseQuery(Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ')).terms).toHaveLength(
      12
    );
  });
});

describe('snippetFor', () => {
  const filler = (n: number) => 'slovo '.repeat(n);

  it('shows about 200 characters each side, cut at words, with the match marked', () => {
    const text = `${filler(100)}Zápočtový test bude v pátek. ${filler(100)}`;
    const s = snippetFor(text, ['zapoctovy', 'test'])!;
    expect(s.snippet).toContain('**Zápočtový** **test**');
    expect(s.snippet.startsWith('… slovo')).toBe(true);
    expect(s.snippet.endsWith('slovo …')).toBe(true);
    const plain = s.snippet.replace(/\*\*|… |…/g, '').trim();
    expect(plain.length).toBeGreaterThan(300);
    expect(plain.length).toBeLessThan(460);
    // no word is cut in two
    expect(plain.split(' ').every((w) => w === 'slovo' || /^[A-Za-zÁ-ž.]+$/.test(w))).toBe(true);
  });

  it('picks the place where the words are together, and reports the line', () => {
    const text = `test\n${filler(300)}\npísemná\n${filler(300)}\nPísemná práce test: 9. 12.\n`;
    const s = snippetFor(text, ['test', 'pisemna'])!;
    expect(s.together).toBe(true);
    expect(s.snippet).toContain('**Písemná** práce **test**');
    expect(s.line).toBe(5);
  });

  it('finds a match near the end of a very long text', () => {
    const text = `${'a'.repeat(60_000)} Konec: odevzdat do 17. 1. 2027.`;
    expect(snippetFor(text, ['odevzdat'])!.snippet).toContain('**odevzdat** do 17. 1. 2027.');
  });

  it('marks a word beside the match even when that word is in the text thousands of times', () => {
    const text = `${'student pracuje. '.repeat(6000)}Zápočet je v pondělí, student musí přijít.`;
    const s = snippetFor(text, ['student', 'zapocet'])!;
    expect(s.together).toBe(true);
    expect(s.snippet).toContain('**Zápočet** je v pondělí, **student**');
  });

  it('never cuts a character outside the BMP in two', () => {
    const s = snippetFor('x 🄀 y 0 z', ['0'])!;
    expect(s.snippet).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
  });

  it('reports a page when the text has page breaks, and null when nothing is found', () => {
    const s = snippetFor('Strana jedna\fStrana dvě: kalkulačka\f', ['kalkulacka'])!;
    expect(s.page).toBe(2);
    expect(s.line).toBeUndefined();
    expect(snippetFor('nic tu není', ['zapocet'])).toBeNull();
  });
});
