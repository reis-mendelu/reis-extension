import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __resetSignOutCleanupsForTests,
  SignOutBlockedError,
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

  it('a cleanup that throws synchronously does not skip the ones after it', async () => {
    const b = vi.fn(async () => {});
    registerSignOutCleanup((() => {
      throw new Error('sync');
    }) as () => Promise<void>);
    registerSignOutCleanup(b);
    await expect(runSignOutCleanups()).rejects.toThrow('sync');
    expect(b).toHaveBeenCalled();
  });

  it('a cleanup that blocks the sign-out wins over an ordinary failure', async () => {
    registerSignOutCleanup(async () => {
      throw new Error('ordinary');
    });
    registerSignOutCleanup(async () => {
      throw new SignOutBlockedError('credential stuck');
    });
    await expect(runSignOutCleanups()).rejects.toBeInstanceOf(SignOutBlockedError);
  });
});
