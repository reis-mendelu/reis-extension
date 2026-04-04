import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/storage/IndexedDBService', () => ({
    IndexedDBService: {}
}));

import { parseAttendance } from '../subjects';

const FIXTURE = `
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

describe('parseAttendance', () => {
    it('parses attendance from sub-rows grouped by subject code', () => {
        const result = parseAttendance(FIXTURE);

        expect(result['EBC-AOS']).toBeDefined();
        expect(result['EBC-AOS']).toHaveLength(1);
        expect(result['EBC-AOS'][0].label).toContain('Cv');
        expect(result['EBC-AOS'][0].label).toContain('Q47');
        expect(result['EBC-AOS'][0].records).toHaveLength(4);
        expect(result['EBC-AOS'][0].records[0]).toEqual({
            date: '26. 2. 2026',
            time: '11.00-12.50',
            room: 'Q47',
            status: 'present',
        });
        expect(result['EBC-AOS'][0].records[2].status).toBe('absent');
        expect(result['EBC-AOS'][0].records[3].status).toBe('excused');
    });

    it('returns empty object for no attendance data', () => {
        const html = '<table id="tmtab_1"><tr class="uis-hl-table"><td></td><td><a href="/auth/katalog/syllabus.pl?predmet=1">X Test</a></td></tr></table>';
        expect(parseAttendance(html)).toEqual({});
    });

    it('skips subjects with no sub-rows', () => {
        const result = parseAttendance(FIXTURE);
        expect(result['EBC-MT']).toBeUndefined();
    });
});
