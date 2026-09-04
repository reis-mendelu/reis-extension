import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSpolkySettings } from '../useSpolkySettings';

const mockGetUserParams = vi.fn();
const mockIDBGet = vi.fn();
const mockIDBSet = vi.fn();

vi.mock('../../utils/userParams', () => ({
  getUserParams: (...args: unknown[]) => mockGetUserParams(...args),
}));

vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: (...args: unknown[]) => mockIDBGet(...args),
    set: (...args: unknown[]) => mockIDBSet(...args),
  },
}));

// FACULTY_TO_ASSOCIATION: '1'->af, '2'->supef, '3'->au_frrms, '4'->zf, '5'->ldf
vi.mock('../../services/spolky/config', () => ({
  FACULTY_TO_ASSOCIATION: {
    AF: 'af',
    PEF: 'supef',
    FRRMS: 'au_frrms',
    ZF: 'zf',
    LDF: 'ldf',
  },
}));

function makeUser(facultyLabel: string | null, isErasmus: boolean) {
  return facultyLabel
    ? {
        studium: 's',
        obdobi: 'o',
        facultyId: '',
        facultyLabel,
        username: 'u',
        studentId: 'id',
        fullName: 'Test',
        isErasmus,
      }
    : {
        studium: 's',
        obdobi: 'o',
        facultyId: '',
        facultyLabel: '',
        username: 'u',
        studentId: 'id',
        fullName: 'Test',
        isErasmus,
      };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIDBSet.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Fresh user (no saved associations in IDB)
// ---------------------------------------------------------------------------
describe('fresh user — faculty auto-subscription', () => {
  beforeEach(() => {
    // No saved list, no flag
    mockIDBGet.mockResolvedValue(undefined);
  });

  it.each([
    ['AF', 'AF', 'af'],
    ['PEF', 'PEF', 'supef'],
    ['AU/FRRMS', 'FRRMS', 'au_frrms'],
    ['ZF', 'ZF', 'zf'],
    ['LDF', 'LDF', 'ldf'],
  ])('%s faculty → subscribes to %s', async (_label, facultyLabel, expected) => {
    mockGetUserParams.mockResolvedValue(makeUser(facultyLabel, false));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscribedAssociations).toEqual([expected]);
  });

  it('Erasmus with a faculty ID → ESN only, no faculty association', async () => {
    mockGetUserParams.mockResolvedValue(makeUser('AF', true));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscribedAssociations).toEqual(['esn']);
  });

  it('Erasmus with no faculty ID → ESN only', async () => {
    mockGetUserParams.mockResolvedValue(makeUser(null, true));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscribedAssociations).toEqual(['esn']);
  });

  it('unknown faculty → empty list', async () => {
    mockGetUserParams.mockResolvedValue(makeUser('99', false));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscribedAssociations).toEqual([]);
  });

  it('getUserParams returns null → empty list', async () => {
    mockGetUserParams.mockResolvedValue(null);

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscribedAssociations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Returning user (saved associations in IDB)
// ---------------------------------------------------------------------------
describe('returning user — respects saved list', () => {
  it('returns saved associations without modification', async () => {
    mockIDBGet.mockImplementation((store: string, key: string) => {
      if (store === 'meta' && key === 'reis_subscribed_associations')
        return Promise.resolve(['ldf', 'esn']);
      return Promise.resolve(undefined);
    });
    mockGetUserParams.mockResolvedValue(makeUser('5', false));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscribedAssociations).toEqual(['ldf', 'esn']);
  });
});

describe('returning Erasmus user — legacy ESN back-fill', () => {
  it('back-fills ESN when flag not set and ESN missing', async () => {
    mockIDBGet.mockImplementation((store: string, key: string) => {
      if (store === 'meta' && key === 'reis_subscribed_associations')
        return Promise.resolve(['af']);
      if (store === 'meta' && key === 'reis_erasmus_auto_subscribed')
        return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });
    mockGetUserParams.mockResolvedValue(makeUser('1', true));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscribedAssociations).toEqual(['af', 'esn']);
  });

  it('does NOT back-fill ESN when flag already set', async () => {
    mockIDBGet.mockImplementation((store: string, key: string) => {
      if (store === 'meta' && key === 'reis_subscribed_associations')
        return Promise.resolve(['af']);
      if (store === 'meta' && key === 'reis_erasmus_auto_subscribed') return Promise.resolve(true);
      return Promise.resolve(undefined);
    });
    mockGetUserParams.mockResolvedValue(makeUser('1', true));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscribedAssociations).toEqual(['af']);
  });

  it('does NOT back-fill ESN when ESN already present', async () => {
    mockIDBGet.mockImplementation((store: string, key: string) => {
      if (store === 'meta' && key === 'reis_subscribed_associations')
        return Promise.resolve(['af', 'esn']);
      return Promise.resolve(undefined);
    });
    mockGetUserParams.mockResolvedValue(makeUser('1', true));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscribedAssociations).toEqual(['af', 'esn']);
  });
});

