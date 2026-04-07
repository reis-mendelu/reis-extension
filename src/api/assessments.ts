 
 

import { fetchWithAuth, BASE_URL } from "./client";
import { parseAssessmentTable } from "../utils/parsers/assessmentParser";
import type { Assessment } from "../types/documents";

/**
 * Fetch assessments for a specific subject.
 * @param studium The study ID
 * @param obdobi The period ID
 * @param predmetId The subject ID (numeric)
 */
export async function fetchAssessments(
    studium: string, 
    obdobi: string, 
    predmetId: string,
    lang: string = 'cz'
): Promise<Assessment[]> {
    try {
        const url = `${BASE_URL}/auth/student/list.pl?studium=${studium};obdobi=${obdobi};predmet=${predmetId};test=1;lang=${lang}`;
        const response = await fetchWithAuth(url);
        const html = await response.text();
        return parseAssessmentTable(html);
    } catch (e) {
        console.warn('[assessments] fetchAssessments failed:', e);
        return [];
    }
}

