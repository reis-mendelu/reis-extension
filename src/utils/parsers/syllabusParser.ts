import { SyllabusRequirementsSchema } from '../../schemas/syllabusSchema';
import { parseRequirementsText } from './syllabus/requirementParser';
import { parseRequirementsTable } from './syllabus/gradingParser';
import { parseCourseMetadata } from './syllabus/metadataParser';
import { parseCourseObjectives } from './syllabus/objectivesParser';
import { parseCourseContent } from './syllabus/contentParser';

import type { SyllabusRequirements } from '../../schemas/syllabusSchema';

export function parseSyllabusOffline(html: string, lang: string = 'cz'): SyllabusRequirements {
    if (!html || typeof html !== 'string') return { version: 1 as const, requirementsText: 'Error: Section not found', requirementsTable: [] };
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const res = {
        version: 3 as const,
        requirementsText: parseRequirementsText(doc),
        requirementsTable: parseRequirementsTable(doc),
        courseInfo: parseCourseMetadata(doc, lang),
        objectivesText: parseCourseObjectives(doc),
        contentText: parseCourseContent(doc),
    };
    const v = SyllabusRequirementsSchema.safeParse(res);
    return v.success ? v.data : res;
}