// ---------------------------------------------------------------------------
// The empty-set trap
// ---------------------------------------------------------------------------
describe('unresolved faculty must not be persisted as "subscribed to nothing"', () => {
  // Reported as "the deskovky test notification didn't appear in the
  // notification". A society event is filtered out of the feed unless the
  // student is subscribed to that society, and the faculty default is computed
  // ONCE — the first time IDB has no saved list.
  //
  // `#titulek` does not always parse: a doctoral or combined-study header, or a
  // session not yet restored at boot on the long-lived Capacitor app, leaves
  // `facultyLabel` undefined. The defaults then came out `[]` — and `[]` was
  // written to IDB. `[]` is truthy, so `if (!saved)` never ran again, and the
  // student was subscribed to nothing PERMANENTLY, on every later boot where
  // the faculty parsed perfectly well.
  it('does not save an empty default set, so the next boot can resolve it', async () => {
    mockIDBGet.mockResolvedValue(undefined);
    mockGetUserParams.mockResolvedValue(makeUser(null, false));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(
      mockIDBSet.mock.calls.filter((c) => c[1] === 'reis_subscribed_associations')
    ).toHaveLength(0);
  });

  it('recovers a student already stuck on a stored empty list', async () => {
    mockIDBGet.mockImplementation((_store: string, key: string) =>
      Promise.resolve(key === 'reis_subscribed_associations' ? [] : undefined)
    );
    mockGetUserParams.mockResolvedValue(makeUser('PEF', false));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.subscribedAssociations).toEqual(['supef']));
  });

  // The opposite must still hold: a student who deliberately unsubscribed from
  // everything stays unsubscribed. `toggleAssociation` writes that choice, and
  // an explicit empty choice is not the same as an unresolved one.
  it('leaves a deliberate empty choice alone', async () => {
    mockIDBGet.mockImplementation((_store: string, key: string) =>
      Promise.resolve(
        key === 'reis_subscribed_associations'
          ? []
          : key === 'reis_associations_chosen'
            ? true
            : undefined
      )
    );
    mockGetUserParams.mockResolvedValue(makeUser('PEF', false));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.subscribedAssociations).toEqual([]);
  });
});

describe('the legacy empty list is re-resolved exactly once', () => {
  // Before CHOSEN_KEY existed, `toggleAssociation` ALSO persisted `[]` when a
  // student removed their last society. A stored empty list on such an install
  // is therefore ambiguous, and cannot be told apart after the fact. Recovering
  // it once and marking it settled bounds the cost both ways; leaving it
  // unmarked would re-subscribe a deliberate opt-out on every single launch.
  it('marks the recovered list as chosen, so it cannot happen twice', async () => {
    mockIDBGet.mockImplementation((_store: string, key: string) =>
      Promise.resolve(key === 'reis_subscribed_associations' ? [] : undefined)
    );
    mockGetUserParams.mockResolvedValue(makeUser('PEF', false));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.subscribedAssociations).toEqual(['supef']));

    expect(
      mockIDBSet.mock.calls.some((c) => c[1] === 'reis_associations_chosen' && c[2] === true)
    ).toBe(true);
  });

  // ...and once marked, a later empty list is left exactly as the student left
  // it, however many times they relaunch.
  it('never touches an empty list that has been marked chosen', async () => {
    mockIDBGet.mockImplementation((_store: string, key: string) =>
      Promise.resolve(
        key === 'reis_subscribed_associations'
          ? []
          : key === 'reis_associations_chosen'
            ? true
            : undefined
      )
    );
    mockGetUserParams.mockResolvedValue(makeUser('PEF', false));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.subscribedAssociations).toEqual([]);
  });
});
