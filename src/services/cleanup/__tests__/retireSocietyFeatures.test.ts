import { describe, it, expect, vi, beforeEach } from 'vitest';

const stores = vi.hoisted(() => ({
  meta: new Map<string, unknown>(),
  custom_events: new Map<string, unknown>(),
}));
vi.mock('../../storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (s: keyof typeof stores, k: string) => stores[s].get(k)),
    set: vi.fn(async (s: keyof typeof stores, k: string, v: unknown) => void stores[s].set(k, v)),
    delete: vi.fn(async (s: keyof typeof stores, k: string) => void stores[s].delete(k)),
    getAllWithKeys: vi.fn(async (s: keyof typeof stores) =>
      [...stores[s].entries()].map(([key, value]) => ({ key, value }))
    ),
  },
}));

import { retireSocietyFeatures } from '../retireSocietyFeatures';

/**
 * What follow, RSVP and the reminders leave behind on a device that ran 5.3.0
 * (spec 2026-10-08): RSVP blocks nothing can remove any more, follow and
 * notification settings, a cached feed with no audience on its rows, and
 * scheduled 2-hour reminders.
 */
describe('retireSocietyFeatures', () => {
  beforeEach(() => {
    stores.meta.clear();
    stores.custom_events.clear();
    for (const [k, v] of [
      ['reis_subscribed_associations', ['supef']],
      ['event_rsvps_mine', {}],
      ['notifications_cache', [{ id: 'x' }]],
      ['seen_deadline_alerts', ['a']],
      ['read_notifications', ['b']],
    ] as const)
      stores.meta.set(k, v);
    stores.custom_events.set('rsvp:123', {});
    stores.custom_events.set('mine-1', {});
  });

  it('removes RSVP blocks and retired keys, keeps everything else, runs once', async () => {
    const clear = vi.fn(async () => {});
    await retireSocietyFeatures({ clearScheduledNotifications: clear });
    expect([...stores.custom_events.keys()]).toEqual(['mine-1']);
    expect(stores.meta.has('reis_subscribed_associations')).toBe(false);
    expect(stores.meta.has('event_rsvps_mine')).toBe(false);
    expect(stores.meta.has('notifications_cache')).toBe(false);
    expect(stores.meta.get('seen_deadline_alerts')).toEqual(['a']);
    expect(stores.meta.get('read_notifications')).toEqual(['b']);
    expect(clear).toHaveBeenCalledOnce();

    await retireSocietyFeatures({ clearScheduledNotifications: clear });
    expect(clear).toHaveBeenCalledOnce();
  });

  it('a failed notification clear does not mark it done, so the next boot retries', async () => {
    const clear = vi.fn(async () => {
      throw new Error('plugin');
    });
    await retireSocietyFeatures({ clearScheduledNotifications: clear });
    expect(stores.meta.has('retired_society_features_v1')).toBe(false);
  });
});
