import { describe, it, expect, beforeEach } from 'vitest';
import { chromeStorageAdapter } from '../chromeStorageAdapter';

describe('chromeStorageAdapter', () => {
  beforeEach(() => {
    const store: Record<string, unknown> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: async (k: string) => ({ [k]: store[k] }),
          set: async (obj: Record<string, unknown>) => {
            Object.assign(store, obj);
          },
          remove: async (k: string) => {
            delete store[k];
          },
        },
      },
    };
  });

  it('round-trips a value', async () => {
    await chromeStorageAdapter.setItem('reis_admin_auth', 'tok');
    expect(await chromeStorageAdapter.getItem('reis_admin_auth')).toBe('tok');
  });

  it('returns null for a missing key', async () => {
    expect(await chromeStorageAdapter.getItem('nope')).toBeNull();
  });

  it('removes a value', async () => {
    await chromeStorageAdapter.setItem('k', 'v');
    await chromeStorageAdapter.removeItem('k');
    expect(await chromeStorageAdapter.getItem('k')).toBeNull();
  });
});
