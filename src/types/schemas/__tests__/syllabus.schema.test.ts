import { describe, it, expect } from 'vitest';
import { SyllabusRequirementsSchema, SyllabusSchema } from '../syllabus.schema';
import type { SyllabusRequirements } from '../../documents';

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
    courseName: 'Algoritmizace',
    courseCode: 'DSND',
    credits: '6',
    garant: { name: 'prof. X', id: '123' },
    teachers: [{ name: 'Dr. Y', roles: 'cvičící' }],
    status: 'aktivní',
  },
  objectivesText: 'Studenti se naučí...',
  contentText: 'Obsah předmětu...',
};

describe('SyllabusRequirementsSchema', () => {
  it('accepts a representative real syllabus (never drops valid data)', () => {
    expect(SyllabusRequirementsSchema.safeParse(realData).success).toBe(true);
  });

  it('accepts unknown/future IS fields via passthrough', () => {
    const withExtra = {
      ...realData,
      futureField: 'x',
      courseInfo: { ...realData.courseInfo, brandNewFlag: true },
    };
    expect(SyllabusRequirementsSchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts a minimal syllabus with only the required anchors', () => {
    const minimal = { requirementsText: 'text', requirementsTable: [] };
    expect(SyllabusRequirementsSchema.safeParse(minimal).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(SyllabusRequirementsSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: requirementsTable is not an array', () => {
    expect(
      SyllabusRequirementsSchema.safeParse({ ...realData, requirementsTable: 'nope' }).success
    ).toBe(false);
  });

  it('rejects genuine corruption: missing requirementsText', () => {
    const { requirementsText: _requirementsText, ...noText } = realData;
    expect(SyllabusRequirementsSchema.safeParse(noText).success).toBe(false);
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
