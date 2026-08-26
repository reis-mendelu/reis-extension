/**
 * syncFiles walks every enrolled subject. The behaviour that matters is what it
 * does when ONE subject misbehaves: a throw that escapes the loop would silently
 * cost the student every subject after it, and the drawer would just look empty.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const set = vi.hoisted(() => vi.fn());
const fetchFilesFromFolder = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock('../storage', () => ({ IndexedDBService: { get, set } }));
vi.mock('../../api/documents', () => ({ fetchFilesFromFolder }));
vi.mock('../../utils/reportError', () => ({ logError }));

import { syncFiles } from './syncFiles';

const subjects = (data: Record<string, { folderUrl: string }>) => ({ data });

describe('syncFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFilesFromFolder.mockResolvedValue([{ name: 'lecture.pdf' }]);
  });

  it('does nothing when no subjects are cached', async () => {
    get.mockResolvedValue(null);
    await syncFiles();
    expect(fetchFilesFromFolder).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('does nothing when the cached record has no data', async () => {
    get.mockResolvedValue({});
    await syncFiles();
    expect(fetchFilesFromFolder).not.toHaveBeenCalled();
  });

  it('stores both languages under the course code', async () => {
    get.mockResolvedValue(subjects({ 'EBC-OS': { folderUrl: 'slozka.pl?id=4210' } }));
    fetchFilesFromFolder.mockImplementation(async (_url: string, lang: string) => [
      { name: `${lang}.pdf` },
    ]);

    await syncFiles();

    expect(set).toHaveBeenCalledWith('files', 'EBC-OS', {
      cz: [{ name: 'cz.pdf' }],
      en: [{ name: 'en.pdf' }],
    });
  });

  it('rebuilds the folder URL from the id rather than reusing the stored one', async () => {
    // The stored URL carries session-scoped junk; only the numeric id is stable.
    get.mockResolvedValue(subjects({ 'EBC-OS': { folderUrl: 'slozka.pl?lang=cz;id=4210;x=1' } }));

    await syncFiles();

    const urls = fetchFilesFromFolder.mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=4210',
      'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=4210',
    ]);
  });

  it('skips a subject whose folderUrl carries no id', async () => {
    get.mockResolvedValue(subjects({ 'EBC-OS': { folderUrl: 'https://is.mendelu.cz/nope' } }));

    await syncFiles();

    expect(fetchFilesFromFolder).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('coerces a non-array fetch result to an empty list', async () => {
    get.mockResolvedValue(subjects({ 'EBC-OS': { folderUrl: 'slozka.pl?id=1' } }));
    fetchFilesFromFolder.mockResolvedValue(undefined);

    await syncFiles();

    expect(set).toHaveBeenCalledWith('files', 'EBC-OS', { cz: [], en: [] });
  });

  it('keeps syncing later subjects after one of them throws', async () => {
    get.mockResolvedValue(
      subjects({
        BROKEN: { folderUrl: 'slozka.pl?id=1' },
        FINE: { folderUrl: 'slozka.pl?id=2' },
      })
    );
    fetchFilesFromFolder.mockImplementation(async (url: string) => {
      if (url.includes('id=1')) throw new Error('IS returned 500');
      return [{ name: 'ok.pdf' }];
    });

    await syncFiles();

    // The healthy subject still landed...
    expect(set).toHaveBeenCalledWith('files', 'FINE', expect.anything());
    // ...and the broken one was reported, not swallowed silently.
    expect(logError).toHaveBeenCalledWith('Sync.syncFiles', expect.any(Error), {
      courseCode: 'BROKEN',
    });
  });

  it('reports each failing subject separately', async () => {
    get.mockResolvedValue(
      subjects({
        A: { folderUrl: 'slozka.pl?id=1' },
        B: { folderUrl: 'slozka.pl?id=2' },
      })
    );
    fetchFilesFromFolder.mockRejectedValue(new Error('offline'));

    await syncFiles();

    expect(logError).toHaveBeenCalledTimes(2);
    expect(set).not.toHaveBeenCalled();
  });
});
