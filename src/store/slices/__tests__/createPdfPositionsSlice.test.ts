import { describe, it, expect, beforeEach, vi } from 'vitest';

const idb = vi.hoisted(() => ({
  get: vi.fn(async () => null as unknown),
  set: vi.fn(async () => undefined),
}));
vi.mock('../../../services/storage/IndexedDBService', () => ({ IndexedDBService: idb }));

import { useAppStore } from '../../useAppStore';
import {
  PDF_POSITIONS_CAP,
  PDF_POSITIONS_KEY,
  __resetPdfPositionsForTests,
} from '../createPdfPositionsSlice';

const lastWrite = () => idb.set.mock.calls.at(-1) as unknown as [string, string, unknown];

describe('createPdfPositionsSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idb.get.mockResolvedValue(null);
    __resetPdfPositionsForTests();
    useAppStore.setState({ pdfPositions: {} } as never);
  });

  it('reads the page a file was left on from the meta store', async () => {
    idb.get.mockResolvedValue({ 'EBC-MT:l1': { page: 7, at: 10 } });
    expect(await useAppStore.getState().loadPdfPosition('EBC-MT:l1')).toBe(7);
    expect(idb.get).toHaveBeenCalledWith('meta', PDF_POSITIONS_KEY);
  });

  it('is null for a file never opened', async () => {
    expect(await useAppStore.getState().loadPdfPosition('EBC-MT:never')).toBeNull();
  });

  it('reads the store once, however many files are opened', async () => {
    await useAppStore.getState().loadPdfPosition('a');
    await useAppStore.getState().loadPdfPosition('b');
    expect(idb.get).toHaveBeenCalledTimes(1);
  });

  it('ignores a stored value that is not a positions map', async () => {
    idb.get.mockResolvedValue({ a: 'page four', b: { page: 2, at: 1 } });
    expect(await useAppStore.getState().loadPdfPosition('a')).toBeNull();
    expect(await useAppStore.getState().loadPdfPosition('b')).toBe(2);
  });

  it('writes the page through to IndexedDB, keeping every other file', async () => {
    idb.get.mockResolvedValue({ other: { page: 3, at: 1 } });
    vi.spyOn(Date, 'now').mockReturnValue(500);

    await useAppStore.getState().savePdfPosition('EBC-MT:l1', 12);

    expect(lastWrite()).toEqual([
      'meta',
      PDF_POSITIONS_KEY,
      { other: { page: 3, at: 1 }, 'EBC-MT:l1': { page: 12, at: 500 } },
    ]);
    expect(await useAppStore.getState().loadPdfPosition('EBC-MT:l1')).toBe(12);
  });

  it('refuses a page that is not a non-negative integer', async () => {
    await useAppStore.getState().savePdfPosition('k', -1);
    await useAppStore.getState().savePdfPosition('k', 1.5);
    expect(idb.set).not.toHaveBeenCalled();
  });

  it('forgets the longest-unread files beyond the cap', async () => {
    const stored: Record<string, { page: number; at: number }> = {};
    for (let i = 0; i < PDF_POSITIONS_CAP; i++) stored[`k${i}`] = { page: 1, at: i };
    idb.get.mockResolvedValue(stored);
    vi.spyOn(Date, 'now').mockReturnValue(PDF_POSITIONS_CAP + 100);

    await useAppStore.getState().savePdfPosition('new', 4);

    const written = lastWrite()[2] as Record<string, unknown>;
    expect(Object.keys(written)).toHaveLength(PDF_POSITIONS_CAP);
    expect(written.k0).toBeUndefined();
    expect(written.new).toEqual({ page: 4, at: PDF_POSITIONS_CAP + 100 });
  });

  it('a write that fails keeps the page in memory for this session', async () => {
    idb.set.mockRejectedValueOnce(new Error('quota'));
    await useAppStore.getState().savePdfPosition('k', 5);
    expect(await useAppStore.getState().loadPdfPosition('k')).toBe(5);
  });
});
