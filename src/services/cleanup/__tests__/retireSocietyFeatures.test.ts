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

const RETIRED = [
  'event_rsvps_mine',
  'reis_subscribed_associations',
  'reis_associations_chosen',
  'reis_erasmus_auto_subscribed',
  'reis_muted_associations',
  'reis_notify_prefs',
  'reis_notify_asked',
];

/**
 * What follow, RSVP and the reminders leave behind on a device that ran 5.3.0
 * (spec 2026-10-08): RSVP blocks nothing can remove any more, follow and
 * notification settings, and scheduled 2-hour reminders.
 */
describe('retireSocietyFeatures', () => {
  beforeEach(() => {
    stores.meta.clear();
    stores.custom_events.clear();
    for (const k of RETIRED) stores.meta.set(k, 'stale');
    for (const [k, v] of [
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
    for (const k of RETIRED) expect(stores.meta.has(k), k).toBe(false);
    expect(stores.meta.has('notifications_cache')).toBe(true);
    expect(stores.meta.get('seen_deadline_alerts')).toEqual(['a']);
    expect(stores.meta.get('read_notifications')).toEqual(['b']);
    expect(clear).toHaveBeenCalledOnce();

    await retireSocietyFeatures({ clearScheduledNotifications: clear });
    expect(clear).toHaveBeenCalledOnce();
  });

  it('a failed notification clear does not mark it done, so the next boot retries', async () => {
    const clear = vi.fn(async () => {}).mockRejectedValueOnce(new Error('plugin'));
    await retireSocietyFeatures({ clearScheduledNotifications: clear });
    expect(stores.meta.has('retired_society_features_v1')).toBe(false);
    await retireSocietyFeatures({ clearScheduledNotifications: clear });
    expect(clear).toHaveBeenCalledTimes(2);
    expect(stores.meta.get('retired_society_features_v1')).toBe(true);
  });
});
