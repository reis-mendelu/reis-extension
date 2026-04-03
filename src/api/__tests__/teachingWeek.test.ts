import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/storage/IndexedDBService', () => ({
    IndexedDBService: {}
}));

import { parseTeachingWeeks, getWeekForDate } from '../teachingWeek';

const SAMPLE_HTML = `
<b>Období: LS 2025/2026 - PEF, 16. 2. 2026 - 15. 5. 2026</b>
<table id="tmtab_1">
<thead><tr class="zahlavi"><th>Poř.</th><th>Číslo týdne</th><th>Od</th><th>Do</th><th>Kalendářní týden</th></tr></thead>
<tbody>
<tr><td><small></small></td><td class="odsazena">1. týden</td><td class="odsazena">16.02.2026</td><td class="odsazena">22.02.2026</td><td class="odsazena">sudý</td></tr>
<tr><td><small></small></td><td class="odsazena">6. týden</td><td class="odsazena">23.03.2026</td><td class="odsazena">29.03.2026</td><td class="odsazena">lichý</td></tr>
<tr><td><small></small></td><td class="odsazena"><b>7. týden</b></td><td class="odsazena"><b>30.03.2026</b></td><td class="odsazena"><b>05.04.2026</b></td><td class="odsazena"><b>sudý</b></td></tr>
<tr><td><small></small></td><td class="odsazena">13. týden</td><td class="odsazena">11.05.2026</td><td class="odsazena">17.05.2026</td><td class="odsazena">sudý</td></tr>
</tbody>
</table>`;

describe('parseTeachingWeeks', () => {
    it('parses all week rows with date ranges', () => {
        const result = parseTeachingWeeks(SAMPLE_HTML);
        expect(result).not.toBeNull();
        expect(result!.total).toBe(4);
        expect(result!.weeks[0]).toEqual({ week: 1, from: '2026-02-16', to: '2026-02-22' });
        expect(result!.weeks[2]).toEqual({ week: 7, from: '2026-03-30', to: '2026-04-05' });
    });

    it('returns null for empty/login page', () => {
        expect(parseTeachingWeeks('<html><title>Přihlášení</title></html>')).toBeNull();
    });
});

describe('getWeekForDate', () => {
    const data = parseTeachingWeeks(SAMPLE_HTML)!;

    it('returns week number for a date within a week range', () => {
        expect(getWeekForDate(data, new Date('2026-03-31'))).toBe(7);
    });

    it('returns week number for range start date', () => {
        expect(getWeekForDate(data, new Date('2026-02-16'))).toBe(1);
    });

    it('returns week number for range end date', () => {
        expect(getWeekForDate(data, new Date('2026-02-22'))).toBe(1);
    });

    it('returns null for a date outside any teaching week', () => {
        expect(getWeekForDate(data, new Date('2026-01-01'))).toBeNull();
    });

    it('returns null for a gap between weeks', () => {
        // March 1 is between week 1 (ends Feb 22) and week 6 (starts March 23)
        expect(getWeekForDate(data, new Date('2026-03-01'))).toBeNull();
    });
});
