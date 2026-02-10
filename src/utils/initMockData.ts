import { IndexedDBService } from '../services/storage';
import { MockManager } from './mock/MockManager';
import { MOCK_REGISTRY, DEFAULT_MOCK_SOCIETY } from './mock/registry';

/**
 * Initializes the extension with mock data for demo purposes.
 */
export async function initMockData() {
  console.log('[MockData] Initializing mock data framework...');
  
  try {
    // 1. Determine active society from environment variable
    const societyId = import.meta.env.VITE_MOCK_SOCIETY;
    const targetId = (societyId && MOCK_REGISTRY[societyId]) 
      ? societyId 
      : DEFAULT_MOCK_SOCIETY;

    // 2. Load the dataset
    await MockManager.loadDataset(MOCK_REGISTRY[targetId]);

    // 3. Set a week start date for the calendar (Monday, Feb 10, 2026)
    const weekStart = new Date('2026-02-10T00:00:00');
    await IndexedDBService.set('meta', 'schedule_week_start', weekStart.toISOString());
    
    console.log(`[MockData] ✓ Mock framework active (Society: ${targetId})`);
  } catch (error) {
    console.error('[MockData] Failed to initialize mock framework:', error);
  }
}

/**
 * Clears all mock data from IndexedDB.
 */
export async function clearMockData() {
  console.log('[MockData] Clearing mock data...');
  try {
    await IndexedDBService.clear('exams');
    await IndexedDBService.clear('schedule');
    await IndexedDBService.delete('meta', 'schedule_week_start');
    // Clear legacy meta key if it exists
    await IndexedDBService.delete('meta', 'active_mock_society');
    console.log('[MockData] ✓ Mock data cleared successfully!');
  } catch (error) {
    console.error('[MockData] Failed to clear mock data:', error);
  }
}
