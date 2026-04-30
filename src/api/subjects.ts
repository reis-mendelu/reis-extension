 
 
import { fetchWithAuth, BASE_URL } from "./client";
import type { SubjectInfo, SubjectsData, SubjectAttendance, AttendanceRecord, AttendanceStatus, AvailablePeriod } from "../types/documents";
import { SubjectsDataSchema } from "../schemas/subjectSchema";

const STUDENT_LIST_URL = `${BASE_URL}/auth/student/list.pl`;

export async function fetchSubjects(lang: string = 'cz', studium?: string): Promise<SubjectsData | null> {
    try {
        const isLang = lang;
        const url = studium 
            ? `${STUDENT_LIST_URL}?lang=${isLang};studium=${studium}`
            : `${STUDENT_LIST_URL}?lang=${isLang}`;
            
        const response = await fetchWithAuth(url);
        const html = await response.text();
        const subjectsMap = parseSubjectFolders(html);
        const subjectsData = showFullSubjects(subjectsMap, lang);

        const result = SubjectsDataSchema.safeParse(subjectsData);
        if (result.success) {
            return result.data;
        } else {
            return subjectsData;
        }
    } catch (e) {
        console.warn('[subjects] fetchSubjects failed:', e);
        return null;
    }
}

export interface SubjectsFetchResult {
    subjects: SubjectsData;
    attendance: Record<string, SubjectAttendance[]>;
    availablePeriods: AvailablePeriod[];
}

function buildListUrl(lang: string, studium?: string, obdobi?: string): string {
    const params = new URLSearchParams();
    params.set('lang', lang);
    if (studium) params.set('studium', studium);
    if (obdobi) params.set('obdobi', obdobi);
    return `${STUDENT_LIST_URL}?${params.toString().replace(/&/g, ';')}`;
}

export function parseAvailablePeriods(html: string): AvailablePeriod[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const select = doc.querySelector('select[name="obdobi"]');
    if (!select) return [];
    return Array.from(select.querySelectorAll('option')).map(opt => ({
        id: opt.getAttribute('value') ?? '',
        label: opt.textContent?.trim() ?? '',
    })).filter(p => p.id);
}

/**
 * Fetches subjects + attendance for a specific past semester (no periods list).
 * Result is cached in IDB by the caller — this function is pure fetch+parse.
 */
export async function fetchPastSemesterData(studium: string, obdobi: string): Promise<SubjectsFetchResult | null> {
    try {
        const [czRes, enRes] = await Promise.all([
            fetchWithAuth(buildListUrl('cz', studium, obdobi)),
            fetchWithAuth(buildListUrl('en', studium, obdobi)),
        ]);
        const czHtml = await czRes.text();
        const enHtml = await enRes.text();

        const attendance = parseAttendance(czHtml);
        const czMap = parseSubjectFolders(czHtml);
        const enMap = parseSubjectFolders(enHtml);

        const merged: Record<string, SubjectInfo> = {};
        for (const [fullName, data] of Object.entries(czMap)) {
            const code = extractSubjectCode(fullName);
            const name = extractCleanName(fullName);
            merged[code] = { displayName: name, fullName, nameCs: name, subjectCode: code, subjectId: data.subjectId, folderUrl: data.folderUrl, fetchedAt: new Date().toISOString() };
        }
        for (const [fullName] of Object.entries(enMap)) {
            const code = extractSubjectCode(fullName);
            if (merged[code]) merged[code].nameEn = extractCleanName(fullName);
        }

        const subjectsData: SubjectsData = { version: 1, lastUpdated: new Date().toISOString(), data: merged };
        return { subjects: subjectsData, attendance, availablePeriods: [] };
    } catch (e) {
        console.warn('[subjects] fetchPastSemesterData failed:', e);
        return null;
    }
}

/**
 * Fetches subjects in both Czech and English and merges them.
 */
export async function fetchDualLanguageSubjects(studium?: string, obdobi?: string): Promise<SubjectsFetchResult | null> {
    try {
        const czUrl = buildListUrl('cz', studium, obdobi);
        const enUrl = buildListUrl('en', studium, obdobi);

        // Fetch both in parallel
        const [czRes, enRes] = await Promise.all([
            fetchWithAuth(czUrl),
            fetchWithAuth(enUrl)
        ]);

        const czHtml = await czRes.text();
        const attendance = parseAttendance(czHtml);
        const enHtml = await enRes.text();

        const czMap = parseSubjectFolders(czHtml);
        const enMap = parseSubjectFolders(enHtml);

        const merged: Record<string, SubjectInfo> = {};
        
        // Process CZ as base
        for (const [fullName, data] of Object.entries(czMap)) {
            const code = extractSubjectCode(fullName);
            const name = extractCleanName(fullName);
            
            merged[code] = {
                displayName: name,
                fullName,
                nameCs: name,
                subjectCode: code,
                subjectId: data.subjectId,
                folderUrl: data.folderUrl,
                fetchedAt: new Date().toISOString()
            };
        }

        // Merge EN names
        for (const [fullName] of Object.entries(enMap)) {
            const code = extractSubjectCode(fullName);
            if (merged[code]) {
                merged[code].nameEn = extractCleanName(fullName);
            }
        }

        const subjectsData: SubjectsData = {
            version: 1,
            lastUpdated: new Date().toISOString(),
            data: merged
        };

        const result = SubjectsDataSchema.safeParse(subjectsData);
        const availablePeriods = parseAvailablePeriods(czHtml);
        return { subjects: result.success ? result.data : subjectsData, attendance, availablePeriods };
    } catch (e) {
        console.warn('[subjects] fetchDualLanguageSubjects failed:', e);
        return null;
    }
}

