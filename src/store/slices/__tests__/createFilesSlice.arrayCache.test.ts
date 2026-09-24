import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { createFilesSlice } from '../createFilesSlice';
import { IndexedDBService } from '../../../services/storage';
import type { ParsedFile } from '../../../types/documents';

/**
 * A files record is either `{ cz, en }` or a plain list stamped per file with
 * its language — the sync writes lists, and so does the refresh path now that
 * it fetches one language. `fetchFilesPriority` read every record as `{ cz, en }`,
 * so a list came out as `[]` and the drawer showed a subject with no files.
 */
vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn() },
}));
const fetchFilesFromFolder = vi.fn();
vi.mock('../../../api/documents/service', () => ({
  fetchFilesFromFolder: (...a: unknown[]) => fetchFilesFromFolder(...a),
}));

const file = (name: string, language: string) =>
  ({ file_name: name, language, files: [] }) as unknown as ParsedFile;

describe('fetchFilesPriority with a plain-list cache record', () => {
  let slice: ReturnType<typeof createFilesSlice>;
  let state: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    state = { files: {}, filesLoading: {}, lastFilesFetchedAt: {} };
    const set = vi.fn((fn) => {
      Object.assign(state, typeof fn === 'function' ? fn(state) : fn);
    }) as Mock & Parameters<typeof createFilesSlice>[0];
    const get = vi.fn(() => ({
      ...slice,
      ...state,
      syncStatus: { handshakeDone: true, handshakeTimedOut: false, isSyncing: false },
      subjects: { data: { ALG: { folderUrl: 'https://is.mendelu.cz/x?id=7' } } },
      language: 'cz',
    })) as unknown as Parameters<typeof createFilesSlice>[1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slice = createFilesSlice(set, get, {} as any);
    fetchFilesFromFolder.mockResolvedValue([file('fresh.pdf', 'cz')]);
  });

  const shown = () => (state.files as Record<string, ParsedFile[]>).ALG;

  it('serves a list already in the language being read, without fetching', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue([file('cached.pdf', 'cz')]);
    await slice.fetchFilesPriority('ALG');
    expect(shown()?.map((f) => f.file_name)).toEqual(['cached.pdf']);
    expect(fetchFilesFromFolder).not.toHaveBeenCalled();
  });

  it.each([
    ['in the other language', [file('cached.pdf', 'en')]],
    ['empty, so of no known language', []],
  ])('refetches a list %s instead of showing no files', async (_case, cached) => {
    vi.mocked(IndexedDBService.get).mockResolvedValue(cached);
    await slice.fetchFilesPriority('ALG');
    expect(fetchFilesFromFolder).toHaveBeenCalled();
    expect(shown()?.map((f) => f.file_name)).toEqual(['fresh.pdf']);
  });
});
