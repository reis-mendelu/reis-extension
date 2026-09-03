import { describe, it, expect } from 'vitest';
import { StoredSyllabusSchema, SyllabusSchema } from '../syllabus.schema';
import type { SyllabusRequirements } from '../../documents';
import { parseSyllabusOffline, SYLLABUS_VERSION } from '../../../utils/parsers/syllabusParser';

const realData: SyllabusRequirements = {
  version: 1,
  language: 'cs',
  courseId: '159410',
  requirementsText: 'Požadavky na ukončení předmětu...',
  requirementsTable: [
    ['Typ', 'Body'],
    ['Zkouška', '60'],
  ],
  courseInfo: {
    // No `courseCode` here: the syllabus parser never emits one (see
    // parseCourseMetadata), so no real record has it. It survives as a dead
    // optional key on `documents.CourseMetadata` only. Unknown keys are
    // covered by the passthrough test below.
    courseName: 'Algoritmizace',
    credits: '6',
    garant: { name: 'prof. X', id: '123' },
    teachers: [{ name: 'Dr. Y', roles: 'cvičící' }],
    status: 'aktivní',
  },
  objectivesText: 'Studenti se naučí...',
  contentText: 'Obsah předmětu...',
};

describe('StoredSyllabusSchema', () => {
  it('accepts a representative real syllabus (never drops valid data)', () => {
    expect(StoredSyllabusSchema.safeParse(realData).success).toBe(true);
  });

  it('accepts unknown/future IS fields via passthrough', () => {
    const withExtra = {
      ...realData,
      futureField: 'x',
      courseInfo: { ...realData.courseInfo, brandNewFlag: true },
    };
    expect(StoredSyllabusSchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts a minimal syllabus with only the required anchors', () => {
    const minimal = { requirementsText: 'text', requirementsTable: [] };
    expect(StoredSyllabusSchema.safeParse(minimal).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(StoredSyllabusSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: requirementsTable is not an array', () => {
    expect(StoredSyllabusSchema.safeParse({ ...realData, requirementsTable: 'nope' }).success).toBe(
      false
    );
  });

  it('rejects genuine corruption: missing requirementsText', () => {
    const { requirementsText: _requirementsText, ...noText } = realData;
    expect(StoredSyllabusSchema.safeParse(noText).success).toBe(false);
  });
});

describe('SyllabusSchema (union used by the IDB store)', () => {
  it('accepts the legacy single-language shape', () => {
    expect(SyllabusSchema.safeParse(realData).success).toBe(true);
  });

  it('accepts the dual-language shape', () => {
    expect(SyllabusSchema.safeParse({ cz: realData, en: realData }).success).toBe(true);
  });

  it('rejects genuine corruption: null', () => {
    expect(SyllabusSchema.safeParse(null).success).toBe(false);
  });
});

// The two syllabus schema layers are deliberately asymmetric: the parse schema
// (src/schemas/syllabusSchema.ts) is strict and version-required, this one is
// fail-open and permissive. Nothing but a round trip proves they still agree —
// a field whose declared TYPE conflicts between the layers is not saved by
// `.passthrough()`, and a write that fails validation is silently dropped.
//
// So: parse real HTML, enrich it the way api/syllabus.ts does, wrap it the way
// syncSyllabus writes it, and read it back through the store validator.
describe('parse -> enrich -> store round trip', () => {
  const HTML = `
    <html><body>
      <table>
        <tr><td><strong>Požadavky na ukončení</strong></td></tr>
        <tr><td>Zkouška a semestrální projekt.</td></tr>
      </table>
      <table>
        <tr><td>Způsob ukončení</td><td><b>Zkouška</b></td></tr>
        <tr><td>Garant předmětu</td><td><a href="/auth/lide/clovek.pl?id=12345">prof. X</a></td></tr>
        <tr><td>Vyučující</td><td><a href="/auth/lide/clovek.pl?id=22222">Dr. Y</a> (cvičící)</td></tr>
        <tr><td>Typ předmětu</td><td>povinný</td></tr>
      </table>
    </body></html>
  `;

  const fresh = (lang: 'cz' | 'en') => ({
    ...parseSyllabusOffline(HTML, lang),
    courseId: '159410',
    language: lang,
  });

  it('a freshly parsed, enriched, dual-language record passes the store validator', () => {
    // Attribution guard: if the parser stopped finding the section, the
    // sentinel record would still validate and this suite would go quiet on a
    // real break (or fail later for a reason that reads as schema drift).
    expect(fresh('cz').requirementsText).not.toMatch(/^Error:/);

    const result = SyllabusSchema.safeParse({ cz: fresh('cz'), en: fresh('en') });
    expect(result.success).toBe(true);
  });

  it('keeps the two fields the cache check reads (version, language)', () => {
    // `createSyllabusSlice` short-circuits on `language === currentLang &&
    // version === SYLLABUS_VERSION`. If the validator stripped or rejected
    // either one, every cold boot would refetch every syllabus — the #269 bug.
    const result = SyllabusSchema.safeParse({ cz: fresh('cz'), en: fresh('en') });
    expect(result.success).toBe(true);
    if (!result.success || !('cz' in result.data)) return;
    expect(result.data.cz.version).toBe(SYLLABUS_VERSION);
    expect(result.data.cz.language).toBe('cz');
    expect(result.data.en.language).toBe('en');
  });
});
