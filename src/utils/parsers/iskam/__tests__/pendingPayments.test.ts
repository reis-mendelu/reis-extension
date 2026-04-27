import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePendingPayments } from '../pendingPayments';

const FIXTURE = readFileSync(
    resolve(__dirname, '../../../../../.agent/fixtures/webiskam/informaceoklientovi.html'),
    'utf-8'
);

describe('parsePendingPayments', () => {
    it('parses one payment row and excludes the total row', () => {
        const rows = parsePendingPayments(FIXTURE);
        expect(rows).toHaveLength(1);
    });

    it('captures dueDate, description, and amount', () => {
        const [row] = parsePendingPayments(FIXTURE);
        expect(row.dueDate).toBe('20.10.2025');
        expect(row.description).toBe('Dobití konta STRAVOVACÍ KONTO');
        expect(row.amount).toBe('600 Kč');
    });

    it('returns empty array when table is absent', () => {
        expect(parsePendingPayments('<html><body><p>nothing</p></body></html>')).toEqual([]);
    });

    it('returns empty array when tbody has no data rows', () => {
        const html = `<table id="PozadavkyNaUhradyTable"><tbody>
            <tr><td class="bold" colspan="2">Celkem</td><td>0 Kč</td><td></td></tr>
        </tbody></table>`;
        expect(parsePendingPayments(html)).toEqual([]);
    });
});
