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

  it('survives the end of a sync: the cache reload keeps an uncached failed subject', async () => {
    // A sync ending calls fetchAllFiles, which rebuilt the whole map from
    // IndexedDB. A subject whose only fetch failed has no IDB entry, so its
    // key went back to undefined — and useFiles reads undefined as "loading",
    // a skeleton that never resolves, over the failed state (Návrhy #26).
    useAppStore.setState({ files: { [CODE]: [] }, filesError: { [CODE]: true } });

    await useAppStore.getState().fetchAllFiles();

    expect(useAppStore.getState().files[CODE]).toEqual([]);
    expect(useAppStore.getState().filesError[CODE]).toBe(true);
  });

  it('a failed refresh of a never-loaded subject ends the skeleton', async () => {
    // files[code] undefined is what useFiles reads as "still loading".
    fetchFolderListing.mockRejectedValue(OFFLINE);

    await useAppStore.getState().refreshFilesForSubject(CODE);

    expect(useAppStore.getState().files[CODE]).toEqual([]);
  });

  it('the cache reload clears a failure for a subject the sync has since fetched', async () => {
    useAppStore.setState({ files: { [CODE]: [] }, filesError: { [CODE]: true } });
    idb.get.mockImplementation(async (store: unknown, key: unknown) =>
      store === 'files' && key === CODE ? { cz: [], en: [] } : undefined
    );

    await useAppStore.getState().fetchAllFiles();

    expect(useAppStore.getState().filesError[CODE]).toBeFalsy();
  });

  it('a successful cache read clears a failure', async () => {
    useAppStore.setState({ files: { [CODE]: [] }, filesError: { [CODE]: true } });
    idb.get.mockImplementation(async (store: unknown, key: unknown) =>
      store === 'files' && key === CODE ? { cz: [], en: [] } : undefined
    );

    await useAppStore.getState().refreshFiles(CODE);

    expect(useAppStore.getState().filesError[CODE]).toBeFalsy();
  });
});
