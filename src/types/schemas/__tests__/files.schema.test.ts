import { describe, it, expect } from 'vitest';
import { ParsedFileSchema, FilesSchema } from '../files.schema';
import type { ParsedFile } from '../../documents';

// A representative real file entry (mirrors what syncFiles writes).
const realFile: ParsedFile = {
  subfolder: 'Přednášky',
  file_name: 'Prezentace 1',
  file_comment: 'Úvodní prezentace',
  author: 'Jan Novák',
  date: '01.09.2026',
  files: [{ name: 'prezentace1.pdf', type: 'pdf', link: 'https://is.mendelu.cz/dok_server/file.pl?id=1' }],
};

describe('ParsedFileSchema', () => {
  it('accepts a representative real file entry (never drops valid data)', () => {
    expect(ParsedFileSchema.safeParse(realFile).success).toBe(true);
  });

  it('accepts unknown/future IS fields via passthrough', () => {
    const withExtra = { ...realFile, futureField: 'x', files: [{ ...realFile.files[0], brandNewFlag: true }] };
    expect(ParsedFileSchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts the optional language field', () => {
    expect(ParsedFileSchema.safeParse({ ...realFile, language: 'en' }).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(ParsedFileSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: files is not an array', () => {
    expect(ParsedFileSchema.safeParse({ ...realFile, files: 'nope' }).success).toBe(false);
  });

  it('rejects genuine corruption: missing subfolder', () => {
    const { subfolder: _subfolder, ...noSubfolder } = realFile;
    expect(ParsedFileSchema.safeParse(noSubfolder).success).toBe(false);
  });
});

describe('FilesSchema', () => {
  it('accepts the legacy array form', () => {
    expect(FilesSchema.safeParse([realFile]).success).toBe(true);
  });

  it('accepts the dual-language object form', () => {
    expect(FilesSchema.safeParse({ cz: [realFile], en: [realFile] }).success).toBe(true);
  });

  it('rejects genuine corruption: neither array nor dual-language object', () => {
    expect(FilesSchema.safeParse({ notCzOrEn: [] }).success).toBe(false);
  });

  it('rejects genuine corruption: null', () => {
    expect(FilesSchema.safeParse(null).success).toBe(false);
  });
});
