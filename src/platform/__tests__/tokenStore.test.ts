import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPlatform, __resetPlatformForTests } from '../index';
import {
  saveStoredToken,
  loadStoredToken,
  clearStoredToken,
  purgePlaintextToken,
  __resetTokenMemoForTests,
} from '../tokenStore';
import type { ReisPlatform } from '../types';
import { DemoModeError } from '../../errors/demoMode';
import { useAppStore } from '../../store/useAppStore';

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
  __resetTokenMemoForTests();
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

describe('loadStoredToken in demo mode', () => {
  beforeEach(() => useAppStore.setState({ demoMode: true }));
  afterEach(() => useAppStore.setState({ demoMode: false }));

  /**
   * This is the real boundary, not the per-call-site guards in fetchWithAuth /
   * fetchAuthedBytes / openExternal — those are cheap early exits, but every
   * authenticated path (fetchWithAuth, fetchAuthedBytes, personPhoto,
   * openIsFileNatively, openPdfInline, inAppLoginDeps) ends up here to get the
   * token it would send. Guarding the source instead of every drain is what
   * stops the next unguarded call site from being a third whack-a-mole miss.
   */
  it('throws DemoModeError before touching secure storage', async () => {
    await expect(loadStoredToken()).rejects.toBeInstanceOf(DemoModeError);
    expect(secure.api.get).not.toHaveBeenCalled();
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

describe('the in-memory token', () => {
  /**
   * Why this exists: on Capacitor every authenticated request calls
   * `loadStoredToken`, and one cold sync is ~120 requests — so a run cost 120
   * Keychain reads across the native bridge before a single byte went to IS.
   * Measured in issue #197.
   */
  it('reads secure storage once and serves the rest from memory', async () => {
    await saveStoredToken(TOKEN);
    __resetTokenMemoForTests();

    await expect(loadStoredToken()).resolves.toBe(TOKEN);
    await expect(loadStoredToken()).resolves.toBe(TOKEN);
    await expect(loadStoredToken()).resolves.toBe(TOKEN);

    expect(secure.api.get).toHaveBeenCalledTimes(1);
  });

  it('serves a freshly saved token without reading it back', async () => {
    // Re-login writes the new token through here, so the memo is authoritative
    // the moment the write succeeds.
    await saveStoredToken(TOKEN);
    await expect(loadStoredToken()).resolves.toBe(TOKEN);
    expect(secure.api.get).not.toHaveBeenCalled();
  });

  it('replaces the memo when a new token is saved over an old one', async () => {
    const NEXT = 'b'.repeat(40);
    await saveStoredToken(TOKEN);
    await loadStoredToken();
    await saveStoredToken(NEXT);
    await expect(loadStoredToken()).resolves.toBe(NEXT);
  });

  it('forgets the memo when the token is cleared', async () => {
    // Sign-out and the re-login path both clear. A memo that outlived the
    // Keychain entry would keep signing requests as a student who has left.
    await saveStoredToken(TOKEN);
    await loadStoredToken();
    await clearStoredToken();
    await expect(loadStoredToken()).rejects.toMatchObject({ sessionExpired: true });
  });

  it('still refuses in demo mode with a token already in memory', async () => {
    // The memo must not become a way around the one guard every authenticated
    // path converges on.
    await saveStoredToken(TOKEN);
    await loadStoredToken();
    useAppStore.setState({ demoMode: true });
    try {
      await expect(loadStoredToken()).rejects.toBeInstanceOf(DemoModeError);
    } finally {
      useAppStore.setState({ demoMode: false });
    }
  });
});

describe('the memo under concurrency', () => {
  /** A secure store whose reads hang until the test releases them. */
  function slowRead() {
    let release!: (v: unknown) => void;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    secure.api.get.mockImplementationOnce(async () => pending);
    return release;
  }

  it('does not re-cache a token that was signed out while the read was in flight', async () => {
    // Sign-out during a background sync: the sync's read resolves after
    // clearStoredToken has already run. Caching what it fetched would hand every
    // later request the credential of a student who has left.
    await saveStoredToken(TOKEN);
    __resetTokenMemoForTests();

    const release = slowRead();
    const inFlight = loadStoredToken();
    await clearStoredToken();
    release(TOKEN);
    await expect(inFlight).resolves.toBe(TOKEN); // the caller still gets what it asked for

    await expect(loadStoredToken()).rejects.toMatchObject({ sessionExpired: true });
  });

  it('does not clobber a freshly issued token with the expired one it replaced', async () => {
    // Re-login: the failing request's read overlaps saveStoredToken. Landing
    // late must not put the old token back.
    const NEXT = 'b'.repeat(40);
    await saveStoredToken(TOKEN);
    __resetTokenMemoForTests();

    const release = slowRead();
    const inFlight = loadStoredToken();
    await saveStoredToken(NEXT);
    release(TOKEN);
    await inFlight;

    await expect(loadStoredToken()).resolves.toBe(NEXT);
  });
});
