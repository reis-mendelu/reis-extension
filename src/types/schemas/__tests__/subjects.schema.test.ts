import { describe, it, expect } from 'vitest';
import { SubjectsDataSchema } from '../subjects.schema';
import type { SubjectsData } from '../../documents';

// A representative real subjects payload (mirrors what syncSubjects writes).
const realData: SubjectsData = {
  version: 1,
  lastUpdated: '2026-07-06T10:00:00.000Z',
  data: {
    'EBC-ALG': {
      displayName: 'Algebra',
      fullName: 'Algebra (EBC-ALG)',
      nameCs: 'Algebra',
      nameEn: 'Algebra',
      subjectCode: 'EBC-ALG',
      subjectId: '123456',
      folderUrl: 'https://is.mendelu.cz/dok_server/folder.pl?id=1',
      fetchedAt: '2026-07-06T10:00:00.000Z',
      hasPrubezne: true,
      hasTest: false,
      autoHref: null,
    },
  },
};

describe('SubjectsDataSchema', () => {
  it('accepts a representative real subjects payload (never drops valid data)', () => {
    expect(SubjectsDataSchema.safeParse(realData).success).toBe(true);
  });

  it('accepts unknown/future IS fields via passthrough', () => {
    const withExtra = {
      ...realData,
      futureField: 'x',
      data: {
        ...realData.data,
        'EBC-ALG': { ...realData.data['EBC-ALG'], brandNewFlag: true },
      },
    };
    expect(SubjectsDataSchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts a subject entry missing all optional fields', () => {
    const minimal = {
      version: 1,
      lastUpdated: '2026-07-06T10:00:00.000Z',
      data: {
        'EBC-ALG': {
          displayName: 'Algebra',
          fullName: 'Algebra (EBC-ALG)',
          subjectCode: 'EBC-ALG',
          folderUrl: 'https://is.mendelu.cz/dok_server/folder.pl?id=1',
          fetchedAt: '2026-07-06T10:00:00.000Z',
        },
      },
    };
    expect(SubjectsDataSchema.safeParse(minimal).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(SubjectsDataSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: data is not an object', () => {
    expect(SubjectsDataSchema.safeParse({ ...realData, data: 'nope' }).success).toBe(false);
  });

  it('rejects genuine corruption: subject entry missing subjectCode', () => {
    const { subjectCode: _subjectCode, ...noCode } = realData.data['EBC-ALG'];
    const corrupted = { ...realData, data: { 'EBC-ALG': noCode } };
    expect(SubjectsDataSchema.safeParse(corrupted).success).toBe(false);
  });

  it('rejects genuine corruption: missing version', () => {
    const { version: _version, ...noVersion } = realData;
    expect(SubjectsDataSchema.safeParse(noVersion).success).toBe(false);
  });
});
