import { fetchWithAuth, BASE_URL } from './client';
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
    } catch (error) {
        console.error('[gradeHistory] Fetch failed:', error);
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

            const cells = row.querySelectorAll('td');
            const examType = cells[4]?.textContent?.trim() ?? '';
            const attemptText = cells[5]?.textContent?.trim() ?? '';
            const attempt = attemptText ? parseInt(attemptText, 10) : null;

            const gradeDiv = row.querySelector('div.flex-container');
            const gradeText = gradeDiv?.textContent?.trim().replace(/\u00a0/g, ' ') ?? '';
            const letterMatch = gradeText.match(/\(([A-F])\)$/i);
            const gradeLetter = letterMatch ? letterMatch[1].toUpperCase() : '';

            const creditsText = cells[7]?.textContent?.trim() ?? '';
            const credits = creditsText ? parseInt(creditsText, 10) : null;

            if (predmetId && courseName) {
                grades.push({ period, predmetId, courseName, examType, attempt, gradeText, gradeLetter, credits });
            }
        }
    }

    return { studium, fetchedAt: new Date().toISOString(), grades };
}
