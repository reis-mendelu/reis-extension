import { describe, it, expect, vi } from 'vitest';
const rpc = vi.fn();
vi.mock('@/services/admin/authClient', () => ({
  adminAuthClient: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock('@/utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));
import { fetchUsageRetention } from '../usageRetention';

describe('fetchUsageRetention', () => {
  // The shape usage_retention_unchecked() returned against production on 2026-10-08.
  it('maps the json to camelCase', async () => {
    rpc.mockResolvedValue({ data: { regulars_ever: 2435, gone_quiet: 97 }, error: null });

    expect(await fetchUsageRetention()).toEqual({ regularsEver: 2435, goneQuiet: 97 });
    expect(rpc).toHaveBeenLastCalledWith('usage_retention');
  });

  it('returns null on error or malformed json', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });
    expect(await fetchUsageRetention()).toBeNull();
    rpc.mockResolvedValue({ data: { nope: 1 }, error: null });
    expect(await fetchUsageRetention()).toBeNull();
  });
});
