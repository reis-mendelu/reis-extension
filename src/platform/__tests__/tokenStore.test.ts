import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setPlatform, __resetPlatformForTests } from '../index';
import {
  saveStoredToken,
  loadStoredToken,
  clearStoredToken,
  purgePlaintextToken,
} from '../tokenStore';
import type { ReisPlatform } from '../types';

/** A live-looking UISAuth value; isPlausibleToken rejects short/empty strings. */
const TOKEN = 'a'.repeat(40);

/**
 * Duplicated rather than imported: the key is private to tokenStore so nothing
 * can reach plain storage under it. Spelling it out here also makes a rename
 * fail the suite, which is right — the on-disk key is migration-relevant.
 */
const TOKEN_KEY = 'reis.session.uisAuth';

function makeBag() {
  const map = new Map<string, unknown>();
  return {
    map,
    api: {
      get: vi.fn(async (k: string) => map.get(k)),
      set: vi.fn(async (k: string, v: unknown) => void map.set(k, v)),
      remove: vi.fn(async (k: string) => void map.delete(k)),
    },
  };
}

let plain: ReturnType<typeof makeBag>;
let secure: ReturnType<typeof makeBag>;

beforeEach(() => {
  __resetPlatformForTests();
  plain = makeBag();
  secure = makeBag();
  setPlatform({
    kind: 'capacitor',
    storage: plain.api,
    secureStorage: secure.api,
    getAssetUrl: (p: string) => p,
  } as unknown as ReisPlatform);
});

describe('tokenStore', () => {
  /**
   * The whole point of #172: UISAuth is a live credential that authenticates as
   * the student and never rotates, so it must not touch the ordinary key-value
   * store — that is SharedPreferences/UserDefaults, which is plaintext.
   */
  it('writes the token to secure storage and never to plain storage', async () => {
    await saveStoredToken(TOKEN);
    expect(secure.map.get(TOKEN_KEY)).toBe(TOKEN);
    expect(plain.api.set).not.toHaveBeenCalled();
  });

  it('reads the token back from secure storage', async () => {
    await saveStoredToken(TOKEN);
    expect(await loadStoredToken()).toBe(TOKEN);
    expect(plain.api.get).not.toHaveBeenCalled();
  });

  it('clears the token from secure storage', async () => {
    await saveStoredToken(TOKEN);
    await clearStoredToken();
    expect(secure.map.has(TOKEN_KEY)).toBe(false);
  });

  /**
   * Throwing with sessionExpired rather than returning null makes a missing
   * token indistinguishable from a lapsed one at every call site — both mean
   * "send the student to login", and a nullable return invites a silent
   * unauthenticated request.
   */
  it('throws sessionExpired when nothing is stored', async () => {
    await expect(loadStoredToken()).rejects.toMatchObject({ sessionExpired: true });
  });

  it('throws sessionExpired for a value too short to be a real token', async () => {
    await secure.api.set(TOKEN_KEY, 'x');
    await expect(loadStoredToken()).rejects.toMatchObject({ sessionExpired: true });
  });

  /**
   * A decrypt failure — key invalidated by a credential change or a restore
   * onto new hardware — must read as "no token", not as a crash and NOT as a
   * reason to fall back to plaintext.
   */
  it('treats an unreadable secure store as a lapsed session', async () => {
    secure.api.get.mockRejectedValueOnce(new Error('KeyPermanentlyInvalidatedException'));
    await expect(loadStoredToken()).rejects.toMatchObject({ sessionExpired: true });
  });
});

describe('purgePlaintextToken', () => {
  /**
   * Upgrading installs still hold the token in plain Preferences. It is deleted
   * rather than migrated: deletion is the outcome that matters, and copying it
   * across first is a step that can half-succeed and leave the plaintext behind
   * — the exact thing this work exists to remove.
   */
  it('removes the legacy plaintext copy', async () => {
    await plain.api.set(TOKEN_KEY, TOKEN);
    await purgePlaintextToken();
    expect(plain.map.has(TOKEN_KEY)).toBe(false);
  });

  it('does not touch a token already in secure storage', async () => {
    await saveStoredToken(TOKEN);
    await purgePlaintextToken();
    expect(await loadStoredToken()).toBe(TOKEN);
  });

  it('is safe to run when there is nothing to purge', async () => {
    await expect(purgePlaintextToken()).resolves.toBeUndefined();
  });

  /**
   * Boot must not be blocked by a storage error on a cleanup step — the app is
   * still usable, and the next launch tries again.
   */
  it('swallows a storage failure rather than blocking boot', async () => {
    plain.api.remove.mockRejectedValueOnce(new Error('nope'));
    await expect(purgePlaintextToken()).resolves.toBeUndefined();
  });
});
