import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchWithAuth = vi.fn();
vi.mock('../../../api/client', async (orig) => ({
  ...(await orig<typeof import('../../../api/client')>()),
  fetchWithAuth: (...a: unknown[]) => fetchWithAuth(...a),
}));

import { useAppStore } from '../../useAppStore';
import { overlayWrite } from '../../overlay/overlayGuard';
import { IndexedDBService } from '../../../services/storage';

type St = ReturnType<typeof useAppStore.getState>;

/**
 * While impersonating, the store holds another programme's subjects. These
 * fetchers hit IS and write IndexedDB per subject code, so each must be inert —
 * no request, no read, no write — or a finance subject lands in the admin's
 * real files/classmates stores.
 */
const subjects = {
  version: 1,
  lastUpdated: '',
  data: {
    'EBC-MT': {
      displayName: 'Matematika',
      fullName: 'EBC-MT Matematika',
      subjectCode: 'EBC-MT',
      subjectId: '164227',
      folderUrl: '',
      fetchedAt: '',
    },
  },
};
const active = {
  selection: {
    programId: '1889',
    shortCode: 'B-F',
    name: 'Finance',
    faculty: 'PEF',
    year: 1,
    group: 2,
    periodLabel: 'ZS 2026/2027',
    rozvrh: {} as never,
  },
  result: { plan: {} as never, schedule: [], subjects, fetchedAt: 0 },
};

beforeEach(() => {
  fetchWithAuth.mockReset();
  vi.restoreAllMocks();
  useAppStore.setState(
    overlayWrite({
      impersonation: active,
      subjects,
      files: {},
      syncStatus: { ...useAppStore.getState().syncStatus, handshakeDone: true },
    })
  );
});

describe('per-subject fetchers are inert while impersonating', () => {
  it.each<[string, (s: St) => unknown]>([
    ['fetchFiles', (s) => s.fetchFiles('EBC-MT')],
    ['fetchFilesPriority', (s) => s.fetchFilesPriority('EBC-MT')],
    ['refreshFiles', (s) => s.refreshFiles('EBC-MT')],
    ['refreshFilesForSubject', (s) => s.refreshFilesForSubject('EBC-MT')],
    ['fetchAllFiles', (s) => s.fetchAllFiles()],
    ['prefetchTodaySubjects', (s) => s.prefetchTodaySubjects()],
    ['speculativeRefreshFiles', (s) => s.speculativeRefreshFiles('EBC-MT')],
    ['fetchClassmatesPriority', (s) => s.fetchClassmatesPriority('EBC-MT')],
    ['refreshClassmatesForSubject', (s) => s.refreshClassmatesForSubject('EBC-MT')],
    ['fetchAllClassmates', (s) => s.fetchAllClassmates()],
  ])('%s makes no request and touches no store', async (_name, run) => {
    const get = vi.spyOn(IndexedDBService, 'get');
    const set = vi.spyOn(IndexedDBService, 'set');
    await run(useAppStore.getState());
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchWithAuth).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(useAppStore.getState().files['EBC-MT']).toBeUndefined();
  });
});
