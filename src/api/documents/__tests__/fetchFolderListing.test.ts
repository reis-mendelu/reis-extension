import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchFolderListing } from '../service';
import { fetchWithAuth } from '../../client';
import { parseServerFiles } from '../parser';
import type { ParsedFile } from '../../../types/documents';

vi.mock('../../client');
vi.mock('../parser');
vi.mock('../../../utils/validation/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/validation/index')>();
  return { ...actual, validateUrl: vi.fn((s) => s) };
});
vi.mock('../../../utils/requestQueue', () => ({
  requestQueue: { add: vi.fn((fn) => fn()) },
  processWithDelay: vi.fn((items, processor) => Promise.all(items.map(processor))),
}));

const ok = { text: async () => 'html' } as Response;
const file = (name: string, id: string) =>
  ({
    subfolder: '',
    file_name: name,
    files: [{ name, type: 'pdf', link: `slozka.pl?download=${id};id=1` }],
  }) as unknown as ParsedFile;
const folder = (name: string, id: string) =>
  ({ file_name: name, files: [{ name, link: `slozka.pl?id=${id}` }] }) as unknown as ParsedFile;

/**
 * The crawl swallows a failed subfolder or page and carries on, which is right
 * for the files it DID get — but a caller that replaces its cache with the
 * result then deletes every file the failed part held. `complete` is what lets
 * the caller tell a teacher's deletion from a network blip.
 */
describe('fetchFolderListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is complete when every page and subfolder loaded', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(ok);
    vi.mocked(parseServerFiles)
      .mockReturnValueOnce({ files: [file('A', '1'), folder('Sub', '9')], paginationLinks: [] })
      .mockReturnValueOnce({ files: [file('B', '2')], paginationLinks: [] });

    const result = await fetchFolderListing('https://is.mendelu.cz/x?id=1');

    expect(result.complete).toBe(true);
    expect(result.files.map((f) => f.file_name).sort()).toEqual(['A', 'B']);
  });

  it('is incomplete when a subfolder fails, and still returns what loaded', async () => {
    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce(ok)
      .mockRejectedValueOnce(new Error('subfolder down'));
    vi.mocked(parseServerFiles).mockReturnValueOnce({
      files: [file('A', '1'), folder('Sub', '9')],
      paginationLinks: [],
    });

    const result = await fetchFolderListing('https://is.mendelu.cz/x?id=1');

    expect(result.complete).toBe(false);
    expect(result.files.map((f) => f.file_name)).toEqual(['A']);
  });

  it('is incomplete when a pagination page fails', async () => {
    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce(ok)
      .mockRejectedValueOnce(new Error('page 2 down'));
    vi.mocked(parseServerFiles).mockReturnValueOnce({
      files: [file('A', '1')],
      paginationLinks: ['on=1'],
    });

    const result = await fetchFolderListing('https://is.mendelu.cz/x?id=1');

    expect(result.complete).toBe(false);
    expect(result.files.map((f) => f.file_name)).toEqual(['A']);
  });

  it('is incomplete when a failure is nested a level down', async () => {
    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(ok)
      .mockRejectedValueOnce(new Error('nested down'));
    vi.mocked(parseServerFiles)
      .mockReturnValueOnce({ files: [folder('Sub', '9')], paginationLinks: [] })
      .mockReturnValueOnce({ files: [file('B', '2'), folder('Deeper', '8')], paginationLinks: [] });

    const result = await fetchFolderListing('https://is.mendelu.cz/x?id=1');

    expect(result.complete).toBe(false);
    expect(result.files.map((f) => f.file_name)).toEqual(['B']);
  });

  it('throws when the root listing itself fails, as fetchFilesFromFolder does', async () => {
    vi.mocked(fetchWithAuth).mockRejectedValue(new Error('offline'));
    await expect(fetchFolderListing('https://is.mendelu.cz/x?id=1')).rejects.toThrow('offline');
  });
});
