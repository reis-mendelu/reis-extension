import { describe, it, expect, vi, beforeEach } from 'vitest';

// The iframe app has no auth cookies and cannot fetch is.mendelu.cz directly
// (works on Chrome, throws on Firefox). All IS fetches must route through
// fetchWithAuth, which proxies via the content script. These tests pin that.
const fetchWithAuth = vi.fn();
vi.mock('../client', () => ({
    fetchWithAuth: (...args: unknown[]) => fetchWithAuth(...args),
}));

import { checkOutlookSyncStatus, setOutlookSyncStatus } from '../outlookSync';

function toggleHtml(checked: boolean): string {
    return `<form>
        <input type="radio" name="prenos_o365" value="1" ${checked ? 'checked' : ''}>
        <input type="radio" name="prenos_o365" value="0" ${checked ? '' : 'checked'}>
    </form>`;
}

beforeEach(() => {
    fetchWithAuth.mockReset();
});

describe('checkOutlookSyncStatus', () => {
    it('routes through fetchWithAuth for both sources (Firefox iframe regression)', async () => {
        fetchWithAuth.mockImplementation(() => Promise.resolve(new Response(toggleHtml(true))));
        const result = await checkOutlookSyncStatus();
        expect(fetchWithAuth).toHaveBeenCalledTimes(2);
        expect(result).toBe(true);
    });

    it('returns false when either source is not enabled', async () => {
        fetchWithAuth
            .mockResolvedValueOnce(new Response(toggleHtml(true)))
            .mockResolvedValueOnce(new Response(toggleHtml(false)));
        expect(await checkOutlookSyncStatus()).toBe(false);
    });

    it('returns false (no throw) when the proxied fetch rejects', async () => {
        fetchWithAuth.mockRejectedValue(new Error('NetworkError'));
        expect(await checkOutlookSyncStatus()).toBe(false);
    });
});

describe('setOutlookSyncStatus', () => {
    it('POSTs via fetchWithAuth for both sources with the prenos_o365 flag', async () => {
        fetchWithAuth.mockResolvedValue(new Response('OK'));
        const ok = await setOutlookSyncStatus(true);
        expect(ok).toBe(true);
        expect(fetchWithAuth).toHaveBeenCalledTimes(2);
        const [, opts] = fetchWithAuth.mock.calls[0];
        expect(opts.method).toBe('POST');
        expect(opts.body).toContain('prenos_o365=1');
    });

    it('sends prenos_o365=0 when disabling', async () => {
        fetchWithAuth.mockResolvedValue(new Response('OK'));
        await setOutlookSyncStatus(false);
        const [, opts] = fetchWithAuth.mock.calls[0];
        expect(opts.body).toContain('prenos_o365=0');
    });
});
