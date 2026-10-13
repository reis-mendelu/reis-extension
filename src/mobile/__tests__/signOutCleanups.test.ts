import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __resetSignOutCleanupsForTests,
  registerSignOutCleanup,
  runSignOutCleanups,
} from '../signOutCleanups';

describe('signOutCleanups', () => {
  beforeEach(() => __resetSignOutCleanupsForTests());

  it('runs every registered cleanup', async () => {
    const a = vi.fn(async () => {});
    const b = vi.fn(async () => {});
    registerSignOutCleanup(a);
    registerSignOutCleanup(b);
    await runSignOutCleanups();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('a failing cleanup does not stop the others, and is reported', async () => {
    const b = vi.fn(async () => {});
    registerSignOutCleanup(async () => {
      throw new Error('keystore');
    });
    registerSignOutCleanup(b);
    await expect(runSignOutCleanups()).rejects.toThrow('keystore');
    expect(b).toHaveBeenCalled();
  });

  it('is a no-op with nothing registered (the extension, the MCP server)', async () => {
    await expect(runSignOutCleanups()).resolves.toBeUndefined();
  });
});
