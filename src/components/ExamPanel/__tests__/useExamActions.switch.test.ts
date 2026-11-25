/**
 * The switch of a registered exam term through the hook: what the student is
 * told, and that the list is re-read. The decisions themselves are pinned in
 * switchExamTerm.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';
import { useExamActions } from '../useExamActions';
import * as examsAPI from '../../../api/exams';
import * as swapAPI from '../../../api/examSwap';
import type { ExamSubject, ExamSection } from '../../../types/exams';

vi.mock('../../../api/exams');
vi.mock('../../../api/examSwap');
vi.mock('../../../services/storage', () => ({
  IndexedDBService: { set: vi.fn().mockResolvedValue(undefined), get: vi.fn() },
  STORAGE_KEYS: {},
}));
vi.mock('../../../mobile/storeReview', () => ({ maybeAskForStoreReview: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { mockSetExams, mockTriggerExamsRefresh } = vi.hoisted(() => ({
  mockSetExams: vi.fn(),
  mockTriggerExamsRefresh: vi.fn(),
}));

vi.mock('../../../store/useAppStore', () => {
  const state = {
    setExams: mockSetExams,
    triggerExamsRefresh: mockTriggerExamsRefresh,
    language: 'en',
    openReport: vi.fn(),
    gradeHistory: null,
    subjects: null,
  };
  const useAppStore = vi.fn((sel: (s: typeof state) => unknown) => sel(state)) as unknown as ((
    sel: (s: typeof state) => unknown
  ) => unknown) & { getState: () => typeof state };
  useAppStore.getState = () => state;
  return { useAppStore };
});

function createMockTerm(id: string, overrides = {}) {
  return {
    id,
    date: '20.01.2026',
    time: '09:00',
    full: false,
    room: 'Q01',
    canRegisterNow: true,
    ...overrides,
  };
}

function createMockExams(
  _subjectOverrides: Partial<ExamSubject> = {},
  sectionOverrides: Partial<ExamSection> = {}
): ExamSubject[] {
  const section = {
    id: 'section-1',
    name: 'zkouška',
    type: 'exam',
    status: 'available',
    terms: [createMockTerm('term-1'), createMockTerm('term-2'), createMockTerm('term-3')],
    ...sectionOverrides,
  } as unknown as ExamSection;
  return [{ version: 1, id: 'subj-1', name: 'Test', code: 'TST', sections: [section] }];
}

const mockSetExpandedSectionId = vi.fn();

describe('useExamActions - switching a registered term', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(swapAPI.swapExamTerm).mockResolvedValue({ success: true });
  });

  const registered = () =>
    createMockExams(
      {},
      {
        status: 'registered',
        registeredTerm: { id: 'term-1', date: '20.01.2026', time: '09:00', room: 'Q01' },
      }
    );
  const switchTo = async (exams: ExamSubject[]) => {
    const { result } = renderHook(() =>
      useExamActions({ exams, setExpandedSectionId: mockSetExpandedSectionId })
    );
    const section = exams[0]?.sections[0];
    if (!section) throw new Error('fixture has no section');
    await act(async () => {
      await result.current.handleRegisterDirect(section, 'term-2');
    });
  };

  it('tells the student plainly when no term is left, and re-reads the list', async () => {
    const exams = registered();
    vi.mocked(examsAPI.fetchExamData)
      .mockResolvedValueOnce(exams) // pre-flight: term-1 registered, term-2 open
      .mockResolvedValueOnce(createMockExams()); // after: registered nowhere
    vi.mocked(swapAPI.swapExamTerm).mockResolvedValue({ success: false, error: 'plno' });
    await switchTo(exams);
    expect(vi.mocked(toast.error).mock.calls[0]?.[0]).toMatch(/not registered for any term/);
    expect(mockTriggerExamsRefresh).toHaveBeenCalled();
    expect(mockSetExams).not.toHaveBeenCalled();
  });

  it('leaves the registration alone when the new term filled up meanwhile', async () => {
    const exams = registered();
    vi.mocked(examsAPI.fetchExamData).mockResolvedValue(
      createMockExams(
        {},
        {
          status: 'registered',
          registeredTerm: { id: 'term-1', date: '20.01.2026', time: '09:00', room: 'Q01' },
          terms: [
            createMockTerm('term-1'),
            createMockTerm('term-2', { full: true }),
          ] as unknown as ExamSection['terms'],
        }
      )
    );
    await switchTo(exams);
    expect(swapAPI.swapExamTerm).not.toHaveBeenCalled();
    expect(vi.mocked(toast.error).mock.calls[0]?.[0]).toMatch(/can no longer register/);
  });

  it('re-reads the list when the switch throws', async () => {
    vi.mocked(examsAPI.fetchExamData).mockRejectedValue(new Error('boom'));
    await switchTo(registered());
    expect(mockTriggerExamsRefresh).toHaveBeenCalled();
  });
});
