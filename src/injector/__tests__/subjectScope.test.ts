import { describe, it, expect } from 'vitest';
import { currentSemesterEntries } from '../subjectScope';

const entries: [string, { folderUrl: string }][] = [
  ['EBC-ALG', { folderUrl: 'a' }],
  ['EBC-STA', { folderUrl: 'b' }],
  ['EBC-OLD', { folderUrl: 'c' }],
];

describe('currentSemesterEntries', () => {
  it('keeps only the subjects the student is enrolled in now', () => {
    const scoped = currentSemesterEntries(entries, ['EBC-ALG', 'EBC-STA']);
    expect(scoped.map(([code]) => code)).toEqual(['EBC-ALG', 'EBC-STA']);
  });

  it('keeps everything when the current semester is unknown', () => {
    // The subjects fetch failed or never ran in this context. Crawling
    // everything is wasteful; crawling nothing leaves the student with no
    // files at all, which is worse than the cost this exists to cut.
    expect(currentSemesterEntries(entries, null)).toHaveLength(3);
  });

  it('crawls nothing when the student is enrolled in nothing this semester', () => {
    // An empty list is an answer, not a missing one — the difference between it
    // and null is the whole point of the null.
    expect(currentSemesterEntries(entries, [])).toHaveLength(0);
  });

  it('keeps everything when the codes match nothing in the map', () => {
    // Two lists that share no key came from different places — that is a bug,
    // not an answer about this student's semester.
    expect(currentSemesterEntries(entries, ['SOMETHING-ELSE'])).toHaveLength(3);
  });

  it('ignores current codes that are absent from the map', () => {
    const scoped = currentSemesterEntries(entries, ['EBC-ALG', 'EBC-GONE']);
    expect(scoped.map(([code]) => code)).toEqual(['EBC-ALG']);
  });

  it('does not mutate the input', () => {
    const copy = [...entries];
    currentSemesterEntries(entries, ['EBC-ALG']);
    expect(entries).toEqual(copy);
  });
});
