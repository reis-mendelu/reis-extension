import { describe, it, expect, beforeEach } from 'vitest';
import { devSocietyStore } from '../devSociety';
import type { PostInput } from '../../../api/societyPosts';

const input = (over: Partial<PostInput> = {}): PostInput => ({
  title: 'Party',
  body: '',
  category: 'party',
  date: '2026-07-20',
  venueKind: 'offcampus',
  coordLng: 16.61,
  coordLat: 49.19,
  location: 'Bar, který neexistuje',
  ...over,
});

describe('devSocietyStore (offline dev society CRUD)', () => {
  beforeEach(() => devSocietyStore.reset());

  it('create adds a row scoped to the association and returns its id', () => {
    const res = devSocietyStore.create(input(), 'reis', 'reis@dev.local');
    expect(res.id).toBeTruthy();
    const rows = devSocietyStore.list('reis');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      association_id: 'reis',
      title: 'Party',
      venue_kind: 'offcampus',
      coord_lng: 16.61,
      location: 'Bar, který neexistuje',
    });
  });

  it('list only returns rows for the given association', () => {
    devSocietyStore.create(input(), 'reis', 'x');
    devSocietyStore.create(input({ title: 'Other' }), 'esn', 'y');
    expect(devSocietyStore.list('reis')).toHaveLength(1);
    expect(devSocietyStore.list('esn')).toHaveLength(1);
  });

  it('update patches an existing row', () => {
    const { id } = devSocietyStore.create(input(), 'reis', 'x');
    devSocietyStore.update(id!, { title: 'Renamed', date: '2026-08-01' });
    const row = devSocietyStore.list('reis')[0]!;
    expect(row.title).toBe('Renamed');
    expect(row.date).toBe('2026-08-01');
  });

  it('delete removes the row', () => {
    const { id } = devSocietyStore.create(input(), 'reis', 'x');
    devSocietyStore.delete(id!);
    expect(devSocietyStore.list('reis')).toHaveLength(0);
  });

  it('assigns distinct ids to successive events', () => {
    const a = devSocietyStore.create(input(), 'reis', 'x');
    const b = devSocietyStore.create(input(), 'reis', 'x');
    expect(a.id).not.toBe(b.id);
  });
});
