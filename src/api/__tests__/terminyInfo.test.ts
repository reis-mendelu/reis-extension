import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/reportError', () => ({
    logError: vi.fn(),
}));

vi.mock('../client', () => ({
    BASE_URL: 'https://is.mendelu.cz',
    fetchWithAuth: vi.fn(),
}));

import { parseExamClassmatesPage } from '../terminyInfo';
import { logError } from '../../utils/reportError';

const wrapDoc = (tableHtml: string): Document =>
    new DOMParser().parseFromString(
        `<!doctype html><html><body>${tableHtml}</body></html>`,
        'text/html',
    );

const HEADER_5 = `<tr><th>#</th><th>Jméno</th><th>Studium</th><th>Datum</th><th>Email</th></tr>`;

const ROW_5 = (id: number, name: string, studyInfo: string, hasMessage = true) => `
    <tr>
        <td>1.</td>
        <td><a href="/auth/lide/clovek.pl?id=${id};lang=cz">${name}</a></td>
        <td>${studyInfo}</td>
        <td>14.04.2026 09:00</td>
        <td>${hasMessage ? `<a href="/auth/posta/nova_zprava.pl?adresat=${id}"><img alt="x@y" /></a>` : ''}</td>
    </tr>
`;

describe('parseExamClassmatesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns [] when no Jméno-headed table exists', () => {
        const doc = wrapDoc('<table><tr><th>Foo</th></tr></table>');
        expect(parseExamClassmatesPage(doc)).toEqual([]);
        expect(logError).not.toHaveBeenCalled();
    });

    it('extracts personId/name/photoUrl/studyInfo/messageUrl from a normal roster', () => {
        const doc = wrapDoc(`
            <table>
                ${HEADER_5}
                ${ROW_5(123456, 'Jan Novák', 'PEF B-OI prez [sem 2, roč 1]')}
                ${ROW_5(789012, 'Marie Svobodová', 'PEF B-EM komb [sem 4, roč 2]', false)}
            </table>
        `);

        const result = parseExamClassmatesPage(doc);
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            personId: 123456,
            name: 'Jan Novák',
            studyInfo: 'PEF B-OI prez [sem 2, roč 1]',
        });
        expect(result[0].photoUrl).toContain('foto.pl?id=123456');
        expect(result[0].messageUrl).toContain('nova_zprava.pl?adresat=123456');

        expect(result[1].personId).toBe(789012);
        expect(result[1].messageUrl).toBeUndefined();

        expect(logError).not.toHaveBeenCalled();
    });

    it('returns [] without logging when table has only header (empty exam)', () => {
        const doc = wrapDoc(`<table>${HEADER_5}</table>`);
        expect(parseExamClassmatesPage(doc)).toEqual([]);
        expect(logError).not.toHaveBeenCalled();
    });

    it('triggers Parser.parseExamClassmatesPage logError when table has content rows but zero parsed', () => {
        const doc = wrapDoc(`
            <table>
                ${HEADER_5}
                <tr><td>1.</td><td>broken row no link</td><td>x</td><td>y</td><td>z</td></tr>
                <tr><td>2.</td><td>another broken</td><td>x</td><td>y</td><td>z</td></tr>
            </table>
        `);

        const result = parseExamClassmatesPage(doc);
        expect(result).toEqual([]);
        expect(logError).toHaveBeenCalledTimes(1);
        expect(vi.mocked(logError).mock.calls[0][0]).toBe('Parser.parseExamClassmatesPage');
    });
});
