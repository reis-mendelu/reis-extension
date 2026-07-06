import { IndexedDBService } from '../services/storage';
import { MockManager } from './mock/MockManager';
import { MOCK_REGISTRY, DEFAULT_MOCK_SOCIETY } from './mock/registry';

/**
 * Initializes the extension with mock data for demo purposes.
 */
export async function initMockData() {
  try {
    const societyId = import.meta.env.VITE_MOCK_SOCIETY;
    const targetId = societyId && MOCK_REGISTRY[societyId] ? societyId : DEFAULT_MOCK_SOCIETY;

    // safe: targetId is either a validated MOCK_REGISTRY key or DEFAULT_MOCK_SOCIETY (itself a registered key)
    await MockManager.loadDataset(MOCK_REGISTRY[targetId]!);

    const weekStart = new Date('2026-02-10T00:00:00');
    await IndexedDBService.set('meta', 'schedule_week_start', weekStart.toISOString());
  } catch {
    // Mock init failure is non-critical in dev
  }
}

/**
 * Clears all mock data from IndexedDB.
 */
export async function clearMockData() {
  try {
    await IndexedDBService.clear('exams');
    await IndexedDBService.clear('schedule');
    await IndexedDBService.delete('meta', 'schedule_week_start');
    await IndexedDBService.delete('meta', 'active_mock_society');
  } catch {
    // Cleanup failure is non-critical
  }
}
