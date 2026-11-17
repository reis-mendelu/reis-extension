import { describe, it, expect, vi } from 'vitest';

let resolveRead: (v: unknown) => void = () => {};
vi.mock('../../../services/storage/IndexedDBService', () => ({
  IndexedDBService: {
    get: vi.fn(() => new Promise((r) => (resolveRead = r))),
    set: vi.fn(async () => undefined),
  },
}));

import { useAppStore } from '../../useAppStore';

/**
 * The boot read of the "Od spolků a MENDELU" switch can land after the
 * student has already flipped it: their choice wins over the stored value.
 */
describe('the societies switch at boot', () => {
  it('keeps a change the student made while the stored value was loading', async () => {
    useAppStore.setState({ notifySocieties: true } as never);
    const load = useAppStore.getState().loadNotifySocieties();
    useAppStore.getState().setNotifySocieties(false);
    resolveRead(true);
    await load;
    expect(useAppStore.getState().notifySocieties).toBe(false);
  });

  it('applies the stored value when nothing changed meanwhile', async () => {
    useAppStore.setState({ notifySocieties: true } as never);
    const load = useAppStore.getState().loadNotifySocieties();
    resolveRead(false);
    await load;
    expect(useAppStore.getState().notifySocieties).toBe(false);
  });
});
