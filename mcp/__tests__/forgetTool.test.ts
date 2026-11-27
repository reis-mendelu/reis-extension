import { describe, it, expect, vi } from 'vitest';
import { homedir } from 'node:os';
import { forgetEverything, shown } from '../forgetTool';
import type { Store } from '../store';

const fake = (persistent: boolean, forget: Store['forget']) =>
  ({
    dir: `${homedir()}/Library/reIS for Claude`,
    persistent,
    forget,
  }) as unknown as Store;
const eacces = () =>
  Object.assign(new Error("EACCES: permission denied, mkdir '/Users/anna/x'"), { code: 'EACCES' });

describe('forgetEverything', () => {
  it('clears memory first and reports what the store counted', async () => {
    const order: string[] = [];
    const r = await forgetEverything(
      fake(true, async () => (order.push('store'), { files: 3, bytes: 2 * 1024 * 1024 })),
      () => order.push('memory')
    );
    expect(order).toEqual(['memory', 'store']);
    expect(r).toMatchObject({ forgotten: true, filesRemoved: 3, removed: '2.0 MB' });
  });

  it('does not call it a failure when the folder was never usable, and says what is left', async () => {
    const clear = vi.fn();
    const r = await forgetEverything(
      fake(false, async () => Promise.reject(eacces())),
      clear
    );
    expect(clear).toHaveBeenCalled();
    expect(r).toMatchObject({ forgotten: false });
    expect(JSON.stringify(r)).toContain('EACCES');
    expect(JSON.stringify(r)).not.toContain('/Users/anna/x');
  });

  it('fails, without the account name in the message, when a usable folder cannot be emptied', async () => {
    await expect(
      forgetEverything(
        fake(true, async () => Promise.reject(eacces())),
        () => {}
      )
    ).rejects.toThrow(/^Could not delete everything in ~\/Library\/reIS/);
  });

  it('shows the folder without the home directory', () => {
    expect(shown('/Users/anna/Library/x', '/Users/anna')).toBe('~/Library/x');
    expect(shown('/elsewhere/x', '/Users/anna')).toBe('/elsewhere/x');
  });
});
