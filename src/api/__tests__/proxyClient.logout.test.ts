import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logout } from '../proxyClient';
import { setPlatform, __resetPlatformForTests } from '../../platform';
import type { ReisPlatform } from '../../platform/types';
import { IndexedDBService } from '../../services/storage/IndexedDBService';

function stub(kind: ReisPlatform['kind']): ReisPlatform {
  const bag = new Map<string, unknown>();
  return {
    kind,
    storage: {
      async get(k) {
        return bag.get(k);
      },
      async set(k, v) {
        bag.set(k, v);
      },
      async remove(k) {
        bag.delete(k);
      },
    },
    getAssetUrl: (p) => `/${p}`,
  };
}

describe('logout on Capacitor', () => {
  let clearAll: ReturnType<typeof vi.spyOn>;
  let postMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearAll = vi.spyOn(IndexedDBService, 'clearAll').mockResolvedValue(undefined);
    postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
  });
  afterEach(() => {
    clearAll.mockRestore();
    postMessage.mockRestore();
    __resetPlatformForTests();
  });

  it('does NOT wipe IndexedDB when the sign-out cannot actually happen', async () => {
    // A real sign-out POSTs /auth/system/logout.pl and the Capacitor transport
    // is GET-only. Wiping first and failing second left the student with an
    // emptied app AND a live session — the worst of both.
    setPlatform(stub('capacitor'));
    await expect(logout()).rejects.toThrow(/not available/i);
    expect(clearAll).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('still clears and dispatches on the extension', async () => {
    setPlatform(stub('extension'));
    void logout().catch(() => {});
    await vi.waitFor(() => expect(clearAll).toHaveBeenCalled());
    expect(postMessage).toHaveBeenCalledTimes(1);
    const msg = postMessage.mock.calls[0][0] as { type: string; action: string };
    expect(msg.type).toBe('REIS_ACTION');
    expect(msg.action).toBe('logout');
  });
});
