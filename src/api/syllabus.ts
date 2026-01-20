import { fetchWithAuth, BASE_URL } from "./client";
import { parseSyllabusOffline } from "../utils/parsers/syllabusParser";
import type { SyllabusRequirements } from "../types/documents";

/**
 * Fetch syllabus requirements for a specific subject.
 * 
 * @param predmetId - The numeric subject ID (from predmet=... parameter)
 * @returns Parsed syllabus requirements containing text and grading table
 */
export async function fetchSyllabus(predmetId: string): Promise<SyllabusRequirements> {
    try {
        const url = `${BASE_URL}/auth/katalog/syllabus.pl?predmet=${predmetId};lang=cz`;
        console.debug(`[fetchSyllabus] Fetching for predmet=${predmetId}`);
        
        const response = await fetchWithAuth(url);
        const html = await response.text();
        
        const parsed = parseSyllabusOffline(html);
        
        console.debug(`[fetchSyllabus] Success for predmet=${predmetId}:`, {
            textLength: parsed.requirementsText.length,
            tableRows: parsed.requirementsTable.length
        });
        
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
