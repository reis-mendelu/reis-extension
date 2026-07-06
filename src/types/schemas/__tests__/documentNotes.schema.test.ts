import { describe, it, expect } from 'vitest';
import { DocumentNoteSchema } from '../documentNotes.schema';
import type { DocumentNote } from '../../documents';

const realData: DocumentNote = {
  note: 'Remember to review chapter 3 before the exam.',
  updatedAt: 1751800000000,
  fileName: 'Prezentace 1.pdf',
};

describe('DocumentNoteSchema', () => {
  it('accepts a representative real document note (never drops valid data)', () => {
    expect(DocumentNoteSchema.safeParse(realData).success).toBe(true);
  });

  it('accepts a note missing the optional fileName', () => {
    const { fileName: _fileName, ...noFileName } = realData;
    expect(DocumentNoteSchema.safeParse(noFileName).success).toBe(true);
  });

  it('accepts unknown/future fields via passthrough', () => {
    expect(DocumentNoteSchema.safeParse({ ...realData, futureField: 'x' }).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(DocumentNoteSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: updatedAt is not a number', () => {
    expect(DocumentNoteSchema.safeParse({ ...realData, updatedAt: 'nope' }).success).toBe(false);
  });

  it('rejects genuine corruption: missing note', () => {
    const { note: _note, ...noNote } = realData;
    expect(DocumentNoteSchema.safeParse(noNote).success).toBe(false);
  });
});
