import { describe, it, expect, beforeEach, vi } from 'vitest';
import { acquireBackupLock, releaseBackupLock } from '../driveManifest';

const LOCK_KEY = 'reis_drive_lock';

/** Wire the bare chrome.storage.local stubs to an in-memory backing store. */
let store: Record<string, unknown>;
function wireStore() {
    vi.mocked(chrome.storage.local.get).mockImplementation((async (k: string) =>
        (k in store ? { [k]: store[k] } : {})) as never);
    vi.mocked(chrome.storage.local.set).mockImplementation((async (obj: Record<string, unknown>) => {
        Object.assign(store, obj);
    }) as never);
    vi.mocked(chrome.storage.local.remove).mockImplementation((async (k: string) => {
        delete store[k];
    }) as never);
}

describe('drive backup lock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        store = {};
        wireStore();
    });

    it('acquires when free and stores an owner token record', async () => {
        const ok = await acquireBackupLock();
        expect(ok).toBe(true);
        expect(store[LOCK_KEY]).toMatchObject({ token: expect.any(String), at: expect.any(Number) });
    });

    it('refuses a second acquire while a fresh lock is held', async () => {
        await acquireBackupLock();
        expect(await acquireBackupLock()).toBe(false);
    });

    it('re-acquires a lock older than the TTL (abandoned)', async () => {
        store[LOCK_KEY] = { token: 'stale', at: Date.now() - 16 * 60 * 1000 };
        const ok = await acquireBackupLock();
        expect(ok).toBe(true);
        expect((store[LOCK_KEY] as { token: string }).token).not.toBe('stale');
    });

    it('loses the race when a competitor overwrites between set and read-back', async () => {
        let gets = 0;
        vi.mocked(chrome.storage.local.get).mockImplementation((async () => {
            gets++;
            // 1st get = initial free check; 2nd get = read-back → competitor won.
            return gets >= 2 ? { [LOCK_KEY]: { token: 'competitor', at: Date.now() } } : {};
        }) as never);
        expect(await acquireBackupLock()).toBe(false);
    });

    it('release removes the lock we own', async () => {
        await acquireBackupLock();
        await releaseBackupLock();
        expect(store[LOCK_KEY]).toBeUndefined();
    });

    it('release never clobbers a lock owned by another context', async () => {
        await acquireBackupLock();
        // Our lock expired and another tab legitimately took over.
        store[LOCK_KEY] = { token: 'foreign', at: Date.now() };
        await releaseBackupLock();
        expect(store[LOCK_KEY]).toEqual({ token: 'foreign', at: expect.any(Number) });
    });
});
