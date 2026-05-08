import { logError } from '../utils/reportError';
import type { SubjectZaznamnik, SubjectPh, SubjectVt, PhSection, PhArch, VtTestAttempt } from '../types/zaznamnik';

const BASE = 'https://is.mendelu.cz';

function parseCzechFloat(text: string): number {
    const n = parseFloat(text.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

function normalizeText(el: Element | Node | null | undefined): string {
    return ((el as Element | null)?.textContent ?? '').replace(/ /g, ' ').trim();
}

function isSectionHeading(el: Element): boolean {
    const t = el.tagName;
    return (t === 'BIG' || t === 'H2' || t === 'H3' || t === 'H4') && !!el.querySelector('b, strong');
}

// Returns the arch name if el looks like an arch name marker, null otherwise.
// Only checks direct bold children — avoids false matches on bold values inside table cells.
function extractArchName(el: Element): string | null {
    const t = el.tagName;
    if (t === 'B' || t === 'STRONG') return normalizeText(el) || null;
    const bold = Array.from(el.children).find(c => c.tagName === 'B' || c.tagName === 'STRONG') ?? null;
    if (bold) return normalizeText(bold) || null;
    return null;
}

// Returns true if this element (or its adjacent text siblings) signals "no data yet".
function isEmptyState(el: Element): boolean {
    const text = (el.textContent ?? '').replace(/ /g, ' ');
    if (text.includes('nemáte dosud')) return true;
    // Bare bold: empty state text is in a following text/BR node, not inside the element itself
    if (el.tagName === 'B' || el.tagName === 'STRONG') {
        const s1 = el.nextSibling;
        const s2 = s1?.nextSibling;
        return [(s1?.textContent ?? ''), (s2?.textContent ?? '')].join(' ')
            .replace(/ /g, ' ').includes('nemáte dosud');
    }
    return false;
}

function parseArchTable(table: Element): { columns: string[]; values: string[] } {
    const headers = Array.from(table.querySelectorAll('thead th, tr.zahlavi th'));
    // "Slučka" is a teacher-side row discriminator present only in summation arches.
    // Skip it only when it actually appears as the first header.
    const hasSlucka = normalizeText(headers[0]).toLowerCase() === 'slučka';

    const columns: string[] = [];
    headers.forEach((th, i) => {
        if (hasSlucka && i === 0) return;
        columns.push(normalizeText(th));
    });

    const firstRow = table.querySelector('tbody tr');
    const cells = firstRow ? Array.from(firstRow.querySelectorAll('td')) : [];
    const values: string[] = [];
    cells.forEach((td, i) => {
        if (hasSlucka && i === 0) return;
        values.push(normalizeText(td));
    });

    return { columns, values };
}

export function parsePhPage(html: string): SubjectPh {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const sections: PhSection[] = [];

    const sectionHeadings = Array.from(doc.querySelectorAll('big b, h2 b, h3 b, h4 b'))
        .map(b => b.parentElement!)
        .filter(el => isSectionHeading(el));

    if (sectionHeadings.length === 0) {
        return { sections: [], fetchedAt: Date.now() };
    }

    for (const heading of sectionHeadings) {
        const label = normalizeText(heading);
        const arches: PhArch[] = [];

        let cur: Element | null = heading.nextElementSibling;
        while (cur && !isSectionHeading(cur)) {
            const archName = extractArchName(cur);
            if (!archName) { cur = cur.nextElementSibling; continue; }

            if (isEmptyState(cur)) {
                arches.push({ name: archName, empty: true, columns: [], values: [] });
                cur = cur.nextElementSibling;
                continue;
            }

            // Find the table in following siblings; also look one level inside wrappers.
            // Stop at the next arch marker or section heading.
            let table: Element | null = null;
            let next = cur.nextElementSibling;
            while (next && !isSectionHeading(next)) {
                if (next.tagName === 'TABLE') { table = next; break; }
                const inner = next.querySelector('table');
                if (inner) { table = inner; break; }
                if (extractArchName(next)) break;
                next = next.nextElementSibling;
            }

            if (table) {
                const { columns, values } = parseArchTable(table);
                arches.push({ name: archName, empty: false, columns, values });
            } else {
                arches.push({ name: archName, empty: true, columns: [], values: [] });
            }

            cur = cur.nextElementSibling;
        }

        sections.push({ label, arches });
    }

    return { sections, fetchedAt: Date.now() };
}

export function parseVtPage(html: string): SubjectVt {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const allText = doc.body?.textContent ?? '';
    if (allText.includes('Neexistuje žádný Vámi napsaný test.')) {
        return { tests: [], fetchedAt: Date.now() };
    }

    // Find the test results table by locating a header containing "Název testu"
    const allTables = Array.from(doc.querySelectorAll('table'));
    const table = allTables.find(t =>
        (t.querySelector('thead') ?? t.querySelector('tr.zahlavi'))?.textContent?.includes('Název testu')
    );

    if (!table) {
        return { tests: [], fetchedAt: Date.now() };
    }

    // Build column index map — handles optional leading "Poř." column
    const colMap: Record<string, number> = {};
    const headerCells = Array.from(
        table.querySelectorAll('thead th, tr.zahlavi th, thead td, tr.zahlavi td')
    );
    headerCells.forEach((th, i) => {
        const key = normalizeText(th);
        if (key && !(key in colMap)) colMap[key] = i;
    });

    const tests: VtTestAttempt[] = [];
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));

    for (const row of bodyRows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 4) continue;
        if (cells.some(td => td.hasAttribute('colspan'))) continue;

        const get = (col: string) => normalizeText(cells[colMap[col]]);

        const name = get('Název testu');
        if (!name) continue;

        const score = parseCzechFloat(get('Dosaženo bodů'));
        const maxScore = parseInt(get('Max. bodů')) || 0;
        const successPct = parseCzechFloat(get('Úspěšnost').replace(/\s*%$/, ''));
        const submittedAt = get('Odevzdáno');
        const teacher = get('Správce');
        const detailCell = cells[colMap['Podrobnosti']];
        const hasDetail = !!detailCell?.querySelector('a');

        tests.push({ name, score, maxScore, successPct, submittedAt, teacher, hasDetail });
    }

    return { tests, fetchedAt: Date.now() };
}

export async function fetchSubjectZaznamnik(
    studium: string,
    obdobi: string,
    predmetId: string,
): Promise<SubjectZaznamnik | null> {
    try {
        const phUrl = `${BASE}/auth/student/list.pl?studium=${studium};obdobi=${obdobi};predmet=${predmetId};prubezne=1;lang=cz`;
        const vtUrl = `${BASE}/auth/student/list.pl?studium=${studium};obdobi=${obdobi};predmet=${predmetId};test=1;lang=cz`;

        const [phRes, vtRes] = await Promise.all([fetch(phUrl), fetch(vtUrl)]);
        if (!phRes.ok || !vtRes.ok) throw new Error(`HTTP error: PH=${phRes.status} VT=${vtRes.status}`);

        const [phHtml, vtHtml] = await Promise.all([phRes.text(), vtRes.text()]);

        const ph = parsePhPage(phHtml);
        const vt = parseVtPage(vtHtml);

        return { ph, vt };
    } catch (e) {
        logError('Api.fetchSubjectZaznamnik', e);
        return null;
    }
}
