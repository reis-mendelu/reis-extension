import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/storage/IndexedDBService', () => ({
    IndexedDBService: {}
}));

import { parseTeachingWeek } from '../teachingWeek';

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

describe('parseTeachingWeek', () => {
    it('finds the current (bolded) week', () => {
        const result = parseTeachingWeek(SAMPLE_HTML);
        expect(result).toEqual({ current: 7, total: 4 });
    });

    it('returns null for empty/login page', () => {
        expect(parseTeachingWeek('<html><title>Přihlášení</title></html>')).toBeNull();
    });

    it('returns null when no bold row exists', () => {
        const noBold = SAMPLE_HTML.replace(/<b>/g, '').replace(/<\/b>/g, '');
        expect(parseTeachingWeek(noBold)).toBeNull();
    });
});
