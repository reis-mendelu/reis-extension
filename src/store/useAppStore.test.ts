import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IndexedDBService } from '../services/storage';
import { useAppStore } from './useAppStore';

// Mock services
vi.mock('../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../services/sync', () => ({
  syncService: {
    subscribe: vi.fn(() => vi.fn()),
  },
}));

describe('useAppStore Slices', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset store state if needed (Zustand doesn't have a built-in reset but we can manually reset)
    useAppStore.setState({
      schedule: { data: [], status: 'idle', weekStart: null },
      exams: { data: [], status: 'idle', error: null },
      syllabuses: { cache: {}, loading: {} },
    });
  });

  describe('Schedule Slice', () => {
    it('should fetch schedule from IndexedDB and update state', async () => {
       const mockData = [{ id: '1', date: '20230101' }];
       vi.mocked(IndexedDBService.get).mockImplementation(async (store, key) => {
         if (store === 'schedule') return mockData;
         if (store === 'meta' && key === 'schedule_week_start') return '2023-01-01';
         return null;
       });

       await useAppStore.getState().fetchSchedule();
       
       const state = useAppStore.getState();
       expect(state.schedule.status).toBe('success');
       expect(state.schedule.data).toEqual(mockData);
       expect(state.schedule.weekStart).toBeInstanceOf(Date);
    });

    it('should handle fetch errors', async () => {
      vi.mocked(IndexedDBService.get).mockRejectedValue(new Error('Fetch failed'));
      
      await useAppStore.getState().fetchSchedule();
      
      expect(useAppStore.getState().schedule.status).toBe('error');
    });
  });

  describe('Exam Slice', () => {
    it('should fetch exams and handle success', async () => {
      const mockExams = [{ id: 'e1', name: 'Exam 1' }];
      vi.mocked(IndexedDBService.get).mockResolvedValue(mockExams);
      
      await useAppStore.getState().fetchExams();
      
      const state = useAppStore.getState();
      expect(state.exams.status).toBe('success');
      expect(state.exams.data).toEqual(mockExams);
    });
  });
});
