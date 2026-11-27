// What the ledger accepts from Claude (step 4b of the map): every field is untrusted text, so
// dates must be real days, strings bounded, and an inferred date must say how.
import { describe, it, expect } from 'vitest';
import { finish, isDay, LedgerInputError } from '../ledgerEntry';
import { parseFields, parseStored } from '../ledgerFields';

const META = {
  id: 'ev-0123456789ab',
  savedAt: '2026-11-25T10:00:00.000Z',
  updatedAt: '2026-11-25T10:00:00.000Z',
};
const base = {
  title: 'Zápočtový test 1',
  kind: 'credit_test',
  date: '2026-12-10',
  source_kind: 'student',
};
const make = (over: Record<string, unknown> = {}) =>
  finish(parseFields({ ...base, ...over }) as never, META);
const rejects = (over: Record<string, unknown>, message: RegExp) => {
  expect(() => make(over)).toThrow(LedgerInputError);
  expect(() => make(over)).toThrow(message);
};

describe('dates and times', () => {
  it('accepts only real calendar days', () => {
    expect(['2026-12-10', '2028-02-29', '2000-01-01'].every(isDay)).toBe(true);
    for (const d of [
      '2026-02-30',
      '2027-02-29',
      '2026-13-01',
      '26-12-10',
      '2026-12-1',
      '1999-12-31',
      '2101-01-01',
      '',
      20261210,
    ]) {
      expect(isDay(d), String(d)).toBe(false);
    }
    rejects({ date: '2026-02-30' }, /real date/);
  });

  it('wants HH:MM on a 24-hour clock', () => {
    expect(make({ time: '09:05' }).time).toBe('09:05');
    for (const t of ['9:05', '24:00', '12:60', '12.30', '1230']) rejects({ time: t }, /HH:MM/);
  });

  it('keeps a window in order and bounded', () => {
    expect(make({ date: '2026-12-14', until: '2026-12-18' }).until).toBe('2026-12-18');
    rejects({ date: '2026-12-14', until: '2026-12-13' }, /before date/);
    rejects({ date: '2026-12-14', until: '2027-03-01' }, /at most 60 days/);
  });

  it('takes an unregister deadline as a day or a day and time', () => {
    expect(make({ unregister_by: '2026-12-08' }).unregisterBy).toBe('2026-12-08');
    expect(make({ unregister_by: '2026-12-08 12:00' }).unregisterBy).toBe('2026-12-08 12:00');
    rejects({ unregister_by: '8.12.2026' }, /unregister_by/);
    rejects({ unregister_by: '2026-12-08T12:00' }, /unregister_by/);
  });
});

describe('text and numbers', () => {
  it('trims, bounds every string and refuses control characters', () => {
    expect(make({ room: '  Q01  ' }).room).toBe('Q01');
    rejects({ title: 'x'.repeat(121) }, /title is 121 characters; the most is 120/);
    rejects({ rule: 'x'.repeat(501) }, /rule is 501/);
    rejects({ room: 'Q\u0000' }, /control character/);
    rejects({ title: 42 }, /title must be text/);
  });

  it('needs a title, a kind, a date and a source', () => {
    expect(() =>
      finish(parseFields({ kind: 'test', date: '2026-12-10', source_kind: 'mail' }) as never, META)
    ).toThrow(/title is required/);
    expect(() =>
      finish(parseFields({ title: 't', date: '2026-12-10', source_kind: 'mail' }) as never, META)
    ).toThrow(/kind is required/);
    expect(() =>
      finish(parseFields({ title: 't', kind: 'test', source_kind: 'mail' }) as never, META)
    ).toThrow(/date is required/);
    expect(() =>
      finish(parseFields({ title: 't', kind: 'test', date: '2026-12-10' }) as never, META)
    ).toThrow(/source_kind is required/);
    rejects({ kind: 'party' }, /kind must be one of/);
    rejects({ source_kind: 'rumour' }, /source_kind must be one of/);
  });

  it('checks length, subject code and the attendance flag', () => {
    expect(make({ length_minutes: 90, code: 'ebc-pe' })).toMatchObject({
      lengthMinutes: 90,
      code: 'EBC-PE',
    });
    for (const n of [0, 1441, 1.5, '90']) rejects({ length_minutes: n }, /length_minutes/);
    rejects({ code: 'not a code!' }, /subject code/);
    rejects({ attendance: 'yes' }, /true or false/);
  });

  it('defaults attendance by kind and lets Claude overrule it', () => {
    expect(make({ kind: 'defence' }).attendance).toBe(true);
    expect(make({ kind: 'event' }).attendance).toBe(false);
    expect(make({ kind: 'programme_day', attendance: false }).attendance).toBe(false);
  });
});

describe('where a date came from', () => {
  it('needs a course file to say which file and which version of it', () => {
    rejects({ source_kind: 'course_file' }, /source_url is required/);
    rejects(
      { source_kind: 'course_file', source_url: 'https://is.mendelu.cz/x?download=1' },
      /source_modified is required/
    );
    const e = make({
      source_kind: 'course_file',
      source_url: 'https://is.mendelu.cz/x?download=1',
      source_modified: '1. 10. 2026',
    });
    expect(e.sourceUrl).toBeTruthy();
    rejects(
      { source_url: 'https://example.com/a' },
      /only for an event that comes from a course file/
    );
  });

  it('wants an inferred date to say how, and a stated one not to', () => {
    rejects({ basis: 'inferred' }, /inferred_how is required/);
    expect(make({ basis: 'inferred', inferred_how: 'the 12th week starts 14 Dec' })).toMatchObject({
      basis: 'inferred',
    });
    rejects({ basis: 'stated', inferred_how: 'guessed' }, /only for an inferred date/);
    expect(make({}).basis).toBe('stated');
  });
});

describe('what is read back from disk', () => {
  it('survives a round trip, and a damaged or hand-edited file is not an entry', () => {
    const e = make({ room: 'Q01', points: '20', time: '09:00' });
    expect(parseStored(JSON.stringify(e))).toEqual(e);
    expect(parseStored('{not json')).toBeNull();
    expect(parseStored(undefined)).toBeNull();
    expect(parseStored(JSON.stringify({ ...e, date: '2026-02-30' }))).toBeNull();
    expect(parseStored(JSON.stringify({ ...e, id: '../../etc' }))).toBeNull();
    expect(parseStored(JSON.stringify({ ...e, kind: 'party' }))).toBeNull();
    expect(parseStored('[]')).toBeNull();
  });
});
