/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchAdminStudyAids = vi.fn();
const saveAdminStudyAids = vi.fn();
vi.mock('../../../api/adminStudyAids', () => ({ fetchAdminStudyAids, saveAdminStudyAids }));
vi.mock('../../../api/studyAids', () => ({ fetchStudyAids: vi.fn() }));

const { useAppStore } = await import('../../useAppStore');

const row = (isActive: boolean) => [{ id: 'mendelu-app', audience: ['af:B-ATE'], isActive }];
const later = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ adminStudyAids: null, adminStudyAidsLoading: false } as any);
});

describe('the console list in the store', () => {
  it('is loading while a read is out, and not once it lands', async () => {
    const read = later<unknown>();
    fetchAdminStudyAids.mockReturnValue(read.promise);
    const loading = useAppStore.getState().loadAdminStudyAids();
    expect(useAppStore.getState().adminStudyAidsLoading).toBe(true);
    read.resolve(row(true));
    await loading;
    expect(useAppStore.getState().adminStudyAidsLoading).toBe(false);
    expect(useAppStore.getState().adminStudyAids).toEqual(row(true));
  });

  it('keeps the list on screen when a reload fails', async () => {
    useAppStore.setState({ adminStudyAids: row(true) } as any);
    fetchAdminStudyAids.mockResolvedValue(null);
    await useAppStore.getState().loadAdminStudyAids();
    expect(useAppStore.getState().adminStudyAids).toEqual(row(true));
    expect(useAppStore.getState().adminStudyAidsLoading).toBe(false);
  });

  // A tab refresh that read the old row, answering after a save and its reload,
  // must not put the old switch back in the store for the next visit.
  it('ignores an older read that answers after a newer one', async () => {
    const older = later<unknown>();
    const newer = later<unknown>();
    fetchAdminStudyAids.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const first = useAppStore.getState().loadAdminStudyAids();
    const second = useAppStore.getState().loadAdminStudyAids();
    newer.resolve(row(true));
    await second;
    older.resolve(row(false));
    await first;
    expect(useAppStore.getState().adminStudyAids).toEqual(row(true));
    expect(useAppStore.getState().adminStudyAidsLoading).toBe(false);
  });

  it('reloads after a save, whether or not it landed', async () => {
    saveAdminStudyAids.mockResolvedValue(false);
    fetchAdminStudyAids.mockResolvedValue(row(false));
    const ok = await useAppStore
      .getState()
      .saveAdminStudyAids('mendelu-app', { audience: ['af:B-ATE'], isActive: true });
    expect(ok).toBe(false);
    expect(useAppStore.getState().adminStudyAids).toEqual(row(false));
  });
});
