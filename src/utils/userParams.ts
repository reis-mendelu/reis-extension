/**
 * User Parameters - Study and period IDs.
 * 
 * Read from storage (populated by syncUserParams or on first use).
 * No TTL expiry - data persists until manually refreshed.
 */

import { fetchWithAuth, BASE_URL } from "../api/client";
import { StorageService } from "../services/storage";
import { STORAGE_KEYS } from "../services/storage/keys";

// ... (imports remain the same)

export interface UserParams {
    studium: string;
    obdobi: string;
    facultyId: string;
    username: string;
    email?: string;
    studentId: string;
    fullName: string;
    // Categorized Study Data
    studyCode?: string;      // Full string: "PEF B-OI-ZBOI prez [sem 1, roč 1]"
    facultyLabel?: string;   // "PEF"
    studyProgram?: string;   // "B-OI-ZBOI"
    studyForm?: string;      // "prez" or "komb"
    studySemester?: number;  // 1
    studyYear?: number;      // 1
    periodLabel?: string;    // "ZS 2025/2026"
    isErasmus: boolean;
}

/**
 * Get user params from storage.
 * If not in storage, fetches once and stores permanently.
 */
export async function getUserParams(): Promise<UserParams | null> {
    console.debug('[getUserParams] Getting user params');

    // Try to get from storage
    const cached = StorageService.get<UserParams>(STORAGE_KEYS.USER_PARAMS);

    if (cached && cached.studium && cached.obdobi && cached.facultyId && cached.username && cached.studentId && cached.fullName && cached.studyCode) {
        console.debug('[getUserParams] Returning stored params:', cached);
        return cached;
    }

    console.debug('[getUserParams] Not in storage or incomplete, fetching from IS...');

    // Fetch from IS
    try {
        // 1. Get Studium and Obdobi from studium.pl
        const studResponse = await fetchWithAuth(`${BASE_URL}/auth/student/studium.pl`);
        const studHtml = await studResponse.text();

        const paramRegex = /studium=(\d+);obdobi=(\d+)/;
        const paramMatch = studHtml.match(paramRegex);

        if (!paramMatch) {
            console.debug('[getUserParams] No studium/obdobi found');
            return null;
        }

        const studium = paramMatch[1];
        const obdobi = paramMatch[2];

        // 1.1 Get Numeric Student ID and Full Name
        const idRegex = /Identifikační\s+číslo\s+uživatele:\s*<\/td>\s*<td[^>]*>\s*(\d+)/i;
        const idMatch = studHtml.match(idRegex);
        const studentId = idMatch ? idMatch[1] : '';

        const nameRegex = /id="prihlasen"[^>]*>\s*Přihlášen:&nbsp;([^&]+)/i;
        const nameMatch = studHtml.match(nameRegex);
        const fullName = nameMatch ? nameMatch[1].trim() : '';

        // 2. Get Faculty ID and Study Details from moje_studium.pl
        const mojeResponse = await fetchWithAuth(`${BASE_URL}/auth/student/moje_studium.pl?lang=cz`);
        const mojeHtml = await mojeResponse.text();

        // 2.1 Parse Study Code and Period
        let studyCode = '';
        let facultyLabel, studyProgram, studyForm, periodLabel;
        let studySemester, studyYear;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(mojeHtml, 'text/html');
            const headerContainer = doc.querySelector('#titulek');
            
            if (headerContainer) {
                // Find line with "Studium –" and "období –"
                // Example HTML: Studium – <b>PEF B-OI-ZBOI prez [sem 1, roč 1]</b>, období – <b>ZS 2025/2026 - PEF</b>
                const infoDivs = Array.from(headerContainer.querySelectorAll('div'));
                const targetDiv = infoDivs.find(div => div.textContent?.includes("Studium") && div.textContent?.includes("období"));

                if (targetDiv) {
                    const boldTags = targetDiv.querySelectorAll('b');
                    
                    // First Bold: Study Code e.g. "PEF B-OI-ZBOI prez [sem 1, roč 1]"
                    if (boldTags.length > 0) {
                        studyCode = boldTags[0].textContent?.trim() || '';
                        
                        // Parse Categorized Data
                        // Regex: Start with Faculty (Words), Space, Program (Words-Dashes), Space, Form (Word), Space, [sem X, roč Y]
                        const codeRegex = /^([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+\[sem\s+(\d+),\s+roč\s+(\d+)\]/;
                        const codeMatch = studyCode.match(codeRegex);
                        if (codeMatch) {
                            facultyLabel = codeMatch[1];
                            studyProgram = codeMatch[2];
                            studyForm = codeMatch[3];
                            studySemester = parseInt(codeMatch[4], 10);
                            studyYear = parseInt(codeMatch[5], 10);
                        }
                    }

                    // Second Bold (if exists): Period e.g. "ZS 2025/2026 - PEF"
                    if (boldTags.length > 1) {
                        const rawPeriod = boldTags[1].textContent?.trim() || '';
                        // Extract "ZS 2025/2026" from "ZS 2025/2026 - PEF"
                        const periodPart = rawPeriod.split(' - ')[0]; // Take everything before " - "
                        if (periodPart) {
                            periodLabel = periodPart.trim();
                        } else {
                             periodLabel = rawPeriod; // Fallback
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[getUserParams] Failed to parse study details:', e);
        }

        // 2.2 Faculty ID (Fallback to PEF=2)
        const facultyRegex = /fakulta=(\d+)/;
        const facultyMatch = mojeHtml.match(facultyRegex);
        const facultyId = facultyMatch ? facultyMatch[1] : '2';

        // 3. Get Username (certifikat.pl)
        const certResponse = await fetchWithAuth(`${BASE_URL}/auth/wifi/certifikat.pl?_m=177`);
        const certHtml = await certResponse.text();
        const usernameMatch = certHtml.match(/pro uživatele <b>([^<]+)<\/b>/i) || certHtml.match(/for user <b>([^<]+)<\/b>/i);
        const username = usernameMatch ? usernameMatch[1] : '';
        const email = username ? `${username}@mendelu.cz` : '';

        // 4. Erasmus Status
        const isErasmus = studHtml.includes('Erasmus +') || studHtml.includes('Erasmus+');

        const params: UserParams = {
            studium,
            obdobi,
            facultyId,
            username,
            email,
            studentId,
            fullName,
            studyCode,
            facultyLabel,
            studyProgram,
            studyForm,
            studySemester,
            studyYear,
            periodLabel,
            isErasmus
        };

        console.debug('[getUserParams] Parsed and stored params:', params);
        StorageService.set(STORAGE_KEYS.USER_PARAMS, params);
        return params;

    } catch (error) {
        console.error("[getUserParams] Failed to fetch user params:", error);
    }

    return null;
}

// ... (exports remain the same)

/**
 * Synchronous getter for studium from storage.
 * Returns null if not cached (caller should handle gracefully).
 * Use this for URL injection where async isn't practical.
 */
export function getStudiumSync(): string | null {
    const cached = StorageService.get<UserParams>(STORAGE_KEYS.USER_PARAMS);
    return cached?.studium ?? null;
}

export function getFacultySync(): string | null {
    const cached = StorageService.get<UserParams>(STORAGE_KEYS.USER_PARAMS);
    return cached?.facultyId ?? null;
}

export function getErasmusSync(): boolean {
    const cached = StorageService.get<UserParams>(STORAGE_KEYS.USER_PARAMS);
    return cached?.isErasmus ?? false;
}

