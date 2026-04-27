import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseKontaTransactions } from '../kontaTransactions';

const FIXTURE = readFileSync(
    resolve(__dirname, '../../../../../.agent/fixtures/webiskam/konta-transactions-stravovaci.html'),
    'utf-8'
);

describe('parseKontaTransactions', () => {
    it('returns 4 data rows, skipping pohledavka-poznamka and header/footer', () => {
        const rows = parseKontaTransactions(FIXTURE);
        expect(rows).toHaveLength(4);
    });

    it('parses an Úhrada row correctly', () => {
        const rows = parseKontaTransactions(FIXTURE);
        const soup = rows.find(r => r.description === 'Polévka rajská s rýží');
        expect(soup).toBeDefined();
        expect(soup!.type).toBe('Úhrada');
        expect(soup!.settledDate).toBe('27.4.2026');
        expect(soup!.payment).toBeCloseTo(12, 2);
        expect(soup!.topUp).toBeNull();
        expect(soup!.balance).toBeCloseTo(588, 2);
    });

    it('parses decimal payment amounts', () => {
        const rows = parseKontaTransactions(FIXTURE);
        const food = rows.find(r => r.description.includes('Jídlo na váhu'));
        expect(food).toBeDefined();
        expect(food!.payment).toBeCloseTo(165.43, 2);
    });

    it('parses a Převod row with topUp non-null and payment null', () => {
        const rows = parseKontaTransactions(FIXTURE);
        const prevod = rows.find(r => r.type === 'Převod');
        expect(prevod).toBeDefined();
        expect(prevod!.topUp).toBeCloseTo(600, 2);
        expect(prevod!.payment).toBeNull();
    });

    it('returns empty array for HTML with no matching table', () => {
        expect(parseKontaTransactions('<html><body><p>nothing</p></body></html>')).toEqual([]);
    });
});
