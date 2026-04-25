import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseKonta } from '../konta';

const FIXTURE = readFileSync(
    resolve(__dirname, '../../../../../.agent/fixtures/webiskam/konta.html'),
    'utf-8'
);

describe('parseKonta', () => {
    it('returns the three account rows from the fixture', () => {
        const rows = parseKonta(FIXTURE, 'cz');
        expect(rows).toHaveLength(3);
        expect(rows.map(r => r.name)).toEqual(['Hlavní konto', 'Ubytovací kauce', 'Rezervační kauce']);
    });

    it('parses balances as numbers and preserves Czech formatting in balanceText', () => {
        const rows = parseKonta(FIXTURE, 'cz');
        expect(rows[0].balance).toBeCloseTo(834.07, 2);
        expect(rows[0].balanceText).toBe('834,07 Kč');
        expect(rows[1].balance).toBe(0);
        expect(rows[2].balance).toBe(5000);
        expect(rows[2].balanceText).toBe('5 000 Kč');
    });

    it('captures the Nabít deep link href when present, null otherwise', () => {
        const rows = parseKonta(FIXTURE, 'cz');
        expect(rows[0].topUpHref).toBe('/Platby/NabitiKonta/0');
        expect(rows[1].topUpHref).toBeNull();
        expect(rows[2].topUpHref).toBe('/Platby/NabitiKonta/2');
    });

    it('tags name with the requested language', () => {
        const cz = parseKonta(FIXTURE, 'cz');
        expect(cz[0].nameCs).toBe('Hlavní konto');
        expect(cz[0].nameEn).toBeUndefined();
    });

    it('returns empty array for non-konta HTML', () => {
        expect(parseKonta('<html><body><p>nothing</p></body></html>')).toEqual([]);
    });
});
