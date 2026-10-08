import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Návrhy #26: "Nejsou tu data". IS was unreachable, the drawer's folder fetch
 * threw, and the catch wrote `[]` — which the Files tab renders as "Žádné
 * soubory nejsou k dispozici." A failure has to be a state of its own, so the
 * tab can say "could not load" and offer a retry instead of claiming the
 * subject has no files.
 */

const { idb, fetchFilesFromFolder, fetchFolderListing } = vi.hoisted(() => ({
  idb: { get: vi.fn(async (..._a: unknown[]): Promise<unknown> => undefined), set: vi.fn() },
  fetchFilesFromFolder: vi.fn(),
  fetchFolderListing: vi.fn(),
}));

vi.mock('../../../services/storage', () => ({ IndexedDBService: idb }));
vi.mock('../../../api/documents/service', () => ({ fetchFilesFromFolder, fetchFolderListing }));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

import { useAppStore } from '../../useAppStore';

const CODE = 'EBC-PS';
const OFFLINE = new Error('Unable to resolve host "is.mendelu.cz"');
const SUBJECTS = {
  version: 1,
  lastUpdated: '',
  data: { [CODE]: { folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=123' } },
};

describe('a failed folder fetch is not an empty folder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idb.get.mockImplementation(async () => undefined);
    useAppStore.setState({
      impersonation: null,
      language: 'cz',
      files: {},
      filesLoading: {},
      filesError: {},
      lastFilesFetchedAt: {},
      subjects: SUBJECTS as never,
      syncStatus: {
        isSyncing: false,
        lastSync: null,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
  });

  it('marks the subject failed when the first open cannot reach IS', async () => {
    fetchFilesFromFolder.mockRejectedValue(OFFLINE);

    await useAppStore.getState().fetchFilesPriority(CODE);

    const s = useAppStore.getState();
    expect(s.filesError[CODE]).toBe(true);
    expect(s.filesLoading[CODE]).toBe(false);
  });

  it('marks the subject failed when a refresh cannot reach IS', async () => {
    fetchFolderListing.mockRejectedValue(OFFLINE);

    await useAppStore.getState().refreshFilesForSubject(CODE);

    expect(useAppStore.getState().filesError[CODE]).toBe(true);
  });

  it('clears the failure as soon as a retry starts', async () => {
    useAppStore.setState({ filesError: { [CODE]: true } });
    let release: (v: unknown) => void = () => {};
    fetchFolderListing.mockReturnValue(new Promise((r) => (release = r)));

    const pending = useAppStore.getState().refreshFilesForSubject(CODE);
    await Promise.resolve();

    expect(useAppStore.getState().filesError[CODE]).toBeFalsy();
    release({ files: [], complete: true });
    await pending;
  });

  it('a successful retry leaves no failure behind', async () => {
    useAppStore.setState({ filesError: { [CODE]: true } });
    fetchFolderListing.mockResolvedValue({ files: [], complete: true });

    await useAppStore.getState().refreshFilesForSubject(CODE);

    expect(useAppStore.getState().filesError[CODE]).toBeFalsy();
  });
});
