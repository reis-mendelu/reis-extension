import { describe, it, expect } from 'vitest';
import { ClassmatesSchema } from '../classmates.schema';
import type { ClassmatesData } from '../../classmates';

// A representative real classmate list (mirrors what fetchClassmatesForSubject writes).
const realData: ClassmatesData = [
  {
    personId: 12345,
    photoUrl: 'https://is.mendelu.cz/auth/lide/foto.pl?id=12345',
    name: 'Jan Novák',
    studyInfo: 'PEF, 2. ročník',
    messageUrl: 'https://is.mendelu.cz/auth/posta/napsat.pl?id=12345',
  },
];

describe('ClassmatesSchema', () => {
  it('accepts a representative real classmate list (never drops valid data)', () => {
    expect(ClassmatesSchema.safeParse(realData).success).toBe(true);
  });

  it('accepts an empty list (no classmates found)', () => {
    expect(ClassmatesSchema.safeParse([]).success).toBe(true);
  });

  it('accepts an entry missing the optional messageUrl', () => {
    const { messageUrl: _messageUrl, ...noMessageUrl } = realData[0]!; // safe: fixed 1-element literal
    expect(ClassmatesSchema.safeParse([noMessageUrl]).success).toBe(true);
  });

  it('accepts unknown/future fields via passthrough', () => {
    const withExtra = [{ ...realData[0], futureField: 'x' }];
    expect(ClassmatesSchema.safeParse(withExtra).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(ClassmatesSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: not an array', () => {
    expect(ClassmatesSchema.safeParse(realData[0]).success).toBe(false);
  });

  it('rejects genuine corruption: entry missing personId', () => {
    const { personId: _personId, ...noId } = realData[0]!; // safe: fixed 1-element literal
    expect(ClassmatesSchema.safeParse([noId]).success).toBe(false);
  });
});