interface SubjectLinkData {
    folderUrl: string;
    subjectId?: string;
}

function parseSubjectFolders(htmlString: string): Record<string, SubjectLinkData> {
    const subjectMap: Record<string, SubjectLinkData> = {};
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const table = doc.querySelector('#tmtab_1');
    if (!table) return subjectMap;

    const subjectRows = table.querySelectorAll('tr.uis-hl-table');
    subjectRows.forEach((row) => {
        const subjectLinkElement = row.querySelector('a[href*="/auth/katalog/syllabus.pl"]');
        const folderLinkElement = row.querySelector('a[href*="../dok_server/slozka.pl"]');

        if (subjectLinkElement && folderLinkElement) {
            const subjectName = subjectLinkElement.textContent?.trim() || '';
            const relativeUrl = folderLinkElement.getAttribute('href') || '';
            const cleanUrl = relativeUrl.replace('../', '');
            const absoluteUrl = new URL(cleanUrl, `${BASE_URL}/auth/`).href;
            
            const syllabusHref = subjectLinkElement.getAttribute('href') || '';
            const idMatch = syllabusHref.match(/[?&;]predmet=(\d+)/);
            const subjectId = idMatch ? idMatch[1] : undefined;

            subjectMap[subjectName] = { 
                folderUrl: absoluteUrl,
                subjectId 
            };
        }
    });
    return subjectMap;
}

const SYSID_TO_STATUS: Record<string, AttendanceStatus> = {
    'doch-pritomen': 'present',
    'doch-neomluven': 'absent',
    'doch-omluven': 'excused',
    'doch-pozde': 'late',
    'doch-drivejsi-odchod': 'early-leave',
    'doch-vyloucen': 'excluded',
    'doch-pritomen-jinde': 'elsewhere',
};

export function parseAttendance(htmlString: string): Record<string, SubjectAttendance[]> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const table = doc.querySelector('#tmtab_1');
    if (!table) return {};

    const result: Record<string, SubjectAttendance[]> = {};
    let currentCode: string | null = null;

    const rows = table.querySelectorAll('tr.uis-hl-table');
    for (const row of rows) {
        const syllabusLink = row.querySelector('a[href*="/auth/katalog/syllabus.pl"]');

        if (syllabusLink) {
            const fullName = syllabusLink.textContent?.trim() || '';
            currentCode = fullName.split(' ')[0] || null;
            continue;
        }

        if (!currentCode) continue;

        const imgs = row.querySelectorAll('img[sysid^="doch-"]');
        if (imgs.length === 0) continue;

        const cells = row.querySelectorAll('td');
        const label = cells[1]?.textContent?.trim().replace(/\s*Každý týden\s*/g, '').trim()
            || cells[0]?.textContent?.trim().replace(/\s*Každý týden\s*/g, '').trim()
            || '';

        const records: AttendanceRecord[] = [];
        for (const img of imgs) {
            const sysid = img.getAttribute('sysid') || '';
            const status = SYSID_TO_STATUS[sysid];
            if (!status) continue;

            const title = img.getAttribute('title') || '';
            const parts = title.split(', ');
            if (parts.length < 3) continue;

            const datePart = parts[0];
            const timePart = parts[1];
            const roomAndStatus = parts.slice(2).join(', ');
            const room = roomAndStatus.split(' - ')[0];

            records.push({ date: datePart, time: timePart, room, status });
        }

        if (records.length > 0) {
            if (!result[currentCode]) result[currentCode] = [];
            result[currentCode].push({ label, records });
        }
    }

    return result;
}

function extractSubjectCode(subjectName: string): string {
    return subjectName.split(" ")[0];
}

function extractCleanName(fullName: string): string {
    const code = extractSubjectCode(fullName);
    // Remove code at start and trailing info in brackets
    return fullName.replace(code, '').replace(/\s*\([^)]+\)\s*$/, '').trim();
}

function showFullSubjects(subjectsObject: Record<string, SubjectLinkData>, lang: string): SubjectsData {
    const enrichedSubjects: Record<string, SubjectInfo> = {};
    for (const [fullName, data] of Object.entries(subjectsObject)) {
        const subjectCode = extractSubjectCode(fullName);
        const name = extractCleanName(fullName);
        
        enrichedSubjects[subjectCode] = {
            displayName: name,
            fullName,
            nameCs: lang === 'cz' ? name : undefined,
            nameEn: lang === 'en' ? name : undefined,
            subjectCode,
            subjectId: data.subjectId,
            folderUrl: data.folderUrl,
            fetchedAt: new Date().toISOString()
        };
    }
    return {
        version: 1,
        lastUpdated: new Date().toISOString(),
        data: enrichedSubjects
    };
}
