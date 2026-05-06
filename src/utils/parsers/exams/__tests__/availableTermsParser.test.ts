import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseExamData } from '../index';

// Minimal table_2 fixture faithful to real IS Mendelu available-terms HTML.
// Columns: Poř. | Kód | Předmět | Datum | Kde | Sekce | Vypsal | Obsazenost | Typ | Přihlašování | Info
function wrapInPage(table2Rows: string): string {
    return `<html><body>
        <table id="table_1"><thead><tr class="zahlavi">
            <th>Poř.</th><th>Kód</th><th>Předmět</th><th>Datum termínu</th>
            <th>Kde</th><th>Druh (forma)</th><th>Vypsal</th><th>Přihlášeno</th>
            <th>Typ termínu</th><th>Přihlašování od<br>do<br>Odhlášení do</th>
            <th>Info</th>
        </tr></thead><tbody></tbody></table>
        <table id="table_2"><thead><tr class="zahlavi">
            <th>Poř.</th><th>Kód</th><th>Předmět</th><th>Datum termínu</th>
            <th>Kde</th><th>Druh (forma)</th><th>Vypsal</th><th>Přihlášeno</th>
            <th>Typ termínu</th><th>Přihlašování od<br>do<br>Odhlášení do</th>
            <th>Info</th>
        </tr></thead><tbody>${table2Rows}</tbody></table>
    </body></html>`;
}

// Minimal available-term row with standard capacity "5/20".
const ROW_NORMAL_CAPACITY = `
<tr class="uis-hl-table lbn">
    <td>1.</td>
    <td>EBA-AJII</td>
    <td>Angličtina pro IS/ICT</td>
    <td nowrap="1">15.05.2026 09:00 (pá)</td>
    <td nowrap="1">B1/208</td>
    <td nowrap="1">zkouška</td>
    <td nowrap="nowrap"><a href="/auth/lide/clovek.pl?id=12345">J. Novák</a></td>
    <td align="center" nowrap="1">5/20</td>
    <td align="center"><img alt="řádný" title="řádný"></td>
    <td align="center">01.05.2026 08:00<br>14.05.2026 23:00<br>14.05.2026 23:00</td>
    <td><a href="/auth/student/terminy_info.pl?termin=999001">Info</a></td>
</tr>`;

// Real-world row (observed 2026-05-06) where IS Mendelu appends waitlist size
// in parentheses: "0/12(8)" means 0 enrolled, 12 capacity, 8 on waitlist.
// This caused a NaN parse error before the fix.
const ROW_WAITLIST_CAPACITY = `
<tr class="uis-hl-table lbn">
    <td>1.</td>
    <td>EBA-AJII</td>
    <td>Angličtina pro IS/ICT</td>
    <td nowrap="1">15.05.2026 09:00 (pá)</td>
    <td nowrap="1">B1/208</td>
    <td nowrap="1">zkouška</td>
    <td nowrap="nowrap"><a href="/auth/lide/clovek.pl?id=12345">J. Novák</a></td>
    <td align="center" nowrap="1">0/12(8)</td>
    <td align="center"><img alt="řádný" title="řádný"></td>
    <td align="center">01.05.2026 08:00<br>14.05.2026 23:00<br>14.05.2026 23:00</td>
    <td><a href="/auth/student/terminy_info.pl?termin=999002">Info</a></td>
</tr>`;

// Full with waitlist: "12/12(3)" — should be marked full.
const ROW_FULL_WAITLIST_CAPACITY = `
<tr class="uis-hl-table lbn">
    <td>1.</td>
    <td>EBA-AJII</td>
    <td>Angličtina pro IS/ICT</td>
    <td nowrap="1">16.05.2026 09:00 (so)</td>
    <td nowrap="1">B1/208</td>
    <td nowrap="1">zkouška</td>
    <td nowrap="nowrap"><a href="/auth/lide/clovek.pl?id=12345">J. Novák</a></td>
    <td align="center" nowrap="1">12/12(3)</td>
    <td align="center"><img alt="řádný" title="řádný"></td>
    <td align="center">01.05.2026 08:00<br>15.05.2026 23:00<br>15.05.2026 23:00</td>
    <td><a href="/auth/student/terminy_info.pl?termin=999003">Info</a></td>
</tr>`;

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));
vi.mock('@/utils/reportError', () => ({ reportError }));

describe('availableTermsParser — capacity formats', () => {
    beforeEach(() => vi.clearAllMocks());

    it('parses standard "occupied/total" capacity', () => {
        const result = parseExamData(wrapInPage(ROW_NORMAL_CAPACITY), 'cz');
        const terms = result.flatMap(s => s.sections.flatMap(sec => sec.terms));
        expect(terms).toHaveLength(1);
        expect(terms[0].capacity).toEqual({ occupied: 5, total: 20, raw: '5/20' });
        expect(terms[0].full).toBe(false);
    });

    it('parses waitlist capacity "0/12(8)" without error and marks not full', () => {
        const result = parseExamData(wrapInPage(ROW_WAITLIST_CAPACITY), 'cz');
        const terms = result.flatMap(s => s.sections.flatMap(sec => sec.terms));
        expect(terms).toHaveLength(1);
        // total must be 12, not 0 (the bug: Number('12(8)') === NaN → was clamped to 0)
        expect(terms[0].capacity).toEqual({ occupied: 0, total: 12, raw: '0/12(8)' });
        expect(terms[0].full).toBe(false);
        expect(reportError).not.toHaveBeenCalled();
    });

    it('marks "12/12(3)" as full', () => {
        const result = parseExamData(wrapInPage(ROW_FULL_WAITLIST_CAPACITY), 'cz');
        const terms = result.flatMap(s => s.sections.flatMap(sec => sec.terms));
        expect(terms).toHaveLength(1);
        expect(terms[0].capacity).toEqual({ occupied: 12, total: 12, raw: '12/12(3)' });
        expect(terms[0].full).toBe(true);
    });
});
