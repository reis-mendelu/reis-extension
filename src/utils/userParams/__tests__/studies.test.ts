import { describe, it, expect } from 'vitest';
import {
  parseStudyOptions,
  parseStudyStatus,
  isActiveStudyStatus,
  parseStudyLabel,
  parseStudyObdobi,
} from '../studies';
import { studyPage, INTERRUPTED, CONCURRENT, MULTI_EN } from './studyPage.fixture';

describe('parseStudyOptions', () => {
  it('lists every study in the header select, in the order IS gives them', () => {
    const html = studyPage({ studies: INTERRUPTED, selected: '900001', status: 'řádně zapsán' });
    expect(parseStudyOptions(html)).toEqual([
      { studium: '900001', label: 'PEF B-EM prez [sem 1, roč 1]' },
      { studium: '900002', label: 'AF B-ZIN-SBABY prez [sem 1, roč 1]' },
      { studium: '900003', label: 'FRRMS B-RER prez [sem 3, roč 2]' },
    ]);
  });

  // A single-study page names the study in a <b> beside a hidden input, with
  // no select at all (real shape, Dominik's account, October 2026). That is
  // the signal for "nothing to choose": the old code path, untouched.
  it('finds nothing on a single-study page', () => {
    const single = `<div id="titulek"><h1>Portál studenta</h1><div style="font-size: 11px;"><input type="hidden" name="studium" value="149707" />Studium – <b>PEF B-OI-ZBOI prez [sem 3, roč 2]</b>, období – <b>ZS 2026/2027 - PEF</b></div></div>`;
    expect(parseStudyOptions(single)).toEqual([]);
  });

  it('ignores the obdobi select that some pages carry next to it', () => {
    const html = `<select name="studium" onchange="x"><option value="900011">PEF B-AII prez [sem 1, roč 1]</option><option value="900012" selected="selected">PEF B-EM komb [sem 1, roč 1]</option></select> období <select name="obdobi"><option value="829" selected="selected">ZS 2026/2027 - PEF</option></select>`;
    expect(parseStudyOptions(html).map((o) => o.studium)).toEqual(['900011', '900012']);
  });
});

describe('parseStudyStatus', () => {
  it('reads "Stav studia" from a Czech page', () => {
    const html = studyPage({ studies: CONCURRENT, selected: '900011', status: 'řádně zapsán' });
    expect(parseStudyStatus(html)).toBe('řádně zapsán');
  });

  it('reads "Progress of study" from an English page', () => {
    const html = studyPage({
      studies: CONCURRENT,
      selected: '900011',
      status: 'enrolled',
      lang: MULTI_EN,
    });
    expect(parseStudyStatus(html)).toBe('enrolled');
  });

  // Real single-study row (October 2026): a space before </td>, and the
  // interruption table's own "Stav" column header must not be mistaken for it.
  it('reads the row with the spacing IS really uses', () => {
    const html = `<th class="zahlavi" >Stav</th><tr class="" ><td class="odsazena" align="left">Stav studia: </td><td class="odsazena" align="left">řádně zapsán</td></tr>`;
    expect(parseStudyStatus(html)).toBe('řádně zapsán');
  });

  it('is null when the row is not there', () => {
    expect(parseStudyStatus('<html><body>nic</body></html>')).toBeNull();
  });
});

describe('isActiveStudyStatus', () => {
  // The only two values seen on a real page, both on an active study.
  it.each(['řádně zapsán', 'enrolled', 'Řádně zapsán'])('"%s" is active (REAL)', (s) => {
    expect(isActiveStudyStatus(s)).toBe(true);
  });

  // SYNTHETIC: no interrupted or finished study page has been seen. These are
  // plausible IS wordings, and the rule's contract is only that none of them
  // can count as active — an unknown status is never treated as a current
  // study (getUserParams then falls back to what it did before).
  it.each([
    'studium přerušeno',
    'přerušeno',
    'interrupted',
    'nezapsán',
    'not enrolled',
    'absolvoval',
    'studium ukončeno',
    'zanechal studia',
    'vyloučen',
    'zapsán, studium přerušeno',
    '',
    null,
  ])('"%s" is not active (SYNTHETIC)', (s) => {
    expect(isActiveStudyStatus(s)).toBe(false);
  });
});

describe('parseStudyLabel', () => {
  it('splits a Czech study label into the fields moje_studium.pl gave', () => {
    expect(parseStudyLabel('PEF B-EM komb [sem 1, roč 1]')).toEqual({
      studyCode: 'PEF B-EM komb [sem 1, roč 1]',
      facultyLabel: 'PEF',
      studyProgram: 'B-EM',
      studyForm: 'komb',
      studySemester: 1,
      studyYear: 1,
    });
  });

  it('keeps only the code when the label is not in that shape', () => {
    expect(parseStudyLabel('FBE B-EM pres [term 1, year 1]')).toEqual({
      studyCode: 'FBE B-EM pres [term 1, year 1]',
    });
  });
});

describe('parseStudyObdobi', () => {
  it("reads the study's own period from its links", () => {
    const html = studyPage({ studies: INTERRUPTED, selected: '900003', status: 'x' });
    expect(parseStudyObdobi(html, '900003')).toBe('815');
    expect(parseStudyObdobi(html, '900001')).toBeNull();
  });
});
