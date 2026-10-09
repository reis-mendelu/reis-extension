import { describe, it, expect, vi } from 'vitest';
const rpc = vi.fn();
vi.mock('@/services/admin/authClient', () => ({
  adminAuthClient: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock('@/utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));
import { fetchUsageProgrammes } from '../usageProgrammes';

describe('fetchUsageProgrammes', () => {
  // The shape usage_programmes_unchecked returned on the stub database
  // (docs/verify-partner-targeting-migration.md).
  it('passes the groups through, -1 (under 5) included', async () => {
    rpc.mockResolvedValue({
      data: [
        { key: 'PEF B-OI', devices: 13 },
        { key: 'PEF ?', devices: -1 },
      ],
      error: null,
    });
    expect(await fetchUsageProgrammes(7)).toEqual([
      { key: 'PEF B-OI', devices: 13 },
      { key: 'PEF ?', devices: -1 },
    ]);
    expect(rpc).toHaveBeenLastCalledWith('usage_programmes', { p_days: 7 });
  });

  it('returns null on error or malformed json', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });
    expect(await fetchUsageProgrammes(7)).toBeNull();
    rpc.mockResolvedValue({ data: { nope: 1 }, error: null });
    expect(await fetchUsageProgrammes(7)).toBeNull();
  });
});
