import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/storage/IndexedDBService', () => ({
    IndexedDBService: {},
}));

vi.mock('../../utils/reportError', () => ({
    logError: vi.fn(),
}));

import { parseClassmatesPage } from '../classmates';
import { logError } from '../../utils/reportError';

const wrapDoc = (tableHtml: string): Document =>
    new DOMParser().parseFromString(
        `<!doctype html><html><body>${tableHtml}</body></html>`,
        'text/html',
    );

const ROW = (id: number, name: string, studyInfo: string, hasMessage = true) => `
    <tr>
        <td><a href="/auth/lide/clovek.pl?id=${id};lang=cz"><img src="/auth/lide/foto.pl?id=${id};lang=cz"></a></td>
        <td><a href="/auth/lide/clovek.pl?id=${id};lang=cz">${name}</a></td>
        <td>${studyInfo}</td>
        <td>${hasMessage ? `<a href="/auth/posta/nova_zprava.pl?adresat=${id}">msg</a>` : ''}</td>
    </tr>
`;

const HEADER_ROW = `<tr><th>Foto</th><th>Jméno</th><th>Studium</th><th>Zpráva</th></tr>`;

describe('parseClassmatesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns [] when no #tmtab_1 table exists', () => {
        const doc = wrapDoc('<div>no table here</div>');
        expect(parseClassmatesPage(doc)).toEqual([]);
        expect(logError).not.toHaveBeenCalled();
    });

    it('extracts personId, name, photoUrl, studyInfo, messageUrl from a normal roster', () => {
        const doc = wrapDoc(`
            <table id="tmtab_1">
                ${HEADER_ROW}
                ${ROW(123456, 'Jan Novák', 'PEF B-OI-ZBOI prez [sem 2, roč 1]')}
                ${ROW(789012, 'Marie Svobodová', 'PEF B-EM komb [sem 4, roč 2]', false)}
            </table>
        `);

        const result = parseClassmatesPage(doc);
        expect(result).toHaveLength(2);

        expect(result[0]).toMatchObject({
            personId: 123456,
            name: 'Jan Novák',
            studyInfo: 'PEF B-OI-ZBOI prez [sem 2, roč 1]',
        });
        expect(result[0].photoUrl).toContain('foto.pl?id=123456');
        expect(result[0].messageUrl).toContain('nova_zprava.pl?adresat=123456');

        expect(result[1].personId).toBe(789012);
        expect(result[1].messageUrl).toBeUndefined();

        expect(logError).not.toHaveBeenCalled();
    });

    it('returns [] without logging when table is empty (no content rows)', () => {
        const doc = wrapDoc(`<table id="tmtab_1">${HEADER_ROW}</table>`);
        expect(parseClassmatesPage(doc)).toEqual([]);
        expect(logError).not.toHaveBeenCalled();
    });

    it('triggers Parser.parseClassmatesPage logError when table has content rows but zero parsed', () => {
        // Row exists with content but no clovek.pl link — guard should fire.
        const doc = wrapDoc(`
            <table id="tmtab_1">
                ${HEADER_ROW}
                <tr><td>Something</td><td>without proper links</td><td>x</td><td>y</td></tr>
                <tr><td>Another</td><td>broken row</td><td>z</td><td>w</td></tr>
            </table>
        `);

        const result = parseClassmatesPage(doc);
        expect(result).toEqual([]);
        expect(logError).toHaveBeenCalledTimes(1);
        expect(vi.mocked(logError).mock.calls[0][0]).toBe('Parser.parseClassmatesPage');
    });

    it('does NOT log when the table has only a header row (truly empty seminar)', () => {
        const doc = wrapDoc(`<table id="tmtab_1"><tr><th>h1</th></tr></table>`);
        expect(parseClassmatesPage(doc)).toEqual([]);
        expect(logError).not.toHaveBeenCalled();
    });
});
