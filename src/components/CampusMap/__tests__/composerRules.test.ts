import { describe, it, expect } from 'vitest';
import { isComposerReady, deriveVenue, buildPostInput } from '../composerRules';

const draft = {
  title: 'Pub Quiz',
  description: '',
  emoji: '1f9e0',
  fallbackCategory: 'quiz' as const,
  date: '2026-10-13',
  endDate: '',
  time: '',
  room: null,
  coord: null,
  placeName: null,
  url: '',
  subscribersOnly: false,
};

describe('composerRules', () => {
  it('needs only a title and a date', () => {
    expect(
      isComposerReady({ title: 'x', date: '2026-10-13', endDate: '', urlInvalid: false })
    ).toBe(true);
    expect(
      isComposerReady({ title: ' ', date: '2026-10-13', endDate: '', urlInvalid: false })
    ).toBe(false);
    expect(isComposerReady({ title: 'x', date: '', endDate: '', urlInvalid: false })).toBe(false);
  });

  it('rejects an end date before the start and a bad url', () => {
    expect(
      isComposerReady({ title: 'x', date: '2026-10-13', endDate: '2026-10-12', urlInvalid: false })
    ).toBe(false);
    expect(isComposerReady({ title: 'x', date: '2026-10-13', endDate: '', urlInvalid: true })).toBe(
      false
    );
  });

  it('derives the venue kind', () => {
    expect(deriveVenue({ code: 'Q01' }, [16, 49])).toBe('campus');
    expect(deriveVenue(null, [16, 49])).toBe('offcampus');
    expect(deriveVenue(null, null)).toBe('tba');
  });

  // A code a newer build added: this build cannot judge it, so an edit keeps
  // it and keeps the category the event already had.
  it("keeps an emoji this build does not ship, and the event's category", () => {
    const input = buildPostInput({ ...draft, emoji: '1f9a9', fallbackCategory: 'sports' });
    expect(input.emoji).toBe('1f9a9');
    expect(input.category).toBe('sports');
  });

  it('files the event under the category its emoji maps to', () => {
    const input = buildPostInput({ ...draft, emoji: '26f8' });
    expect(input.emoji).toBe('26f8');
    expect(input.category).toBe('sports');
  });

  it('builds a tba input with nulls, and end date only when set', () => {
    const i = buildPostInput(draft);
    expect(i).toMatchObject({
      venueKind: 'tba',
      time: null,
      roomCode: null,
      coordLng: null,
      coordLat: null,
      location: null,
      url: null,
      endDate: null,
    });
    expect(buildPostInput({ ...draft, endDate: '2026-10-15' }).endDate).toBe('2026-10-15');
  });

  it('an end date equal to the start is stored as none', () =>
    expect(buildPostInput({ ...draft, endDate: '2026-10-13' }).endDate).toBeNull());
});
