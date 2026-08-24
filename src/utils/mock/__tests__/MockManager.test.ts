import { describe, it, expect } from 'vitest';
import { MockManager } from '../MockManager';
import { MOCK_REGISTRY } from '../registry';
import { IndexedDBService } from '../../../services/storage';

describe('MockManager', () => {
  it('seeds the study plan, stats and comparison from the demo dataset', async () => {
    await MockManager.loadDataset(MOCK_REGISTRY.demo!);

    expect(await IndexedDBService.get('study_plan', 'current')).toBeTruthy();
    expect(await IndexedDBService.get('meta', 'study_stats')).toBeTruthy();
    expect(await IndexedDBService.get('meta', 'study_comparison')).toBeTruthy();
  });

  it('leaves the three society datasets valid without the new fields', async () => {
    await expect(MockManager.loadDataset(MOCK_REGISTRY.esn!)).resolves.toBeUndefined();
  });
});
