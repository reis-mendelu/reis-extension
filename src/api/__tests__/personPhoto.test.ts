import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

const fetchViaProxy = vi.fn();
vi.mock('../proxyClient', () => ({
    fetchViaProxy: (...args: unknown[]) => fetchViaProxy(...args),
}));

import { fetchPersonPhoto, __resetPersonPhotoCache } from '../personPhoto';

describe('fetchPersonPhoto', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetPersonPhotoCache();
    });

    it('requests the authed foto.pl URL through the proxy with image responseType', async () => {
        fetchViaProxy.mockResolvedValue('data:image/jpeg;base64,AAAA');
        const url = await fetchPersonPhoto(12345);
        expect(url).toBe('data:image/jpeg;base64,AAAA');
        expect(fetchViaProxy).toHaveBeenCalledWith(
            'https://is.mendelu.cz/auth/lide/foto.pl?id=12345;lang=cz',
            { responseType: 'image' },
        );
    });

    it('caches per person — fetches once across repeated calls (number or string id)', async () => {
        fetchViaProxy.mockResolvedValue('data:image/jpeg;base64,BBBB');
        await fetchPersonPhoto(7);
        await fetchPersonPhoto('7');
        expect(fetchViaProxy).toHaveBeenCalledTimes(1);
    });

    it('does not cache failures so a later mount can retry', async () => {
        fetchViaProxy.mockRejectedValueOnce(new Error('boom'));
        await expect(fetchPersonPhoto(9)).rejects.toThrow('boom');
        fetchViaProxy.mockResolvedValueOnce('data:image/jpeg;base64,CCCC');
        const url = await fetchPersonPhoto(9);
        expect(url).toBe('data:image/jpeg;base64,CCCC');
        expect(fetchViaProxy).toHaveBeenCalledTimes(2);
    });
});
