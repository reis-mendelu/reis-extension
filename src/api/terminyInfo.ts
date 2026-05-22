import { BASE_URL, fetchWithAuth } from './client';
import { logError } from '../utils/reportError';
import type { Classmate } from '../types/classmates';

/**
 * Teacher's "Poznámka" (note) attached to an exam term in IS Mendelu.
 * `isEmphasized` mirrors IS's own red-text styling — teachers use it to flag
 * critical rules (e.g. "AI use = automatic F"). Preserve that signal in the UI.
 */
export interface TermNote {
    text: string;
    isEmphasized: boolean;
}

/**
 * True if the doc looks like a real terminy_info.pl detail page (not a login
 * redirect or error stub). Used to gate caching — we never persist a parse
 * result from a page that didn't actually load.
 *
 * Anchors on the active breadcrumb element rather than a substring search,
 * since the substring also appears in sidebar/nav chrome on degraded pages
 * — caching null from one of those would hide a real Poznámka for 6h.
 * Verified against 5 real IS Mendelu samples (2026-05).
 */
export function isTermDetailPage(doc: Document): boolean {
    const crumb = doc.querySelector('li.breadcrumb-item.active[aria-current="page"] span');
    const text = (crumb?.textContent ?? '').replace(/ /g, ' ').trim();
    return text === 'Informace o termínu' || text === 'Information about exam date';
}

/**
 * Parse the teacher's Poznámka block from a terminy_info.pl detail page.
 *
 * Real markup (verified against 5 IS Mendelu samples, 2026-05):
 *   <td><b>Poznámka:</b></td>
 *   <td>[-- nezadáno --]  OR  <span style="color: red;">…note text…</span>  OR  plain text</td>
 *
 * Returns null when no Poznámka row, or when the value is an IS empty sentinel
 * ("-- nezadáno --" / "-- not specified --" / any "-- … --"). Tolerant to
 * variations in whitespace, colons, and inline styling.
 */
export function parseTermNotePage(doc: Document): TermNote | null {
    const labels = doc.querySelectorAll('td b');
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const labelText = label.textContent?.trim() ?? '';
        // Exact label match per real CZ + EN samples (terminy-info-339715{,_-en}.html).
        if (labelText !== 'Poznámka:' && labelText !== 'Note:') continue;

        const labelCell = label.closest('td');
        const valueCell = labelCell?.nextElementSibling as Element | null;
        if (!valueCell) continue;

        // Normalize NBSPs to regular spaces; collapse only trailing whitespace.
        const raw = (valueCell.textContent ?? '').replace(/ /g, ' ');
        const text = raw.replace(/[ \t]+$/gm, '').trim();

        if (!text) return null;
        // IS empty sentinels — exact match only. The previous structural regex
        // /^--\s.+\s--$/ also matched teacher-authored emphasis like '-- READ THIS --'
        // and silently hid those notes.
        if (text === '-- nezadáno --' || text === '-- not specified --') return null;

        const isEmphasized = !!valueCell.querySelector(
            'span[style*="color: red"], span[style*="color:red"]'
        );
        return { text, isEmphasized };
    }
    return null;
}

/**
 * Parse one exam-classmates page.
 *
 * Row layout (live, 5 cells): [order, name(link), studyInfo, date, emailLink].
 * The historical scraper saw 6 cells because of a hidden UISTMNumber column —
 * we rely on the name<->clovek.pl link to anchor parsing rather than column
 * indices, so the parser tolerates either shape.
 *
 * Guard: if a Jméno-headed table is found with content rows but zero
 * classmates parse, report once via telemetry so DOM drift surfaces in
 * data instead of intuition. Per CLAUDE.md parser rules we do NOT relax
 * the parser — we report and return [].
 */
export function parseExamClassmatesPage(doc: Document): Classmate[] {
    const tables = doc.getElementsByTagName('table');

    for (let t = 0; t < tables.length; t++) {
        const rows = tables[t].getElementsByTagName('tr');
        if (rows.length < 2) continue;
        const headerTexts = Array.from(rows[0].getElementsByTagName('th'))
            .map((c: Element) => c.textContent ?? '');
        if (!headerTexts.some(h => h.includes('Jméno'))) continue;

        const result: Classmate[] = [];
        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].getElementsByTagName('td');
            if (cells.length < 5) continue;

            // Anchor on the clovek.pl link in any cell — tolerates both 5-cell
            // (live) and 6-cell (scraper) layouts without column-index drift.
            const nameLink = rows[i].querySelector<HTMLAnchorElement>('a[href*="clovek.pl"]');
            if (!nameLink) continue;

            const idMatch = nameLink.getAttribute('href')?.match(/id=(\d+)/);
            if (!idMatch) continue;

            const personId = parseInt(idMatch[1], 10);
            const name = nameLink.textContent?.trim() ?? '';
            if (!name) continue;

            // studyInfo is the cell directly after the name's parent cell.
            const nameCell = nameLink.closest('td');
            const studyCell = nameCell?.nextElementSibling as HTMLElement | null;
            const studyInfo = studyCell?.textContent?.trim() ?? '';

            const msgLink = rows[i].querySelector<HTMLAnchorElement>('a[href*="nova_zprava.pl"]');
            const messageUrl = msgLink?.getAttribute('href') ?? undefined;
            const photoUrl = `${BASE_URL}/auth/lide/foto.pl?id=${personId};lang=cz`;

            result.push({ personId, name, photoUrl, studyInfo, messageUrl });
        }

        if (result.length === 0 && rows.length > 1) {
            const hasContent = Array.from(rows).slice(1).some(
                r => (r.textContent?.trim().length ?? 0) > 0,
            );
            if (hasContent) {
                logError(
                    'Parser.parseExamClassmatesPage',
                    new Error('exam spoluzaci table has rows but zero parsed'),
                    { rowCount: rows.length },
                );
            }
        }
        return result;
    }
    return [];
}

export async function fetchExamClassmates(
    terminId: string,
    studiumId: string,
    obdobiId: string,
): Promise<Classmate[]> {
    const url = `${BASE_URL}/auth/student/terminy_info.pl?termin=${terminId};spoluzaci=1;studium=${studiumId};obdobi=${obdobiId};lang=cz`;
    try {
        const res = await fetchWithAuth(url);
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        return parseExamClassmatesPage(doc);
    } catch (e) {
        logError('Api.fetchExamClassmates', e, { terminId });
        throw e;
    }
}

/**
 * Fetch the teacher's Poznámka for a single exam term. Throws if the page
 * doesn't look like a real detail page (e.g. session expired → login redirect)
 * so the caller knows not to cache the result. Returns null when the page
 * loaded fine but no note is set on this term.
 */
export async function fetchTermNote(
    terminId: string,
    studiumId: string,
    obdobiId: string,
    lang: 'cz' | 'en' = 'cz',
): Promise<TermNote | null> {
    const url = `${BASE_URL}/auth/student/terminy_info.pl?termin=${terminId};studium=${studiumId};obdobi=${obdobiId};lang=${lang}`;
    try {
        const res = await fetchWithAuth(url);
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        if (!isTermDetailPage(doc)) {
            throw new Error('terminy_info.pl did not return a detail page (likely auth redirect)');
        }
        return parseTermNotePage(doc);
    } catch (e) {
        logError('Api.fetchTermNote', e, { terminId });
        throw e;
    }
}
