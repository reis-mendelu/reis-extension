import { fetchWithAuth, BASE_URL } from "./client";
import type { StudyStats, SemesterStats } from "../types/studyPlan";
import { logError } from "../utils/reportError";

const STATS_URL = `${BASE_URL}/auth/student/pruchod_studiem.pl`;

export async function fetchStudyStats(studium: string, obdobi: string): Promise<StudyStats | null> {
    try {
        const res = await fetchWithAuth(`${STATS_URL}?vyber=stat_info;studium=${studium};obdobi=${obdobi};lang=cz`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return parseStudyStats(doc);
    } catch (e) {
        logError('Api.fetchStudyStats', e);
        return null;
    }
}

function parseNumber(text: string): number {
    return parseFloat(text.replace(',', '.').replace(/\s/g, '')) || 0;
}

function parseStatsTable(table: HTMLTableElement): Record<string, string> {
    const map: Record<string, string> = {};
    for (const row of Array.from(table.querySelectorAll('tr'))) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
            // IS labels use a non-breaking space ( ) after single-letter
            // prepositions (e.g. "Průměr z odstudovaných"); normalize so the
            // plain-space lookup keys below match.
            const key = (cells[0].textContent || '').replace(/\s+/g, ' ').trim();
            const val = (cells[cells.length - 1].textContent || '').trim();
            if (key) map[key] = val;
        }
    }
    return map;
}

function extractSemesterStats(data: Record<string, string>): SemesterStats {
    return {
        enrolledCredits: parseNumber(data['Počet zapsaných kreditů za dané studijní období'] || '0'),
        earnedCredits: parseNumber(data['Počet získaných kreditů za dané studijní období'] || '0'),
        unearnedCredits: parseNumber(data['Počet nezískaných kreditů za dané studijní období'] || '0'),
        completedSubjects: parseNumber(data['Počet odstudovaných předmětů za dané studijní období'] || '0'),
        gpa: parseNumber(data['Průměr z odstudovaných předmětů za dané studijní období'] || '0'),
        gpaWithFails: parseNumber(data['Průměr z odstudovaných předmětů za dané studijní období (včetně neúspěšně ukončených předmětů)'] || '0'),
    };
}

export function parseStudyStats(doc: Document): StudyStats | null {
    const tables = Array.from(doc.querySelectorAll('table')).filter(t =>
        (t.textContent || '').includes('kreditů za dané studijní období')
        || (t.textContent || '').includes('kreditů za celé studium')
    );

    if (tables.length < 2) return null;

    const semesterTables = tables.filter(t => (t.textContent || '').includes('kreditů za dané studijní období'));
    const totalTable = tables.find(t => (t.textContent || '').includes('kreditů za celé studium'));

    if (!totalTable || semesterTables.length === 0) return null;

    const currentData = parseStatsTable(semesterTables[0] as HTMLTableElement);
    const previousData = semesterTables.length > 1 ? parseStatsTable(semesterTables[1] as HTMLTableElement) : null;
    const totalData = parseStatsTable(totalTable as HTMLTableElement);

    return {
        currentSemester: extractSemesterStats(currentData),
        previousSemester: previousData ? extractSemesterStats(previousData) : null,
        totalEarnedCredits: parseNumber(totalData['Počet získaných kreditů za celé studium'] || '0'),
        creditsLastTwoPeriods: parseNumber(totalData['Počet získaných kreditů za poslední dvě období'] || '0'),
        repeatedSubjects: parseNumber(totalData['Počet opakovaných předmětů za celé studium'] || '0'),
        registrationVouchersInitial: parseNumber(totalData['Počáteční stav registračních poukázek'] || '0'),
        registrationVouchersCurrent: parseNumber(totalData['Aktuální stav registračních poukázek'] || '0'),
        gpaTotal: parseNumber(totalData['Průměr z odstudovaných předmětů za celé studium'] || '0'),
        weightedGpaTotal: parseNumber(totalData['Vážený průměr z odstudovaných předmětů za celé studium (včetně neúspěšně ukončených předmětů)'] || '0'),
    };
}
