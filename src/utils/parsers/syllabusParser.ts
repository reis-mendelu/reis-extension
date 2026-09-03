import { SyllabusRequirementsSchema } from '../../schemas/syllabusSchema';
import { parseRequirementsText } from './syllabus/requirementParser';
import { parseRequirementsTable } from './syllabus/gradingParser';
import { parseCourseMetadata } from './syllabus/metadataParser';
import { parseCourseObjectives } from './syllabus/objectivesParser';
import { parseCourseContent } from './syllabus/contentParser';

import type { SyllabusRequirements } from '../../schemas/syllabusSchema';

/**
 * Schema version of a parsed syllabus, and the value the store's cache check
 * compares against — `createSyllabusSlice` imports this rather than declaring
 * its own. Owned here because the parser is what produces the shape.
 *
 * It has to be one constant. b8b6e2f1 raised the store's copy to 4 to force a
 * one-time refetch ("newest predmetId") but left this stamping 3, so a cached
 * syllabus could never satisfy the check and every cold boot refetched every
 * syllabus from IS — a permanent cache miss dressed as a one-time flush.
 *
 * Raising this number is still the way to invalidate the cache on purpose:
 * existing records refetch once, then match again.
 */
// `as const` so the stamp stays the literal 4 rather than widening to `number`,
// which the schema's version union will not accept.
export const SYLLABUS_VERSION = 4 as const;

export function parseSyllabusOffline(html: string, lang: string = 'cz'): SyllabusRequirements {
    if (!html || typeof html !== 'string') return { version: 1 as const, requirementsText: 'Error: Section not found', requirementsTable: [] };
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const res = {
        version: SYLLABUS_VERSION,
        requirementsText: parseRequirementsText(doc),
        requirementsTable: parseRequirementsTable(doc),
        courseInfo: parseCourseMetadata(doc, lang),
        objectivesText: parseCourseObjectives(doc),
        contentText: parseCourseContent(doc),
    };
    const v = SyllabusRequirementsSchema.safeParse(res);
    return v.success ? v.data : res;
}
