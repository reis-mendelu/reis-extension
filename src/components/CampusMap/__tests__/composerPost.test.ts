import { describe, it, expect } from 'vitest';
import { toPatch, latestCategory } from '../composerPost';
import type { PostInput } from '../../../api/societyPosts';

const input: PostInput = {
  title: 'Deskovky',
  body: 'Hry máme.',
  category: 'boardgames',
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
  it('maps every field the composer edits to its column', () => {
    expect(toPatch(input)).toEqual({
      title: 'Deskovky',
      body: 'Hry máme.',
      category: 'boardgames',
      date: '2026-07-08',
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

  // The composer has no field for these, so an edit must not write them: a
  // patch carrying `end_date: null` would silently cut a multi-day event down
  // to its first day.
  it('leaves columns the composer does not edit alone', () => {
    const patch = toPatch({ ...input, endDate: '2026-07-10', visibleFrom: '2026-07-01' });
    expect(patch).not.toHaveProperty('end_date');
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
