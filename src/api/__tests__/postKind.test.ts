import { describe, it, expect, vi } from 'vitest';
import { toMapEvent, fetchMapEvents } from '../mapEvents';
import { toRow, type PostInput } from '../societyPosts';
import { toPatch } from '../../components/CampusMap/composerPost';
import { buildPostInput } from '../../components/CampusMap/composerRules';
import { devSocietyStore } from '../../utils/mock/devSociety';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import { supabase } from '../../services/spolky/supabaseClient';

vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

// A post is an EVENT (Akce list, pins, Novinky) or a NOTICE (Novinky only).
// "Hledáš bydlení v Brně?" is the notice that showed up among the parties.

const row = {
  id: 'e1',
  association_id: 'reis',
  title: 'Hledáš bydlení v Brně?',
  category: 'other',
  date: '2099-10-20',
  end_date: null,
  time: null,
  venue_kind: 'tba',
  room_code: null,
  coord_lng: null,
  coord_lat: null,
  location: null,
  url: 'https://example.org/form',
};

const input: PostInput = {
  title: 'Party',
  body: '',
  category: 'party',
  date: '2026-07-10',
  venueKind: 'tba',
};

describe('toMapEvent — the post kind', () => {
  it('carries a notice through, for the console that lists its own', () =>
    expect(toMapEvent({ ...row, kind: 'notice' }, BUNDLED_SOCIETIES).kind).toBe('notice'));

  // Before the migration the column is absent; afterwards every old row reads
  // 'event'. Either way the post is what it always was.
  it('reads a row with no kind, or one it does not know, as an event', () => {
    expect(toMapEvent(row, BUNDLED_SOCIETIES).kind).toBe('event');
    expect(toMapEvent({ ...row, kind: null }, BUNDLED_SOCIETIES).kind).toBe('event');
    expect(toMapEvent({ ...row, kind: 'poll' }, BUNDLED_SOCIETIES).kind).toBe('event');
  });
});

describe('fetchMapEvents — notices never reach the map', () => {
  it('drops notices and keeps events, so Akce, pins and map search never see one', async () => {
    const or = vi.fn().mockReturnThis();
    const order = vi.fn().mockResolvedValue({
      data: [
        { ...row, id: 'notice', kind: 'notice' },
        { ...row, id: 'event', kind: 'event', title: 'Pub Quiz' },
        { ...row, id: 'legacy', title: 'Beerpong' }, // no column yet
      ],
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue({ select: () => ({ or, order }) } as never);
    const events = await fetchMapEvents(BUNDLED_SOCIETIES);
    expect(events?.map((e) => e.id)).toEqual(['event', 'legacy']);
  });
});

describe('writing the kind', () => {
  it('a new post is an event unless the composer says otherwise', () => {
    expect(toRow(input, 'reis', 'a@b').kind).toBe('event');
    expect(toRow({ ...input, kind: 'notice' }, 'reis', 'a@b').kind).toBe('notice');
  });

  // Left out of the patch, switching a post's kind saved cleanly and changed nothing.
  it('an edit writes the kind, both ways', () => {
    expect(toPatch({ ...input, kind: 'notice' }).kind).toBe('notice');
    expect(toPatch({ ...input, kind: 'event' }).kind).toBe('event');
  });

  it('the dev store keeps the kind it was given', () => {
    devSocietyStore.reset();
    devSocietyStore.create({ ...input, kind: 'notice' }, 'reis', 'a@b');
    devSocietyStore.create(input, 'reis', 'a@b');
    expect(devSocietyStore.list('reis').map((p) => p.kind)).toEqual(['notice', 'event']);
  });
});

describe('buildPostInput — a notice has no place', () => {
  const draft = {
    title: 'Hledáš bydlení?',
    description: '',
    emoji: '1f3e0',
    fallbackCategory: 'other' as const,
    startEmoji: null,
    date: '2026-10-20',
    endDate: '',
    time: '',
    room: { code: 'Q01', coord: [16.61, 49.21] as [number, number] },
    coord: [16.61, 49.21] as [number, number],
    placeName: 'Aula',
    url: 'https://example.org/form',
    subscribersOnly: false,
  };

  // The venue fields are hidden for a notice, but their state survives a
  // switch from event: without this an event turned notice kept its room.
  it('drops a venue picked before the switch, so the row stays placeless', () => {
    const out = buildPostInput({ ...draft, kind: 'notice' });
    expect(out).toMatchObject({
      kind: 'notice',
      venueKind: 'tba',
      roomCode: null,
      coordLng: null,
      coordLat: null,
      location: null,
      date: '2026-10-20',
      url: 'https://example.org/form',
    });
  });

  // Novinky draws no picture. A party popper left on a notice is what an old
  // build, still listing it in Akce, would draw beside "Hledáš bydlení?".
  it('carries no picture: no emoji, filed under other', () => {
    const out = buildPostInput({ ...draft, emoji: '1f389', kind: 'notice' });
    expect(out).toMatchObject({ emoji: null, category: 'other' });
  });

  it('an event keeps its venue', () => {
    const out = buildPostInput({ ...draft, kind: 'event' });
    expect(out).toMatchObject({ kind: 'event', venueKind: 'campus', roomCode: 'Q01' });
  });
});
