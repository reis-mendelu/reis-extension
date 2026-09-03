import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminSlice } from '../createAdminSlice';

// Opening the console has to re-pull the inbox, not trust what was fetched at
// session-establishment time.
//
// The original code loaded suggestions only in adminLogin() and
// loadAdminSession(), on the assumption recorded in its comment: "nothing
// arrives while the iframe is closed, so the count is refreshed at every open".
// That assumption is an extension assumption. The iframe really is destroyed
// and rebuilt on every IS Mendelu page load, so there "app start" and "console
// open" are the same moment.
//
// The Capacitor app breaks it. The process is long-lived — reIS on the iPad
// stays resident for hours — so a suggestion filed at 23:52:38 from an app that
// launched at 23:52:06 was invisible in Návrhy no matter how many times the
// console was reopened, until the app itself was force-quit. Observed on device
// 2026-09-03 with row id 8 present in Postgres and visible to reis_admin under
// RLS, and absent from the on-screen inbox.
vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: {
    auth: { getSession: vi.fn(), signOut: vi.fn(), signInWithPassword: vi.fn() },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: vi.fn() }) }) }),
  },
}));

describe('openSocietyAdmin refetches the suggestions inbox', () => {
  let state: Record<string, unknown>;
  const loadSuggestions = vi.fn(async () => {});

  beforeEach(() => {
    loadSuggestions.mockClear();
    const set = vi.fn((updater: unknown) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    const get = vi.fn(() => state);
    state = {
      ...createAdminSlice(set as never, get as never, {} as never),
      loadSuggestions,
      closeComposer: vi.fn(),
      clearMapSelection: vi.fn(),
    };
  });

  it('pulls the inbox again when a reis_admin opens the console', () => {
    state.adminRole = 'reis_admin';

    (state.openSocietyAdmin as () => void)();

    expect(state.adminConsoleOpen).toBe(true);
    expect(loadSuggestions).toHaveBeenCalledTimes(1);
  });

  it('does not pull for a society account, which has no inbox to show', () => {
    state.adminRole = 'association';

    (state.openSocietyAdmin as () => void)();

    expect(state.adminConsoleOpen).toBe(true);
    expect(loadSuggestions).not.toHaveBeenCalled();
  });

  it('does not pull when nobody is signed in', () => {
    state.adminRole = null;

    (state.openSocietyAdmin as () => void)();

    expect(loadSuggestions).not.toHaveBeenCalled();
  });
});
