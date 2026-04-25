import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useIskamStore } from '../iskamStore';
import { IndexedDBService } from '../../services/storage';
import { syncIskam } from '../../services/sync/syncIskam';
import { IskamAuthError } from '../../api/iskam';
import type { IskamData } from '../../types/iskam';

vi.mock('../../services/storage', () => ({
    IndexedDBService: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('../../services/sync/syncIskam', () => ({
    syncIskam: vi.fn(),
}));

const SAMPLE: IskamData = {
    konta: [{ name: 'Hlavní konto', balance: 100, balanceText: '100 Kč', topUpHref: '/Platby/NabitiKonta/0' }],
    ubytovani: [],
    syncedAt: 1700000000000,
};

describe('useIskamStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useIskamStore.setState({ data: null, status: 'idle', error: null });
    });

    it('hydrates from IDB cache without changing status to loading', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValue(SAMPLE);
        await useIskamStore.getState().loadFromCache();
        expect(useIskamStore.getState().data).toEqual(SAMPLE);
        expect(useIskamStore.getState().status).toBe('success');
    });

    it('refresh() sets loading when no prior data, then success', async () => {
        vi.mocked(syncIskam).mockResolvedValue();
        vi.mocked(IndexedDBService.get).mockResolvedValue(SAMPLE);
        const promise = useIskamStore.getState().refresh();
        expect(useIskamStore.getState().status).toBe('loading');
        await promise;
        expect(useIskamStore.getState().status).toBe('success');
        expect(useIskamStore.getState().data).toEqual(SAMPLE);
    });

    it('refresh() with auth failure sets error="auth"', async () => {
        vi.mocked(syncIskam).mockRejectedValue(new IskamAuthError());
        await useIskamStore.getState().refresh();
        expect(useIskamStore.getState().status).toBe('error');
        expect(useIskamStore.getState().error).toBe('auth');
    });

    it('refresh() with network failure sets error="network"', async () => {
        vi.mocked(syncIskam).mockRejectedValue(new Error('boom'));
        await useIskamStore.getState().refresh();
        expect(useIskamStore.getState().status).toBe('error');
        expect(useIskamStore.getState().error).toBe('network');
    });
});
