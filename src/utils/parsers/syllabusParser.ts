import { SyllabusRequirementsSchema } from '../../schemas/syllabusSchema';
import { parseRequirementsText, parseAssessmentMethods } from './syllabus/requirementParser';
import { parseRequirementsTable, parseAssessmentCriteria } from './syllabus/gradingParser';
import { parseCourseMetadata } from './syllabus/metadataParser';

import type { SyllabusRequirements } from '../../schemas/syllabusSchema';

export function parseSyllabusOffline(html: string, lang: string = 'cz'): SyllabusRequirements {
    if (!html || typeof html !== 'string') return { requirementsText: 'Error: Section not found', requirementsTable: [] };
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const res = { 
        version: 2, 
        requirementsText: parseRequirementsText(doc), 
        requirementsTable: parseRequirementsTable(doc), 
        courseInfo: parseCourseMetadata(doc, lang),
        assessmentMethods: parseAssessmentMethods(doc),
        assessmentCriteria: parseAssessmentCriteria(doc)
    };
    const v = SyllabusRequirementsSchema.safeParse(res);
    return v.success ? v.data : res;
}
