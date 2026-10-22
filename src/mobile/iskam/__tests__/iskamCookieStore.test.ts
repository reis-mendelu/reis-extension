import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, unknown>();
const secureStorage = {
  get: vi.fn(async (k: string) => store.get(k)),
  set: vi.fn(async (k: string, v: unknown): Promise<void> => {
    store.set(k, v);
  }),
  remove: vi.fn(async (k: string): Promise<void> => {
    store.delete(k);
  }),
};
const prefs = new Map<string, unknown>();
const storage = {
  get: vi.fn(async (k: string) => prefs.get(k)),
  set: vi.fn(async (k: string, v: unknown): Promise<void> => {
    prefs.set(k, v);
  }),
  remove: vi.fn(async (k: string): Promise<void> => {
    prefs.delete(k);
  }),
};
vi.mock('../../../platform', () => ({
  getPlatform: () => ({ kind: 'capacitor', secureStorage, storage }),
}));

import {
  __resetIskamJarForTests,
  clearJar,
  jarGeneration,
  loadJar,
  saveJar,
} from '../iskamCookieStore';
import type { IskamJar } from '../iskamJar';
import { SignOutBlockedError } from '../../signOutCleanups';

const JAR: IskamJar = [
  { name: '.ISKAMASPXAUTH', value: 't', host: 'webiskam.mendelu.cz', path: '/', expires: null },
];

describe('iskamCookieStore', () => {
  beforeEach(() => {
    store.clear();
    prefs.clear();
    vi.clearAllMocks();
    __resetIskamJarForTests();
  });

  it('round-trips a jar through secureStorage as one JSON string', async () => {
    await saveJar(JAR);
    expect(secureStorage.set).toHaveBeenCalledWith('reis.iskam.jar', JSON.stringify(JAR));
    expect(await loadJar()).toEqual(JAR);
  });

  it('reads nothing as an empty jar: missing, unreadable, malformed, or foreign hosts', async () => {
    expect(await loadJar()).toEqual([]);
    store.set('reis.iskam.jar', '{not json');
    expect(await loadJar()).toEqual([]);
    store.set(
      'reis.iskam.jar',
      JSON.stringify([{ name: 'x', value: 'y', host: 'evil.example', path: '/', expires: null }])
    );
    expect(await loadJar()).toEqual([]);
  });

  it('drops a save based on a generation that a clear has since moved past', async () => {
    const gen = jarGeneration();
    await clearJar();
    expect(await saveJar(JAR, gen)).toBeNull();
    expect(store.has('reis.iskam.jar')).toBe(false);
  });

  it('a clear issued after a save lands last, even if the save is slow', async () => {
    let release!: () => void;
    secureStorage.set.mockImplementationOnce(
      (k: string, v: unknown) =>
        new Promise<void>((r) => {
          release = () => {
            store.set(k, v);
            r();
          };
        })
    );
    const saving = saveJar(JAR);
    const clearing = clearJar();
    await new Promise((r) => setTimeout(r, 0));
    release();
    await Promise.all([saving, clearing]);
    expect(store.has('reis.iskam.jar')).toBe(false);
  });

  it('a clear based on a stale generation does not wipe a newer login', async () => {
    const gen = jarGeneration();
    await saveJar(JAR);
    expect(await clearJar(gen)).toBe(false);
    expect(await loadJar()).toEqual(JAR);
  });

  // PR #548 review: loadJar bypassed the write lane, so a read issued while a
  // sign-out's remove was still landing returned the pre-sign-out jar.
  it('a read issued after a clear waits for it and sees the cleared store', async () => {
    await saveJar(JAR);
    let release!: () => void;
    secureStorage.remove.mockImplementationOnce(
      (k: string) =>
        new Promise<void>((r) => {
          release = () => {
            store.delete(k);
            r();
          };
        })
    );
    const clearing = clearJar();
    const reading = loadJar();
    await new Promise((r) => setTimeout(r, 0));
    release();
    await clearing;
    expect(await reading).toEqual([]);
  });

  // PR #548 review: a failed Keychain/Keystore READ is not "signed out" — the
  // login may still be there. It throws, and the chain reports unreachable.
  it('a secure-store read failure throws instead of reading as no login', async () => {
    secureStorage.get.mockRejectedValueOnce(new Error('keystore'));
    await expect(loadJar()).rejects.toThrow('keystore');
  });

  // PR #548 review (CodeRabbit): a sign-out whose remove fails must not leave
  // the jar usable by the next student on the device.
  it('a clear that fails still revokes the stored jar until a later save', async () => {
    await saveJar(JAR);
    secureStorage.remove.mockRejectedValueOnce(new Error('keystore'));
    await expect(clearJar()).rejects.toThrow('keystore');
    expect(store.has('reis.iskam.jar')).toBe(true);
    expect(await loadJar()).toEqual([]);
    await saveJar(JAR);
    expect(await loadJar()).toEqual(JAR);
  });

  // PR #548 review (CodeRabbit, second round): the revocation must fail closed.
  it('a revocation flag that cannot be read blocks the stored login', async () => {
    await saveJar(JAR);
    storage.get.mockRejectedValueOnce(new Error('prefs'));
    await expect(loadJar()).rejects.toThrow();
  });

  it('when neither removal nor revocation succeeds, the clear blocks the sign-out', async () => {
    await saveJar(JAR);
    secureStorage.remove.mockRejectedValueOnce(new Error('keystore'));
    storage.set.mockRejectedValueOnce(new Error('prefs'));
    await expect(clearJar()).rejects.toBeInstanceOf(SignOutBlockedError);
  });
});
