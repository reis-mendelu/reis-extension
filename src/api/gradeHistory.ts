import { fetchWithAuth, BASE_URL } from './client';
import { parseOptionalInt } from '../utils/parsers/parserGuards';
import type { GradeHistory, CourseGrade } from '../types/documents';

export async function fetchGradeHistory(
    studium: string,
    obdobi: string
): Promise<GradeHistory | null> {
    try {
        const url = `${BASE_URL}/auth/student/pruchod_studiem.pl?vyber=vsechna_obdobi;studium=${studium};obdobi=${obdobi};lang=cz`;
        const response = await fetchWithAuth(url);
        const html = await response.text();
        return parseGradeHistory(html, studium);
    } catch (e) {
        console.warn('[gradeHistory] fetchGradeHistory failed:', e);
        return null;
    }
}

function parseGradeHistory(html: string, studium: string): GradeHistory {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const grades: CourseGrade[] = [];

    // Period labels are <b>ZS 2025/2026 - PEF:</b> followed by a sibling table
    const boldEls = Array.from(doc.querySelectorAll('b'));
    const periodRe = /^((?:ZS|LS)\s+\d{4}\/\d{4}[^:]*)/;

    for (const bold of boldEls) {
        const match = bold.textContent?.trim().match(periodRe);
        if (!match) continue;
        const period = match[1].trim();

        // Walk siblings to find the next table
        let sibling = bold.nextSibling;
        let table: Element | null = null;
        for (let i = 0; i < 15 && sibling; i++) {
            const el = sibling as Element;
            if (el.tagName === 'TABLE') { table = el; break; }
            if (el.querySelector) {
                const t = el.querySelector('table');
                if (t) { table = t; break; }
            }
            sibling = sibling.nextSibling;
        }
        if (!table) continue;

        for (const row of Array.from(table.querySelectorAll('tbody tr'))) {
            const courseLink = row.querySelector('a[href*="syllabus.pl?predmet="]') as HTMLAnchorElement | null;
            if (!courseLink) continue;
            const predmetMatch = courseLink.href.match(/predmet=(\d+)/);
            const predmetId = predmetMatch?.[1] ?? '';
            const courseName = courseLink.textContent?.trim().replace(/\u00a0/g, ' ') ?? '';

            // Column layout (12 cols): 0=Po\u0159, 1=K\u00f3d, 2=P\u0159edm\u011bt, 3=Povinnost,
            // 4=Jaz, 5=Uk (examType), 6=Pokus (attempt), 7=V\u00fdsledek (grade),
            // 8=Zad\u00e1no, 9=Zadal, 10=Kredity, 11=Zp\u016fsob.
            const cells = row.querySelectorAll('td');
            const courseCode = cells[1]?.textContent?.trim().replace(/\u00a0/g, ' ') || undefined;
            const examType = cells[5]?.textContent?.trim() ?? '';
            const attemptText = cells[6]?.textContent?.trim() ?? '';
            const attempt = parseOptionalInt(attemptText, 'attempt', 'parseGradeHistory');

            const gradeDiv = row.querySelector('div.flex-container');
            const gradeText = gradeDiv?.textContent?.trim().replace(/\u00a0/g, ' ') ?? '';
            const letterMatch = gradeText.match(/\(([A-F])\)$/i);
            const gradeLetter = letterMatch ? letterMatch[1].toUpperCase() : '';

            const creditsText = cells[10]?.textContent?.trim() ?? '';
            const credits = parseOptionalInt(creditsText, 'credits', 'parseGradeHistory');

            if (predmetId && courseName) {
                grades.push({ period, predmetId, courseCode, courseName, examType, attempt, gradeText, gradeLetter, credits });
            }
        }
    }

    return { studium, fetchedAt: new Date().toISOString(), grades };
}
