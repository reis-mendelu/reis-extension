import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { createCvicneTestsSlice } from '../createCvicneTestsSlice';
import type { CvicneTestsSlice } from '../../types';
import { IndexedDBService } from '../../../services/storage';
import type { Odevzdavarna } from '../../../api/odevzdavarny';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../utils/userParams', () => ({
  getUserParams: vi.fn().mockResolvedValue({ studium: '111', obdobi: '222' }),
}));

const row = (over: Partial<Odevzdavarna>): Odevzdavarna => ({
  courseId: 'P1',
  courseNameCs: 'Java',
  courseNameEn: 'Java',
  name: 'Projekt',
  type: '',
  deadline: '08.11.2026 23:59',
  odevzdavarnaId: '',
  fileCount: 0,
  uploadUrl: '',
  ...over,
});

function makeSlice() {
  let state = { studiumId: '111', obdobiId: '222' } as unknown as CvicneTestsSlice & {
    studiumId: string;
    obdobiId: string;
  };
  const set = (p: unknown) => {
    const patch = typeof p === 'function' ? (p as (s: typeof state) => object)(state) : p;
    state = { ...state, ...(patch as object) };
  };
  const get = () => state;
  state = { ...state, ...createCvicneTestsSlice(set as never, get as never, {} as never) };
  return { get };
}

/**
 * 5.3.0 stored `uploadUrl: ''` for a box whose IS row had no upload link. Every
 * consumer renders `<a href={box.uploadUrl} target="_blank">`, and an empty
 * href opens the app's own page — the extension's iframe in a new tab, and on
 * the phone a navigation the external-link interceptor deliberately ignores.
 * Rows read back from that cache must link to the IS list instead.
 */
describe('fetchOdevzdavarny: cached rows without an upload link', () => {
  beforeEach(() => {
    (IndexedDBService.get as Mock).mockReset();
  });

  it('links an empty uploadUrl to the IS submission-box list', async () => {
    (IndexedDBService.get as Mock).mockResolvedValue([
      row({ uploadUrl: '' }),
      row({ uploadUrl: '', obdobi: '221' }),
      row({ uploadUrl: 'https://is.mendelu.cz/auth/student/odevzdavarny.pl?odevzdavarna=9' }),
    ]);
    const { get } = makeSlice();
    await get().fetchOdevzdavarny();

    expect(get().odevzdavarny.map((b) => b.uploadUrl)).toEqual([
      'https://is.mendelu.cz/auth/student/odevzdavarny.pl?studium=111;obdobi=222',
      'https://is.mendelu.cz/auth/student/odevzdavarny.pl?studium=111;obdobi=221',
      'https://is.mendelu.cz/auth/student/odevzdavarny.pl?odevzdavarna=9',
    ]);
  });
});
