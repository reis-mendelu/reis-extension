import { fetchWithAuth, BASE_URL } from './client';
import { parseOptionalInt } from '../utils/parsers/parserGuards';
import type { GradeHistory, CourseGrade } from '../types/documents';
import { logError } from '../utils/reportError';

export async function fetchGradeHistory(
    studium: string,
    obdobi: string
): Promise<GradeHistory | null> {
    try {
        const base = `${BASE_URL}/auth/student/pruchod_studiem.pl?vyber=podrobne_vsechna_obdobi;studium=${studium};obdobi=${obdobi}`;
        const [czRes, enRes] = await Promise.all([
            fetchWithAuth(`${base};lang=cz`),
            fetchWithAuth(`${base};lang=en`),
        ]);
        const czHtml = await czRes.text();
        const enHtml = await enRes.text();

        const result = parseGradeHistory(czHtml, studium);

        // Build predmetId → EN course name map and merge in
        const enGrades = parseGradeHistory(enHtml, studium).grades;
        const enNameMap = new Map(enGrades.map(g => [g.predmetId, g.courseName]));
        for (const grade of result.grades) {
            const enName = enNameMap.get(grade.predmetId);
            if (enName) grade.courseNameEn = enName;
        }

        return result;
    } catch (e) {
        logError('Api.fetchGradeHistory', e);
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

            // Column layout of "Podrobny prehled za cele studium"
            // (podrobne_vsechna_obdobi, 11 cols, no leading Por cell):
            // 0=Kod, 1=Predmet, 2=Povinnost, 3=Jaz, 4=Uk (examType),
            // 5=Pokus (attempt), 6=Vysledek (grade), 7=Zadano, 8=Zadal,
            // 9=Kredity, 10=Zpusob.
            const cells = row.querySelectorAll('td');
            const courseCode = cells[0]?.textContent?.trim().replace(/\u00a0/g, ' ') || undefined;
            const examType = cells[4]?.textContent?.trim() ?? '';
            const attemptText = cells[5]?.textContent?.trim() ?? '';
            const attempt = parseOptionalInt(attemptText, 'attempt', 'parseGradeHistory');

            const gradeDiv = row.querySelector('div.flex-container');
            const gradeText = gradeDiv?.textContent?.trim().replace(/\u00a0/g, ' ') ?? '';
            const letterMatch = gradeText.match(/\(([A-F])\)$/i);
            const gradeLetter = letterMatch ? letterMatch[1].toUpperCase() : '';

            const creditsText = cells[9]?.textContent?.trim() ?? '';
            const credits = parseOptionalInt(creditsText, 'credits', 'parseGradeHistory');

            if (predmetId && courseName) {
                grades.push({ period, predmetId, courseCode, courseName, examType, attempt, gradeText, gradeLetter, credits });
            }
        }
    }

    return { studium, fetchedAt: new Date().toISOString(), grades };
}
