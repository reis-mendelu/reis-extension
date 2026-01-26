/**
 * Tests for useExamActions - Optimistic Updates
 * 
 * Tests the exam registration/unregistration logic with optimistic UI updates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExamActions } from '../useExamActions';
import * as examsAPI from '../../../api/exams';
import { IndexedDBService } from '../../../services/storage';
import type { ExamSubject, ExamSection } from '../../../types/exams';

// Mock dependencies
vi.mock('../../../api/exams');
vi.mock('../../../services/storage', () => ({
  StorageService: {
    set: vi.fn(),
  },
  IndexedDBService: {
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
  },
  STORAGE_KEYS: {
    EXAMS_DATA: 'exams_data',
    EXAMS_LAST_MODIFIED: 'exams_last_modified',
  }
}));
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockSetExams = vi.fn();
const mockFetchExams = vi.fn();

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector) => {
    const mockState = {
      setExams: mockSetExams,
      fetchExams: mockFetchExams,
    };
    return selector(mockState);
  }),
}));

// Test helpers
function createMockTerm(id: string, overrides = {}) {
  return {
    id,
    date: '20.01.2026',
    time: '09:00',
    capacity: '10/20',
    full: false,
    room: 'Q01',
    teacher: 'Dr. Test',
    teacherId: '12345',
    canRegisterNow: true,
    ...overrides,
  };
}

function createMockSection(overrides: Partial<ExamSection> = {}): ExamSection {
  return {
    id: 'section-1',
    name: 'zkouška',
    type: 'exam',
    status: 'available',
    terms: [
      createMockTerm('term-1'),
      createMockTerm('term-2'),
      createMockTerm('term-3'),
    ],
    ...overrides,
  } as ExamSection;
}

function createMockExams(subjectOverrides: Partial<ExamSubject> = {}, sectionOverrides: Partial<ExamSection> = {}): ExamSubject[] {
  const sections = subjectOverrides.sections || [createMockSection(sectionOverrides)];
  
  return [
    {
      id: 'subj-1',
      name: 'Základy objektového návrhu',
      code: 'EBC-ZON',
      sections,
      ...subjectOverrides,
    },
  ];
}

describe('useExamActions - Optimistic Updates', () => {
  let mockSetExpandedSectionId: ReturnType<typeof vi.fn>;
  let mockExams: ExamSubject[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetExpandedSectionId = vi.fn();
    mockExams = createMockExams();

    // Default API mocks
    vi.mocked(examsAPI.registerExam).mockResolvedValue({ success: true });
    vi.mocked(examsAPI.unregisterExam).mockResolvedValue({ success: true });
    vi.mocked(examsAPI.fetchExamData).mockResolvedValue(mockExams);
  });

  describe('Registration', () => {
    it('should immediately update local state on successful registration', async () => {
      const { result } = renderHook(() =>
        useExamActions({
          exams: mockExams,
          setExpandedSectionId: mockSetExpandedSectionId,
        })
      );

      const section = mockExams[0].sections[0];
      const termId = 'term-2';

      // Trigger registration
      await act(async () => {
        result.current.handleRegisterRequest(section, termId);
      });

      // Wait for state update
      await waitFor(() => {
        expect(result.current.pendingAction).toBeTruthy();
      });

      // Confirm action
      await act(async () => {
        await result.current.handleConfirmAction();
      });

      // Wait for async operations
      await waitFor(() => {
        expect(mockSetExams).toHaveBeenCalled();
      });

      // Verify optimistic update
      const updatedExams = mockSetExams.mock.calls[0][0];
      expect(updatedExams[0].sections[0].status).toBe('registered');
      expect(updatedExams[0].sections[0].registeredTerm).toBeDefined();
      expect(updatedExams[0].sections[0].registeredTerm?.id).toBe(termId);

      // Verify NO fetchExamData call (optimistic pattern)
      expect(examsAPI.fetchExamData).not.toHaveBeenCalled();
    });

    it('should persist optimistic updates to localStorage', async () => {
      const { result } = renderHook(() =>
        useExamActions({
          exams: mockExams,
          setExpandedSectionId: mockSetExpandedSectionId,
        })
      );

      const section = mockExams[0].sections[0];
      const termId = 'term-1';

      await act(async () => {
        result.current.handleRegisterRequest(section, termId);
      });

      await waitFor(() => {
        expect(result.current.pendingAction).toBeTruthy();
      });

      await act(async () => {
        await result.current.handleConfirmAction();
      });

      await waitFor(() => {
        expect(IndexedDBService.set).toHaveBeenCalledWith(
          'exams',
          'current',
          expect.arrayContaining([
            expect.objectContaining({
              sections: expect.arrayContaining([
                expect.objectContaining({ status: 'registered' }),
              ]),
            }),
          ])
        );
      });

      // Verify timestamp update
      expect(IndexedDBService.set).toHaveBeenCalledWith(
        'meta',
        'exams_modified',
        expect.any(Number)
      );
    });

    it('should handle term change (unregister + register) atomically', async () => {
      // Start with registered section
      const registeredExams = createMockExams({}, {
        status: 'registered',
        registeredTerm: {
          id: 'term-1',
          date: '20.01.2026',
          time: '09:00',
          room: 'Q01',
        },
      });

      const { result } = renderHook(() =>
        useExamActions({
          exams: registeredExams,
          setExpandedSectionId: mockSetExpandedSectionId,
        })
      );

      const section = registeredExams[0].sections[0];
      const newTermId = 'term-2';

      await act(async () => {
        result.current.handleRegisterRequest(section, newTermId);
      });

      await waitFor(() => {
        expect(result.current.pendingAction).toBeTruthy();
      });

      await act(async () => {
        await result.current.handleConfirmAction();
      });

      await waitFor(() => {
        expect(examsAPI.unregisterExam).toHaveBeenCalledWith('term-1');
        expect(examsAPI.registerExam).toHaveBeenCalledWith(newTermId);
      });

      // Verify final state has new term
      const updatedExams = mockSetExams.mock.calls[0][0];
      expect(updatedExams[0].sections[0].registeredTerm?.id).toBe(newTermId);
    });
  });

  describe('Unregistration', () => {
    it('should immediately update local state on successful unregistration', async () => {
      const registeredExams = createMockExams({}, {
        status: 'registered',
        registeredTerm: {
          id: 'term-1',
          date: '20.01.2026',
          time: '09:00',
          room: 'Q01',
        },
      });

      const { result } = renderHook(() =>
        useExamActions({
          exams: registeredExams,
          setExpandedSectionId: mockSetExpandedSectionId,
        })
      );

      const section = registeredExams[0].sections[0];

      await act(async () => {
        result.current.handleUnregisterRequest(section);
      });

      await waitFor(() => {
        expect(result.current.pendingAction).toBeTruthy();
      });

      await act(async () => {
        await result.current.handleConfirmAction();
      });

      await waitFor(() => {
        expect(mockSetExams).toHaveBeenCalled();
      });

      const updatedExams = mockSetExams.mock.calls[0][0];
      expect(updatedExams[0].sections[0].status).toBe('available');
      expect(updatedExams[0].sections[0].registeredTerm).toBeUndefined();

      // Verify NO fetchExamData call
      expect(examsAPI.fetchExamData).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should rollback optimistic update on API failure', async () => {
      // Mock API failure
      vi.mocked(examsAPI.registerExam).mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      const { result } = renderHook(() =>
        useExamActions({
          exams: mockExams,
          setExpandedSectionId: mockSetExpandedSectionId,
        })
      );

      const section = mockExams[0].sections[0];

      await act(async () => {
        result.current.handleRegisterRequest(section, 'term-1');
      });

      await waitFor(() => {
        expect(result.current.pendingAction).toBeTruthy();
      });

      await act(async () => {
        await result.current.handleConfirmAction();
      });

      await waitFor(() => {
        expect(examsAPI.registerExam).toHaveBeenCalled();
      });

      // Should NOT update state on failure
      expect(mockSetExams).not.toHaveBeenCalled();
    });
  });
});
