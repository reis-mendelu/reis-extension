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
    'AF': 'af',
    'PEF': 'supef',
    'FRRMS': 'au_frrms',
    'ZF': 'zf',
    'LDF': 'ldf',
  },
}));

function makeUser(facultyLabel: string | null, isErasmus: boolean) {
  return facultyLabel
    ? { studium: 's', obdobi: 'o', facultyId: '', facultyLabel, username: 'u', studentId: 'id', fullName: 'Test', isErasmus }
    : { studium: 's', obdobi: 'o', facultyId: '', facultyLabel: '', username: 'u', studentId: 'id', fullName: 'Test', isErasmus };
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
    ['AF',     'AF',    'af'],
    ['PEF',    'PEF',   'supef'],
    ['AU/FRRMS', 'FRRMS', 'au_frrms'],
    ['ZF',     'ZF',    'zf'],
    ['LDF',    'LDF',   'ldf'],
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
      if (store === 'meta' && key === 'reis_subscribed_associations') return Promise.resolve(['ldf', 'esn']);
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
      if (store === 'meta' && key === 'reis_subscribed_associations') return Promise.resolve(['af']);
      if (store === 'meta' && key === 'reis_erasmus_auto_subscribed') return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });
    mockGetUserParams.mockResolvedValue(makeUser('1', true));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscribedAssociations).toEqual(['af', 'esn']);
  });

  it('does NOT back-fill ESN when flag already set', async () => {
    mockIDBGet.mockImplementation((store: string, key: string) => {
      if (store === 'meta' && key === 'reis_subscribed_associations') return Promise.resolve(['af']);
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
      if (store === 'meta' && key === 'reis_subscribed_associations') return Promise.resolve(['af', 'esn']);
      return Promise.resolve(undefined);
    });
    mockGetUserParams.mockResolvedValue(makeUser('1', true));

    const { result } = renderHook(() => useSpolkySettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscribedAssociations).toEqual(['af', 'esn']);
  });
});
