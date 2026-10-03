import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchOdevzdavarny = vi.fn();
vi.mock('../../../api/odevzdavarny', () => ({
  fetchOdevzdavarny: (...a: unknown[]) => fetchOdevzdavarny(...a),
}));
vi.mock('../../storage/IndexedDBService', () => ({
  IndexedDBService: { set: vi.fn(async () => {}) },
}));

import { syncOdevzdavarny } from '../syncOdevzdavarny';
import { IndexedDBService } from '../../storage/IndexedDBService';

describe('syncOdevzdavarny', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores an empty list — IS listing no boxes must clear the old ones', async () => {
    fetchOdevzdavarny.mockResolvedValue({ assignments: [], lastFetched: 1 });
    await syncOdevzdavarny('st', 'ob');
    expect(IndexedDBService.set).toHaveBeenCalledWith('odevzdavarny', 'st_ob', []);
  });

  it('stores nothing when the read failed', async () => {
    fetchOdevzdavarny.mockResolvedValue(null);
    expect(await syncOdevzdavarny('st', 'ob')).toBeNull();
    expect(IndexedDBService.set).not.toHaveBeenCalled();
  });
});
