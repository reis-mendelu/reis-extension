/**
 * syncSubjects is the one sync step that writes to BOTH tiers: the subject list
 * to IndexedDB and attendance straight into the Zustand store. Both must happen,
 * or the panel renders subjects with permanently blank attendance dots.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const set = vi.hoisted(() => vi.fn());
const fetchDualLanguageSubjects = vi.hoisted(() => vi.fn());
const setAttendance = vi.hoisted(() => vi.fn());

vi.mock('../storage', () => ({ IndexedDBService: { set } }));
vi.mock('../../api/subjects', () => ({ fetchDualLanguageSubjects }));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: { getState: () => ({ setAttendance }) },
}));

import { syncSubjects } from './syncSubjects';

const result = (data: Record<string, unknown>, attendance: unknown = { 'EBC-OS': 0.8 }) => ({
  subjects: { data },
  attendance,
});

describe('syncSubjects', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stores subjects and pushes attendance into the store', async () => {
    const r = result({ 'EBC-OS': { name: 'Operating Systems' } });
    fetchDualLanguageSubjects.mockResolvedValue(r);

    await syncSubjects();

    expect(set).toHaveBeenCalledWith('subjects', 'current', r.subjects);
    expect(setAttendance).toHaveBeenCalledWith(r.attendance);
  });

  it('forwards the studium selector to the API', async () => {
    // A student with two concurrent studies gets the wrong subject list if this
    // is dropped -- the API defaults to whichever study IS considers primary.
    fetchDualLanguageSubjects.mockResolvedValue(result({ X: {} }));

    await syncSubjects('12345');

    expect(fetchDualLanguageSubjects).toHaveBeenCalledWith('12345');
  });

  it('writes nothing when the subject map is empty', async () => {
    fetchDualLanguageSubjects.mockResolvedValue(result({}));

    await syncSubjects();

    expect(set).not.toHaveBeenCalled();
    expect(setAttendance).not.toHaveBeenCalled();
  });

  it('writes nothing when the fetch resolves null', async () => {
    fetchDualLanguageSubjects.mockResolvedValue(null);

    await syncSubjects();

    expect(set).not.toHaveBeenCalled();
    expect(setAttendance).not.toHaveBeenCalled();
  });
});
