import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseUbytovani } from '../ubytovani';

const FIXTURE = readFileSync(
    resolve(__dirname, '../../../../../.agent/fixtures/webiskam/ubytovani.html'),
    'utf-8'
);

describe('parseUbytovani', () => {
    it('returns only Ubytovaný + Rezervace rows', () => {
        const rows = parseUbytovani(FIXTURE);
        const statuses = rows.map(r => r.status);
        expect(statuses).toContain('Ubytovaný');
        expect(statuses).toContain('Rezervace');
        expect(statuses.every(s => s === 'Ubytovaný' || s === 'Rezervace')).toBe(true);
    });

    it('extracts dorm, block, room, dates per row', () => {
        const rows = parseUbytovani(FIXTURE);
        const current = rows.find(r => r.status === 'Ubytovaný');
        expect(current).toBeDefined();
        expect(current!.dorm).toBe('Kolej Akademie');
        expect(current!.block).toBe('KA');
        expect(current!.room).toBe('462');
        expect(current!.startDate).toBe('1.9.2025');
        expect(current!.endDate).toBe('30.6.2026');
    });

    it('captures contract href on rows that have one', () => {
        const rows = parseUbytovani(FIXTURE);
        const reservation = rows.find(r => r.status === 'Rezervace');
        expect(reservation?.contractHref).toMatch(/^\/PrehledUbytovani\/SmlouvaKUbytovani\//);
    });

    it('returns empty array when the table is missing', () => {
        expect(parseUbytovani('<html><body>no table</body></html>')).toEqual([]);
    });
});
