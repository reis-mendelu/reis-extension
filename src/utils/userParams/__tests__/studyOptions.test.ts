import { describe, it, expect } from 'vitest';
import { parseStudyOptions, parseStudyStatus, isEnrolledStatus } from '../studyOptions';

/**
 * The study switcher from a real `studium.pl?lang=cz` of a student with two
 * parallel PEF studies (captured 2026-10-20): the markup is verbatim, the
 * studium ids and programmes are made up — it was one student's record. It is
 * the ONLY place the second study's id appears on that page: every link
 * carries the selected one.
 */
const SWITCHER = `<form method="post" action="/auth/student/studium.pl" name="formular">
<input type="hidden" name="lang" value="cz"><div id="titulek"><h1>Portál studenta</h1>
<div style="font-size: 11px;"><input type="hidden" name="obdobi" value="829">Studium
<select name="studium"><option value="900001" selected="selected">PEF B-EKO komb [sem 1, roč 1]</option><option value="900002">PEF B-OI prez [sem 3, roč 2]</option></select>
 období - <b>všechna období</b>&nbsp;&nbsp;<input type="submit" name="omezit_popupy" value="Vybrat"></div></div></form>`;

/** The status row, in the table layout of a real `studium.pl` (2026-10-20). */
const statusRow = (value: string) =>
  `<tr class=""><td class="odsazena" align="left">Stav studia: </td><td class="odsazena" align="left">${value}</td></tr>`;

describe('parseStudyOptions', () => {
  it('reads every study in the switcher, in IS order, labels verbatim', () => {
    expect(parseStudyOptions(SWITCHER)).toEqual([
      { studium: '900001', label: 'PEF B-EKO komb [sem 1, roč 1]' },
      { studium: '900002', label: 'PEF B-OI prez [sem 3, roč 2]' },
    ]);
  });

  // A student with one study gets no <select> at all (Dominik's own page,
  // 2026-10-20) — and that must read as "nothing to choose", not as an error.
  it('returns no options for a page without a switcher', () => {
    expect(parseStudyOptions('<div id="titulek"><h1>Portál studenta</h1></div>')).toEqual([]);
  });

  it('ignores a select that is not the study switcher', () => {
    expect(
      parseStudyOptions('<select name="obdobi"><option value="829">ZS</option></select>')
    ).toEqual([]);
  });
});

describe('parseStudyStatus', () => {
  it('reads the status value', () => {
    expect(parseStudyStatus(`<table>${statusRow('řádně zapsán')}</table>`)).toBe('řádně zapsán');
  });

  it('returns null when the row is missing', () => {
    expect(parseStudyStatus('<table></table>')).toBeNull();
  });
});

describe('isEnrolledStatus', () => {
  it('counts a regularly enrolled study', () => {
    expect(isEnrolledStatus('řádně zapsán')).toBe(true);
  });

  // No real sample of an interrupted study exists yet; the wording below is
  // the rule's assumption, not a captured value.
  it('does not count an interrupted study', () => {
    expect(isEnrolledStatus('přerušeno')).toBe(false);
    expect(isEnrolledStatus('zapsán, studium přerušeno')).toBe(false);
  });

  it('does not count a study IS marks as not enrolled', () => {
    expect(isEnrolledStatus('nezapsán')).toBe(false);
  });

  it('does not count a finished study', () => {
    expect(isEnrolledStatus('absolvoval')).toBe(false);
    expect(isEnrolledStatus('ukončeno')).toBe(false);
  });
});
