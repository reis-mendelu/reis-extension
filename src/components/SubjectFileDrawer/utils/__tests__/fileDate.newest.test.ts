import { describe, it, expect } from 'vitest';
import { parseIsDate, lastChanged, changedOn } from '../fileDate';

describe('parseIsDate — the English IS page', () => {
  /**
   * reIS fetches every folder in both languages, and lang=en prints dates as
   * MM/DD/YYYY (live, 2026-11-07: "09/27/2026"). The parser knew only the Czech
   * form, so in English no file was ever "Nový" and every folder sorted as if
   * undated.
   */
  it('parses MM/DD/YYYY', () => {
    const d = parseIsDate('09/27/2026');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(8);
    expect(d?.getDate()).toBe(27);
  });

  it('rejects an impossible US date', () => {
    expect(parseIsDate('27/09/2026')).toBeNull();
  });
});

describe('lastChanged', () => {
  /**
   * IS keeps a document's date when the teacher swaps its files and moves only
   * Modifikace: a schedule dated 17.09 was replaced on 23.10. Keyed on the
   * document date, "Nový" never showed it.
   */
  it('is the later of the document date and Modifikace, across a month boundary', () => {
    expect(lastChanged({ date: '30.09.2026', modified: '01.10.2026' })).toEqual(
      new Date(2026, 9, 1)
    );
    expect(lastChanged({ date: '01.10.2026', modified: '30.09.2026' })).toEqual(
      new Date(2026, 9, 1)
    );
  });

  it('falls back to whichever date parses', () => {
    expect(lastChanged({ date: '17.09.2026' })).toEqual(new Date(2026, 8, 17));
    expect(lastChanged({ date: '', modified: '23.10.2026' })).toEqual(new Date(2026, 9, 23));
    expect(lastChanged({ date: '' })).toBeNull();
  });
});

describe('changedOn', () => {
  /**
   * The iPad reader keeps a PDF only while this string matches the one it was
   * cached under, so a replaced file has to change it, and an unchanged one
   * must keep the document date it has always been cached by.
   */
  it('is Modifikace when it is later, as IS printed it', () => {
    expect(changedOn({ date: '30.09.2026', modified: '01.10.2026' })).toBe('01.10.2026');
  });

  it('stays the document date when nothing changed since', () => {
    expect(changedOn({ date: '17.09.2026', modified: '17.09.2026' })).toBe('17.09.2026');
    expect(changedOn({ date: '17.09.2026' })).toBe('17.09.2026');
  });
});
