import type { ExamSubject } from '../../../types/exams';
import { ExamSubjectSchema } from '../../../schemas/examSchema';
import type { ScrapedExamSubject, ScrapedExamSection } from './types';
import { validateHtmlStructure } from './validator';
import { parseRegisteredTerms } from './registeredTermsParser';
import { parseAvailableTerms } from './availableTermsParser';

export function parseExamData(html: string, lang: string = 'cs'): ExamSubject[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    validateHtmlStructure(doc);

    const isEn = lang === 'en';

    const subjectsMap = new Map<string, ScrapedExamSubject>();

    const getOrCreateSubject = (code: string, rawName: string): ScrapedExamSubject => {
        const name = rawName.replace(/^[ZL]S\s*\d{4}\/\d{4}\s*-\s*[A-Z]+\s*(-)?\s*/i, '').trim();
        if (!subjectsMap.has(code)) {
            subjectsMap.set(code, { 
                version: 1, 
                id: code, 
                name, 
                code, 
                sections: [],
                nameCs: isEn ? undefined : name,
                nameEn: isEn ? name : undefined
            });
        } else if (isEn) {
            subjectsMap.get(code)!.nameEn = name;
        } else {
            subjectsMap.get(code)!.nameCs = name;
        }
        return subjectsMap.get(code)!;
    };

    const getOrCreateSection = (subject: ScrapedExamSubject, rawSectionName: string): ScrapedExamSection => {
        const sectionName = rawSectionName.charAt(0).toUpperCase() + rawSectionName.slice(1);
        let section = subject.sections.find((s) => s.name === sectionName);
        if (!section) {
            section = { 
                id: `${subject.id}-${sectionName.replace(/\s+/g, '-').toLowerCase()}`, 
                name: sectionName, 
                type: (sectionName.toLowerCase().includes('zkouška') || sectionName.toLowerCase().includes('examination')) ? 'exam' : 'test', 
                status: 'open', 
                terms: [],
                nameCs: isEn ? undefined : sectionName,
                nameEn: isEn ? sectionName : undefined
            };
            subject.sections.push(section);
        } else if (isEn) {
            section.nameEn = sectionName;
        } else {
            section.nameCs = sectionName;
        }
        return section;
    };

    parseRegisteredTerms(doc, getOrCreateSubject, getOrCreateSection, lang);
    parseAvailableTerms(doc, getOrCreateSubject, getOrCreateSection, lang);

    return Array.from(subjectsMap.values()).map(subject => {
        const result = ExamSubjectSchema.safeParse(subject);
        if (!result.success) console.error(`[parseExamData] ❌ Validation failed for ${subject.code}:`, result.error.issues);
        return result.success ? result.data : null;
    }).filter((s) => s !== null) as ExamSubject[];
}
