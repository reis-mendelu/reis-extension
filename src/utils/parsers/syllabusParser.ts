import { SyllabusRequirementsSchema } from '../../schemas/syllabusSchema';
import { parseRequirementsText } from './syllabus/requirementParser';
import { parseRequirementsTable } from './syllabus/gradingParser';
import { parseCourseMetadata } from './syllabus/metadataParser';

export function parseSyllabusOffline(html: string): any {
    if (!html || typeof html !== 'string') return { requirementsText: 'Error: Section not found', requirementsTable: [] };
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const res = { version: 1, requirementsText: parseRequirementsText(doc), requirementsTable: parseRequirementsTable(doc), courseInfo: parseCourseMetadata(doc) };
    const v = SyllabusRequirementsSchema.safeParse(res);
    return v.success ? v.data : res;
}
