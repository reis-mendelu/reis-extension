 
 
import { fetchWithAuth, BASE_URL } from "./client";
import { parseSyllabusOffline } from "../utils/parsers/syllabusParser";
import type { SyllabusRequirements } from "../types/documents";

/**
 * Fetch syllabus requirements for a specific subject.
 * 
 * @param predmetId - The numeric subject ID (from predmet=... parameter)
 * @returns Parsed syllabus requirements containing text and grading table
 */
export async function fetchSyllabus(predmetId: string, lang: string = 'cz'): Promise<SyllabusRequirements> {
    try {
        const url = `${BASE_URL}/auth/katalog/syllabus.pl?predmet=${predmetId};lang=${lang}`;
        
        const response = await fetchWithAuth(url);
        const html = await response.text();
        
        const parsed: SyllabusRequirements = { ...parseSyllabusOffline(html, lang), courseId: predmetId, language: lang };

        return parsed;
    } catch (error) {
        console.error(`[fetchSyllabus] Failed for predmetId ${predmetId}:`, error);
        
        // Return empty structure on error (graceful degradation)
        return {
            requirementsText: 'Error: Failed to fetch syllabus',
            requirementsTable: []
        };
    }
}

/**
 * Searches for a subject ID by its code or name using the IS Mendelu catalogue search.
 * @param courseCode The subject code (e.g., EBC-MAT)
 * @param subjectName Optional subject name to prioritize in search (e.g. "Matematika")
 * @returns The subject ID (predmet_id) if found, otherwise null
 */
export async function findSubjectId(courseCode: string, subjectName?: string): Promise<string | null> {
    try {
        const query = subjectName || courseCode;
        
        // Use the catalogue search (vyhledavani v katalogu)
        const searchUrl = `${BASE_URL}/auth/katalog/index.pl?search_text=${encodeURIComponent(query)};lang=cz`;
        console.log(`[findSubjectId] Searching URL: ${searchUrl}`);
        const response = await fetchWithAuth(searchUrl);
        const html = await response.text();
        console.log(`[findSubjectId] Search returned ${html.length} bytes.`);
        
        // Parse the HTML to find a link to syllabus that matches the code
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Find rows or links containing the code/name and a link to syllabus
        const links = Array.from(doc.querySelectorAll('a[href*="syllabus.pl?predmet="]'));
        
        let bestMatchId: string | null = null;
        let maxId = 0;
        
        for (const link of links) {
            const href = link.getAttribute('href') || '';
            const text = link.textContent || '';
            
            // Check if match
            // If searching by name, just take first reasonable result or check code presence
            // If searching by code, ensure code is in text
            let isMatch = false;
            if (subjectName) {
                // If using name, strict code check might fail if name is different in search result
                // But usually better to check if code is present somewhere in the row if possible.
                // For now, if name matches loosely, or just take the first result since IS search is usually good.
                isMatch = true; 
            } else {
                isMatch = text.includes(courseCode);
            }

            if (isMatch) {
                const match = href.match(/predmet=(\d+)/);
                if (match) {
                    const idVal = parseInt(match[1], 10);
                    // Start of heuristics:
                    // If we have a code, let's double check if the link TEXT contains the code to reduce false positives
                    if (courseCode && text.includes(courseCode)) {
                         if (idVal > maxId) {
                             maxId = idVal;
                             bestMatchId = match[1];
                         }
                    }
                    // If we searched by name and found a result, it's likely correct
                    else if (subjectName) {
                         if (idVal > maxId) {
                             maxId = idVal;
                             bestMatchId = match[1];
                         }
                    }
                }
            }
        }
        
        console.log(`[findSubjectId] bestMatchId for ${courseCode} (maxId=${maxId}) -> ${bestMatchId}`);
        return bestMatchId;
        
    } catch (error) {
        console.error(`[findSubjectId] Error searching for ${courseCode}:`, error);
        return null;
    }
}
