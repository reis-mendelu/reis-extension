import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSkmDocuments } from '../skmDocuments';

const FIXTURE = readFileSync(
    resolve(__dirname, '../../../../../.agent/fixtures/skm-dokumenty.html'),
    'utf-8'
);

describe('parseSkmDocuments', () => {
    it('returns 19 documents from fixture', () => {
        expect(parseSkmDocuments(FIXTURE)).toHaveLength(19);
    });

    it('parses label and href correctly', () => {
        const docs = parseSkmDocuments(FIXTURE);
        const cenik = docs.find(d => d.label.includes('20.3.2026'));
        expect(cenik).toBeDefined();
        expect(cenik!.href).toContain('is.mendelu.cz/dok_server');
        expect(cenik!.href).toContain('download=293647');
    });

    it('returns empty array for HTML with no matching links', () => {
        expect(parseSkmDocuments('<html><body><p>nothing</p></body></html>')).toEqual([]);
    });
});
