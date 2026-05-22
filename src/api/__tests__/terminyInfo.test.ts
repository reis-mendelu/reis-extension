import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/reportError', () => ({
    logError: vi.fn(),
}));

vi.mock('../client', () => ({
    BASE_URL: 'https://is.mendelu.cz',
    fetchWithAuth: vi.fn(),
}));

import { parseExamClassmatesPage, parseTermNotePage, isTermDetailPage } from '../terminyInfo';
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

// --- parseTermNotePage --------------------------------------------------------
// Markup samples taken verbatim from /root/reis-dev/reis-scraper/terminy-info-*.html
// (real IS Mendelu pages fetched 2026-05).

const NOTE_PAGE = (poznRow: string) => wrapDoc(`
    <table>
        <tr><th>Informace o termínu</th></tr>
        <tr><td><b>Termín pro předmět:</b></td><td>Databázové systémy</td></tr>
        ${poznRow}
    </table>
`);

describe('parseTermNotePage', () => {
    beforeEach(() => vi.clearAllMocks());

    it('extracts single-paragraph red-emphasized note', () => {
        const doc = NOTE_PAGE(`
            <tr><td class="odsazena"><b>Poznámka:</b></td>
                <td class="odsazena" style="text-align: justify">
                    <span style="color: red;">Zkouška se koná v posluchárně A01 v budově A!</span>
                </td>
            </tr>
        `);
        const result = parseTermNotePage(doc);
        expect(result).toEqual({
            text: 'Zkouška se koná v posluchárně A01 v budově A!',
            isEmphasized: true,
        });
    });

    it('preserves newlines in multi-paragraph notes', () => {
        const doc = NOTE_PAGE(`
            <tr><td><b>Poznámka:</b></td>
                <td><span style="color: red;">Nejprve proběhne praktická část.
Není povoleno používat AI.</span></td>
            </tr>
        `);
        const result = parseTermNotePage(doc);
        expect(result?.text).toContain('Nejprve proběhne praktická část.');
        expect(result?.text).toContain('Není povoleno používat AI.');
        expect(result?.isEmphasized).toBe(true);
    });

    it('returns null for the "-- nezadáno --" empty sentinel', () => {
        const doc = NOTE_PAGE(`
            <tr><td><b>Poznámka:</b></td><td>-- nezadáno --</td></tr>
        `);
        expect(parseTermNotePage(doc)).toBeNull();
    });

    it('returns null for the EN "-- not specified --" sentinel', () => {
        const doc = NOTE_PAGE(`
            <tr><td><b>Poznámka:</b></td><td>-- not specified --</td></tr>
        `);
        expect(parseTermNotePage(doc)).toBeNull();
    });

    it('returns null when no Poznámka row exists at all', () => {
        const doc = wrapDoc(`
            <table>
                <tr><th>Informace o termínu</th></tr>
                <tr><td><b>Termín pro předmět:</b></td><td>X</td></tr>
            </table>
        `);
        expect(parseTermNotePage(doc)).toBeNull();
    });

    it('handles plain (non-emphasized) note text', () => {
        const doc = NOTE_PAGE(`
            <tr><td><b>Poznámka:</b></td><td>Bring student ID.</td></tr>
        `);
        expect(parseTermNotePage(doc)).toEqual({
            text: 'Bring student ID.',
            isEmphasized: false,
        });
    });

    it('does NOT treat a teacher note wrapped in dashes as an empty sentinel', () => {
        // Regression: the old /^--\s.+\s--$/ regex falsely matched any
        // dash-wrapped emphasis a teacher might write.
        const doc = NOTE_PAGE(`
            <tr><td><b>Poznámka:</b></td><td>-- READ THIS --</td></tr>
        `);
        expect(parseTermNotePage(doc)).toEqual({
            text: '-- READ THIS --',
            isEmphasized: false,
        });
    });
});

describe('isTermDetailPage', () => {
    // Markup pattern verified against real IS Mendelu detail pages (2026-05).
    const CZ_CRUMB = `<li class="breadcrumb-item active" aria-current="page"><span>Informace o&nbsp;termínu</span></li>`;
    const EN_CRUMB = `<li class="breadcrumb-item active" aria-current="page"><span>Information about exam date</span></li>`;

    it('accepts a real CZ detail-page breadcrumb', () => {
        expect(isTermDetailPage(wrapDoc(CZ_CRUMB))).toBe(true);
    });

    it('accepts a real EN detail-page breadcrumb', () => {
        expect(isTermDetailPage(wrapDoc(EN_CRUMB))).toBe(true);
    });

    it('rejects a login-redirect page', () => {
        expect(isTermDetailPage(wrapDoc(`<form id="login">…</form>`))).toBe(false);
    });

    it('rejects a page that mentions the title in chrome but lacks the active breadcrumb', () => {
        // Defensive: a sidebar/nav link that happens to contain the title string
        // should not be enough to mark this as a detail page.
        const doc = wrapDoc(`
            <nav><a href="/terminy">Informace o&nbsp;termínu</a></nav>
            <div>session expired</div>
        `);
        expect(isTermDetailPage(doc)).toBe(false);
    });

    it('rejects an inactive breadcrumb (different page with the chip in nav history)', () => {
        const doc = wrapDoc(`
            <li class="breadcrumb-item"><span>Informace o&nbsp;termínu</span></li>
        `);
        expect(isTermDetailPage(doc)).toBe(false);
    });
});
