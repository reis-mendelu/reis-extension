import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseAttendance } from '../attendance';

// Real list.pl pages (trimmed to #tmtab_1, ids scrubbed), three students, ZS 2026/27.
// All three carry IS's new icons: <span data-sysid="doch-…"> wrapping inline SVG.
//  pef-prez-recorded — Absence/Účast on a one-action subject's own row (EXC-KPSIT)
//                      and on a sub-row (EBC-PS Cv)
//  pef-prez-parity   — L/S parity labels; Účast on the EBC-PS Cv sub-row
//  pef-komb-block    — combined form: one block-dated action per subject, on the
//                      subject's own row, nothing recorded yet. No real komb page
//                      with records exists, so EXC-KPSIT is the evidence that a
//                      subject row's own cells are read.
const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', 'list-zaznamniku', name), 'utf-8');

describe('parseAttendance on IS markup with span icons', () => {
  it('reads attendance on the subject row of a one-action subject', () => {
    const result = parseAttendance(fixture('pef-prez-recorded.cz.html'));

    expect(result['EXC-KPSIT']).toEqual([
      {
        label: 'EXC-KPSIT Cv St 17.00-18.50 Q01.48',
        records: [
          { date: '23. 9. 2026', time: '17.00-18.50', room: 'Q01.48', status: 'absent' },
          { date: '30. 9. 2026', time: '17.00-18.50', room: 'Q01.48', status: 'present' },
        ],
      },
    ]);
  });

  it('reads a sub-row and skips the action rows with nothing recorded', () => {
    const result = parseAttendance(fixture('pef-prez-recorded.cz.html'));

    expect(result['EBC-PS']).toHaveLength(1);
    expect(result['EBC-PS']![0]!.label).toBe('EBC-PS Cv Út 15.00-16.50 Q01.48');
    expect(result['EBC-PS']![0]!.records.map((r) => r.status)).toEqual([
      'present',
      'present',
      'present',
      'present',
    ]);
    expect(Object.keys(result).sort()).toEqual(['EBC-PS', 'EXC-KPSIT']);
  });

  it("reads a second student's sub-row on a page with L/S parity actions", () => {
    const result = parseAttendance(fixture('pef-prez-parity.cz.html'));

    expect(Object.keys(result)).toEqual(['EBC-PS']);
    expect(result['EBC-PS']).toEqual([
      {
        label: 'EBC-PS Cv Čt 15.00-16.50 Q01.48',
        records: [
          { date: '24. 9. 2026', time: '15.00-16.50', room: 'Q01.48', status: 'present' },
          { date: '1. 10. 2026', time: '15.00-16.50', room: 'Q01.48', status: 'present' },
          { date: '8. 10. 2026', time: '15.00-16.50', room: 'Q01.48', status: 'present' },
        ],
      },
    ]);
  });

  it('returns nothing for a combined-form page with nothing recorded yet', () => {
    expect(parseAttendance(fixture('pef-komb-block.cz.html'))).toEqual({});
  });
});

// The markup IS served before the span icons: <img sysid> and a leading <small> cell.
const OLD_MARKUP = `
<table id="tmtab_1">
  <tr class="uis-hl-table">
    <td><small></small></td>
    <td><a href="/auth/katalog/syllabus.pl?predmet=162527;lang=cz">EBC-AOS Architektura operačních systémů</a></td>
    <td>EBC-AOS Př Po 11.00-12.50 Q02 Každý týden</td>
    <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    <td><a href="prubezne=1"><img sysid="hodnoceni-prubezne"></a></td>
    <td>-</td>
    <td>-</td>
    <td><a href="../dok_server/slozka.pl?ds=1;id=153877"><img sysid="post-slozky"></a></td>
    <td></td>
  </tr>
  <tr class="uis-hl-table">
    <td></td>
    <td>EBC-AOS Cv Čt 11.00-12.50 Q47 Každý týden</td>
    <td><img src="/img.pl?unid=8917" title="26. 2. 2026, 11.00-12.50, Q47 - Účast" sysid="doch-pritomen"></td>
    <td><img src="/img.pl?unid=8917" title="5. 3. 2026, 11.00-12.50, Q47 - Účast" sysid="doch-pritomen"></td>
    <td><img src="/img.pl?unid=11215" title="12. 3. 2026, 11.00-12.50, Q47 - Absence" sysid="doch-neomluven"></td>
    <td><img src="/img.pl?unid=11215" title="19. 3. 2026, 11.00-12.50, Q47 - Omluvená absence" sysid="doch-omluven"></td>
    <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    <td></td><td></td><td></td><td></td><td></td>
  </tr>
  <tr class="uis-hl-table">
    <td><small></small></td>
    <td><a href="/auth/katalog/syllabus.pl?predmet=162572;lang=cz">EBC-MT Matematika</a></td>
    <td>EBC-MT Př Út 9.00-10.50 Q01 Každý týden</td>
    <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    <td>-</td>
    <td>-</td>
    <td>-</td>
    <td><a href="../dok_server/slozka.pl?ds=1;id=153919"><img sysid="post-slozky"></a></td>
    <td></td>
  </tr>
</table>
`;

describe('parseAttendance on the old img markup', () => {
  it('parses attendance from sub-rows grouped by subject code', () => {
    const result = parseAttendance(OLD_MARKUP);

    expect(result['EBC-AOS']).toHaveLength(1);
    expect(result['EBC-AOS']![0]!.label).toBe('EBC-AOS Cv Čt 11.00-12.50 Q47');
    expect(result['EBC-AOS']![0]!.records).toHaveLength(4);
    expect(result['EBC-AOS']![0]!.records[0]).toEqual({
      date: '26. 2. 2026',
      time: '11.00-12.50',
      room: 'Q47',
      status: 'present',
    });
    expect(result['EBC-AOS']![0]!.records[2]!.status).toBe('absent');
    expect(result['EBC-AOS']![0]!.records[3]!.status).toBe('excused');
  });

  it('skips subjects with nothing recorded', () => {
    expect(parseAttendance(OLD_MARKUP)['EBC-MT']).toBeUndefined();
  });

  it('returns an empty object for a table with no attendance', () => {
    const html =
      '<table id="tmtab_1"><tr class="uis-hl-table"><td></td><td><a href="/auth/katalog/syllabus.pl?predmet=1">X Test</a></td></tr></table>';
    expect(parseAttendance(html)).toEqual({});
  });
});
