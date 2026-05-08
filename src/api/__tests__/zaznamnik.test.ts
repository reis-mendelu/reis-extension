import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePhPage, parseVtPage } from '../zaznamnik';

const fixture = (name: string) =>
    readFileSync(resolve(__dirname, 'fixtures/zaznamnik', name), 'utf-8');

const PH_WITH_DATA = fixture('ph-with-data.html');
const PH_SLUCKA = fixture('ph-slucka-column.html');
const PH_EMPTY = fixture('ph-empty.html');
const PH_PRIOR = fixture('ph-prior-semester.html');

const VT_WITH_TESTS = fixture('vt-with-tests.html');
const VT_NO_TESTS = fixture('vt-no-tests.html');
const VT_POR = fixture('vt-with-por-column.html');
const VT_PRIOR = fixture('vt-prior-semester.html');

describe('parsePhPage', () => {
    it('returns empty sections when the page has no headings', () => {
        const result = parsePhPage('<html><body><p>nothing here</p></body></html>');
        expect(result.sections).toEqual([]);
        expect(typeof result.fetchedAt).toBe('number');
    });

    it('parses a real PH page into sections + arches', () => {
        const result = parsePhPage(PH_WITH_DATA);
        expect(result.sections.length).toBeGreaterThan(0);
        for (const section of result.sections) {
            expect(section.label.length).toBeGreaterThan(0);
            for (const arch of section.arches) {
                expect(arch.name.length).toBeGreaterThan(0);
                if (arch.empty) {
                    expect(arch.columns).toEqual([]);
                    expect(arch.values).toEqual([]);
                } else {
                    expect(arch.columns.length).toBe(arch.values.length);
                    expect(arch.columns.length).toBeGreaterThan(0);
                }
            }
        }
    });

    it('excludes the leading "Slučka" column from headers and values', () => {
        const result = parsePhPage(PH_SLUCKA);
        const archesWithData = result.sections.flatMap(s => s.arches).filter(a => !a.empty);
        expect(archesWithData.length).toBeGreaterThan(0);
        for (const arch of archesWithData) {
            expect(arch.columns[0]?.toLowerCase()).not.toBe('slučka');
        }
    });

    it('flags arches with the "nemáte dosud" empty marker as empty: true', () => {
        const result = parsePhPage(PH_EMPTY);
        const emptyArches = result.sections.flatMap(s => s.arches).filter(a => a.empty);
        expect(emptyArches.length).toBeGreaterThan(0);
        for (const arch of emptyArches) {
            expect(arch.columns).toEqual([]);
            expect(arch.values).toEqual([]);
        }
    });

    it('parses prior-semester PH pages without throwing', () => {
        const result = parsePhPage(PH_PRIOR);
        expect(result.sections.length).toBeGreaterThan(0);
        expect(typeof result.fetchedAt).toBe('number');
    });
});

describe('parseVtPage', () => {
    it('returns no tests when the page contains the no-tests message', () => {
        const result = parseVtPage(VT_NO_TESTS);
        expect(result.tests).toEqual([]);
        expect(typeof result.fetchedAt).toBe('number');
    });

    it('returns no tests when the page has no test results table', () => {
        const result = parseVtPage('<html><body><p>nothing here</p></body></html>');
        expect(result.tests).toEqual([]);
    });

    it('parses each row of a real VT page into a structured attempt', () => {
        const result = parseVtPage(VT_WITH_TESTS);
        expect(result.tests.length).toBeGreaterThan(0);
        for (const t of result.tests) {
            expect(t.name.length).toBeGreaterThan(0);
            expect(Number.isFinite(t.score)).toBe(true);
            expect(Number.isFinite(t.maxScore)).toBe(true);
            expect(Number.isFinite(t.successPct)).toBe(true);
            expect(t.submittedAt.length).toBeGreaterThan(0);
            expect(typeof t.hasDetail).toBe('boolean');
        }
    });

    it('handles the optional leading "Poř." column via the dynamic column-index map', () => {
        const result = parseVtPage(VT_POR);
        expect(result.tests.length).toBeGreaterThan(0);
        // Column "Poř." would land at colMap[0] without offset handling, so verify
        // the test name (column "Název testu") is correctly resolved — not a numeric order.
        for (const t of result.tests) {
            expect(t.name).not.toMatch(/^\d+\.?$/);
        }
    });

    it('skips rows whose cells use colspan (typically summary/footer rows)', () => {
        const html = `
            <html><body>
              <table>
                <thead><tr><th>Název testu</th><th>Dosaženo bodů</th><th>Max. bodů</th><th>Úspěšnost</th><th>Odevzdáno</th><th>Správce</th></tr></thead>
                <tbody>
                  <tr><td>Test A</td><td>5</td><td>10</td><td>50</td><td>2026-05-01</td><td>Smith</td></tr>
                  <tr><td colspan="6">Footer summary</td></tr>
                </tbody>
              </table>
            </body></html>`;
        const result = parseVtPage(html);
        expect(result.tests.map(t => t.name)).toEqual(['Test A']);
    });

    it('parses prior-semester VT pages without throwing', () => {
        const result = parseVtPage(VT_PRIOR);
        for (const t of result.tests) {
            expect(t.name.length).toBeGreaterThan(0);
        }
        expect(typeof result.fetchedAt).toBe('number');
    });
});
