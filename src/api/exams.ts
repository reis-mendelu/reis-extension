 
 
import { parseExamData } from "../utils/parsers/exams";
import type { ExamSubject } from "../types/exams";
import { fetchWithAuth } from "./client";
import { getUserParams } from "../utils/userParams";

/**
 * Result of exam registration/unregistration.
 * Includes success status and optional error message for UI feedback.
 */
export interface ExamActionResult {
    success: boolean;
    error?: string;
}

/**
 * Build exam list URL dynamically using user's studium.
 * Removed hardcoded studium that only worked for one user.
 */
async function getExamListUrl(lang: string = 'cz'): Promise<string> {
    const isLang = lang;
    const params = await getUserParams();
    if (!params?.studium) {
        return `https://is.mendelu.cz/auth/student/terminy_seznam.pl?lang=${isLang}`;
    }
    return `https://is.mendelu.cz/auth/student/terminy_seznam.pl?studium=${params.studium};lang=${isLang}`;
}

/**
 * Check if HTML response indicates successful registration.
 * IS MENDELU shows the term in table_1 (registered) after success.
 */
function verifyRegistrationSuccess(html: string, termId: string): boolean {
    // After successful registration, the term should appear in registered table
    // Check for the term ID in unregister links (confirms registration)
    const hasUnregisterLink = html.includes(`termin=${termId}`) && html.includes('odhlasit_ihned=1');
    
    // Also check for common error patterns
    const hasError = html.includes('Termín je již plný') || 
                     html.includes('nelze přihlásit') ||
                     html.includes('Chyba');
    
    return hasUnregisterLink && !hasError;
}

export async function fetchExamData(lang: string = 'cz'): Promise<ExamSubject[]> {
    try {
        const url = await getExamListUrl(lang);
        const response = await fetchWithAuth(url);
        const html = await response.text();
        const data = parseExamData(html, lang);
        return data;
    } catch (error) {
        console.error("Error fetching exam data:", error);
        return [];
    }
}

/**
 * Fetch exam data in both Czech and English in parallel and merge them.
 * Enables instant language switching in the UI.
 */
export async function fetchDualLanguageExams(): Promise<ExamSubject[]> {
    try {
        const [czData, enData] = await Promise.all([
            fetchExamData('cz'),
            fetchExamData('en')
        ]);
        const merged: ExamSubject[] = [...czData];

        enData.forEach(enSubject => {
            const czSubject = merged.find(s => s.code === enSubject.code);
            if (czSubject) {
                // Merge localized name
                czSubject.nameEn = enSubject.nameEn;
                
                // Merge sections
                enSubject.sections.forEach(enSection => {
                    const czSection = czSubject.sections.find(s =>
                        s.id === enSection.id ||
                        s.name === enSection.name ||
                        s.terms.some(t => enSection.terms.some(et =>
                            (et.id && et.id === t.id) ||
                            (t.date === et.date && t.time === et.time && t.teacher === et.teacher)
                        )) ||
                        (s.registeredTerm && enSection.registeredTerm && (
                            (s.registeredTerm.id && s.registeredTerm.id === enSection.registeredTerm.id) ||
                            (s.registeredTerm.date === enSection.registeredTerm.date && s.registeredTerm.time === enSection.registeredTerm.time)
                        ))
                    );
                    
                    if (czSection) {
                        czSection.nameEn = enSection.nameEn;
                        
                        // Merge terms
                        enSection.terms.forEach(enTerm => {
                            const czTerm = czSection.terms.find(t => t.id === enTerm.id);
                            if (czTerm) {
                                czTerm.roomEn = enTerm.roomEn;
                            }
                        });

                        // Merge registered term if it exists
                        if (enSection.registeredTerm && czSection.registeredTerm) {
                            czSection.registeredTerm.roomEn = enSection.registeredTerm.roomEn;
                        }
                    } else {
                        // Section only exists in EN? (Unlikely but safe to add)
                        czSubject.sections.push(enSection);
                    }
                });
            } else {
                merged.push(enSubject);
            }
        });

        return merged;
    } catch (error) {
        console.error('[exams] Error fetching dual language exams:', error);
        return fetchExamData('cz'); // Fallback to CZ
    }
}

export async function registerExam(termId: string): Promise<ExamActionResult> {
    try {
        const params = await getUserParams();
        if (!params?.studium) {
            return { success: false, error: 'Chybí údaje o studiu. Zkuste obnovit stránku.' };
        }
        
        const url = `https://is.mendelu.cz/auth/student/terminy_seznam.pl?termin=${termId};studium=${params.studium};obdobi=${params.obdobi};prihlasit_ihned=1;lang=cz`;
        const response = await fetchWithAuth(url);
        const html = await response.text();
        
        // Verify the registration actually worked
        if (verifyRegistrationSuccess(html, termId)) {
            return { success: true };
        }
        
        // Check for specific error messages
        if (html.includes('Termín je již plný')) {
            return { success: false, error: 'Termín je již plný.' };
        }
        if (html.includes('nelze přihlásit')) {
            return { success: false, error: 'Na tento termín se nelze přihlásit.' };
        }
        
        // Generic failure
        return { success: false, error: 'Registrace se nepodařila ověřit. Zkontrolujte v IS.' };
        
    } catch (error) {
        console.error("Error registering for exam:", error);
        return { success: false, error: 'Chyba připojení. Zkuste to znovu.' };
    }
}

export async function unregisterExam(termId: string): Promise<ExamActionResult> {
    try {
        const params = await getUserParams();
        if (!params?.studium) {
            return { success: false, error: 'Chybí údaje o studiu. Zkuste obnovit stránku.' };
        }
        
        const url = `https://is.mendelu.cz/auth/student/terminy_seznam.pl?termin=${termId};studium=${params.studium};obdobi=${params.obdobi};odhlasit_ihned=1;lang=cz`;
        await fetchWithAuth(url);
        
        // Assume success if no HTTP error
        return { success: true };
        
    } catch (error) {
        console.error("Error unregistering from exam:", error);
        return { success: false, error: 'Chyba připojení. Zkuste to znovu.' };
    }
}
