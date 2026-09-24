import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAndPersistFolderFiles } from '../refreshFilesForSubject';
import { IndexedDBService } from '../../../../services/storage';
import { fetchFolderListing } from '../../../../api/documents/service';
import type { ParsedFile, SubjectsData } from '../../../../types/documents';

vi.mock('../../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('../../../../api/documents/service', () => ({ fetchFolderListing: vi.fn() }));

const row = (name: string, dok: string): ParsedFile => ({
  subfolder: '',
  file_name: name,
  file_comment: '',
  author: '',
  date: '',
  files: [{ name, type: 'pdf', link: `https://is.mendelu.cz/x?download=${dok};id=1` }],
});

const subjects = {
  data: { ALG: { folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=42' } },
} as unknown as SubjectsData;

/**
 * The pull-to-refresh contract, one layer below the gesture: what was on the
 * device before a refresh is still there after one, unless IS answered in full
 * and no longer lists it.
 */
describe('fetchAndPersistFolderFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IndexedDBService.get).mockResolvedValue({
      cz: [row('Lecture 1', '1'), row('Lecture 2', '2')],
      en: [row('Lecture 1 EN', '1')],
    });
  });

  it('keeps the cached files when a subfolder failed, and adds the new upload', async () => {
    vi.mocked(fetchFolderListing).mockResolvedValue({
      files: [row('Lecture 2', '2'), row('Lecture 3', '3')],
      complete: false,
    });

    const result = await fetchAndPersistFolderFiles({
      courseCode: 'ALG',
      language: 'cz',
      subjects,
    });

    const names = result?.displayList.map((f) => f.file_name).sort();
    expect(names).toEqual(['Lecture 1', 'Lecture 2', 'Lecture 3']);
    const written = vi.mocked(IndexedDBService.set).mock.calls[0]?.[2] as { cz: ParsedFile[] };
    expect(written.cz.map((f) => f.file_name).sort()).toEqual(names);
  });

  it('drops a file IS no longer lists once the crawl came back complete', async () => {
    vi.mocked(fetchFolderListing).mockResolvedValue({
      files: [row('Lecture 2', '2')],
      complete: true,
    });

    const result = await fetchAndPersistFolderFiles({
      courseCode: 'ALG',
      language: 'cz',
      subjects,
    });

    expect(result?.displayList.map((f) => f.file_name)).toEqual(['Lecture 2']);
  });

  it('leaves the other language untouched', async () => {
    vi.mocked(fetchFolderListing).mockResolvedValue({ files: [], complete: true });

    await fetchAndPersistFolderFiles({ courseCode: 'ALG', language: 'cz', subjects });

    const written = vi.mocked(IndexedDBService.set).mock.calls[0]?.[2] as { en: ParsedFile[] };
    expect(written.en.map((f) => f.file_name)).toEqual(['Lecture 1 EN']);
  });
});
