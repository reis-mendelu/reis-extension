import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('../../storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => store.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void store.set(k, v)),
  },
}));

import { getInstallId, __resetInstallIdForTests } from '../installId';

beforeEach(() => {
  store.clear();
  __resetInstallIdForTests();
});

describe('getInstallId', () => {
  it('is a random uuid, not derived from anything about the student', async () => {
    const id = await getInstallId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('is stable across calls, so an RSVP can be changed and withdrawn', async () => {
    expect(await getInstallId()).toBe(await getInstallId());
  });

  it('survives a reload by living in IndexedDB', async () => {
    const first = await getInstallId();
    __resetInstallIdForTests();
    expect(await getInstallId()).toBe(first);
  });

  // The whole point: two installs must not collide, and neither may be
  // computable from a student id.
  it('differs between installs', async () => {
    const a = await getInstallId();
    store.clear();
    __resetInstallIdForTests();
    expect(await getInstallId()).not.toBe(a);
  });
});
