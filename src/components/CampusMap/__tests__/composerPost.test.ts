import { describe, it, expect } from 'vitest';
import { toPatch, latestCategory } from '../composerPost';
import type { PostInput } from '../../../api/societyPosts';

const input: PostInput = {
  title: 'Deskovky',
  body: 'Hry máme.',
  category: 'boardgames',
  emoji: '1f3b2',
  date: '2026-07-08',
  time: '18:00',
  venueKind: 'offcampus',
  roomCode: null,
  coordLng: 16.6,
  coordLat: 49.2,
  location: 'Klub',
  url: null,
  subscribersOnly: true,
};

describe('toPatch', () => {
  it('writes the emoji, so an edit can change the picture', () =>
    expect(toPatch({ ...input, emoji: '26f8' }).emoji).toBe('26f8'));

  it('maps every field the composer edits to its column', () => {
    expect(toPatch(input)).toEqual({
      title: 'Deskovky',
      body: 'Hry máme.',
      category: 'boardgames',
      emoji: '1f3b2',
      date: '2026-07-08',
      end_date: null,
      time: '18:00',
      venue_kind: 'offcampus',
      room_code: null,
      coord_lng: 16.6,
      coord_lat: 49.2,
      location: 'Klub',
      url: null,
      subscribers_only: true,
    });
  });

  // The composer now has an end-date field, so the patch writes it. It still
  // never writes `visible_from`, which the composer has no field for: writing
  // it would null a value the society never saw.
  it('writes end_date but leaves visible_from and ownership columns alone', () => {
    const patch = toPatch({ ...input, endDate: '2026-07-10', visibleFrom: '2026-07-01' });
    expect(patch.end_date).toBe('2026-07-10');
    expect(patch).not.toHaveProperty('visible_from');
    expect(patch).not.toHaveProperty('association_id');
    expect(patch).not.toHaveProperty('created_by');
  });
});

describe('latestCategory', () => {
  it('is the category of the latest-dated post, whatever the order', () => {
    expect(
      latestCategory([
        { date: '2026-07-20', category: 'quiz' },
        { date: '2026-07-01', category: 'party' },
      ])
    ).toBe('quiz');
  });

  it('is null for a society with no posts, or an unknown category', () => {
    expect(latestCategory([])).toBeNull();
    expect(latestCategory([{ date: '2026-07-01', category: 'rave' }])).toBeNull();
  });
});
