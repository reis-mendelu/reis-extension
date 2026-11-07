import { describe, it, expect } from 'vitest';
import { shownNames, rowExtension } from '../shownNames';

describe('shownNames', () => {
  /**
   * Dominik, 2026-11-07: "same name, different file". Without extensions,
   * instrukce.md and instrukce.docx both read "instrukce"; only those rows get
   * their extension back, as "instrukce (md)".
   */
  it('adds the extension only to rows that would read the same', () => {
    expect(
      shownNames([
        { name: 'instrukce.md', kind: 'file', ext: 'md' },
        { name: 'instrukce.docx', kind: 'file', ext: 'docx' },
        { name: 'prednaska-demo.html', kind: 'file', ext: 'html' },
      ])
    ).toEqual(['instrukce (md)', 'instrukce (docx)', 'prednaska demo']);
  });

  it('compares titles after cleaning, and skips rows that are not in the list', () => {
    expect(
      shownNames([
        { name: 'Prezentace_1', kind: 'title', ext: 'pdf' },
        null,
        { name: 'Prezentace 1', kind: 'title', ext: 'pptx' },
        { name: 'Harmonogram', kind: 'title', ext: 'pdf' },
      ])
    ).toEqual(['Prezentace 1 (pdf)', undefined, 'Prezentace 1 (pptx)', 'Harmonogram']);
  });

  it('falls back to the real name when the extension does not tell them apart', () => {
    expect(
      shownNames([
        { name: 'instrukce_v1.md', kind: 'file', ext: 'md' },
        { name: 'instrukce-v1.md', kind: 'file', ext: 'md' },
        { name: 'instrukce v1.docx', kind: 'file', ext: 'docx' },
      ])
    ).toEqual(['instrukce_v1.md', 'instrukce-v1.md', 'instrukce v1 (docx)']);
  });

  it('checks the final labels again: an added extension can meet a real name', () => {
    const shown = shownNames([
      { name: 'report.pdf', kind: 'file', ext: 'pdf' },
      { name: 'report.docx', kind: 'file', ext: 'docx' },
      { name: 'report (pdf).txt', kind: 'file', ext: 'txt' },
    ]);
    expect(new Set(shown).size).toBe(3);
    expect(shown[1]).toBe('report (docx)');
  });

  it('leaves a duplicate without an extension as it is', () => {
    expect(
      shownNames([
        { name: 'Přednáška 1', kind: 'title' },
        { name: 'Přednáška 1', kind: 'title' },
      ])
    ).toEqual(['Přednáška 1', 'Přednáška 1']);
  });
});

describe('rowExtension', () => {
  it("takes the file name's extension, else IS's type, never 'unknown'", () => {
    expect(rowExtension({ type: 'unknown', filename: 'uloha.ipynb' })).toBe('ipynb');
    expect(rowExtension({ type: 'pdf' })).toBe('pdf');
    expect(rowExtension({ type: 'unknown' })).toBeUndefined();
  });
});
