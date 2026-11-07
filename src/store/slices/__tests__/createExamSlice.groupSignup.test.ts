import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '../../useAppStore';
import { useMenuItems } from '../../../hooks/ui/useMenuItems';
import type { ExamSubject } from '../../../types/exams';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

// useMenuItems pulls studium/obdobi through useUserParams, which otherwise
// reaches for is.mendelu.cz. The menu ids are all this test reads.
vi.mock('../../../hooks/useUserParams', () => ({
  useUserParams: () => ({ params: { studium: '1', obdobi: '1' }, loading: false, error: null }),
}));

/**
 * The reported shape, as IS actually served it: Algoritmizace, druh "Zápis na
 * cvičení", twelve bookable slots with real registration links. The student was
 * already sitting in that cvičení — his group had been assigned up front, so it
 * was never a termín registration and the section could never reach
 * `status: 'registered'`.
 */
const reported = [
  {
    version: 1,
    id: 'ALG',
    code: 'ALG',
    name: 'Algoritmizace',
    nameCs: 'Algoritmizace',
    sections: [
      {
        id: 'ALG-zapis-na-cviceni',
        name: 'Zápis na cvičení',
        nameCs: 'Zápis na cvičení',
        type: 'test',
        status: 'open',
        terms: [
          {
            id: '901',
            date: '21.09.2026',
            time: '11:00',
            room: 'P1014',
            capacity: { occupied: 2, total: 15 },
            full: false,
            canRegisterNow: true,
          },
        ],
      },
    ],
  },
] as unknown as ExamSubject[];

/**
 * Until report #37 this group was stripped at the store's door (#344). Then a
 * student lost a ZOO Vyškov excursion she could not see anywhere, so signups
 * are kept and shown in a collapsed group of their own at the bottom of
 * Zkoušky. What #344 was really about survives: no badge, and never under
 * Otevřené termíny.
 */
describe('a seminar-group signup arriving from IS', () => {
  beforeEach(() => {
    useAppStore.setState((s) => ({ exams: { ...s.exams, data: [], status: 'success' } }));
  });

  it('reaches the store, so the signup group can show it', () => {
    useAppStore.getState().setExams(reported);
    const [subject] = useAppStore.getState().exams.data;
    expect(subject?.sections.map((s) => s.name)).toEqual(['Zápis na cvičení']);
  });

  // The complaint was not really the row — it was being told he had something
  // to do. The menu badge counts every section with a registerable term, so
  // he carried a "1" on Zkoušky for a cvičení he was already enrolled in.
  it('does not put a badge on the Zkoušky menu item', () => {
    useAppStore.getState().setExams(reported);
    const { result } = renderHook(() => useMenuItems());
    expect(result.current.find((i) => i.id === 'exams')?.badge).toBe(0);
  });

  it('does not badge a registered signup either', () => {
    const registered = JSON.parse(JSON.stringify(reported)) as ExamSubject[];
    const sec = registered[0]!.sections[0]!;
    sec.status = 'registered';
    sec.registeredTerm = { id: '901', date: '21.09.2026', time: '11:00' };
    useAppStore.getState().setExams(registered);
    const { result } = renderHook(() => useMenuItems());
    expect(result.current.find((i) => i.id === 'exams')?.badge).toBe(0);
  });

  it('still badges a real exam, so the badge rule has not disabled the feature', () => {
    const withExam = JSON.parse(JSON.stringify(reported)) as ExamSubject[];
    withExam[0]!.sections.push({
      ...JSON.parse(JSON.stringify(reported[0]!.sections[0])),
      id: 'ALG-zkouska',
      name: 'Zkouška',
      nameCs: 'Zkouška',
    });
    useAppStore.getState().setExams(withExam);
    const { result } = renderHook(() => useMenuItems());
    expect(result.current.find((i) => i.id === 'exams')?.badge).toBe(1);
  });
});
