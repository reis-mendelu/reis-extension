import { describe, it, expect, vi } from 'vitest';
import { applyStudySwitch } from '../applyStudySwitch';

describe('applyStudySwitch', () => {
  it('switches, then starts the crawl without waiting for it', async () => {
    let finish!: () => void;
    const sync = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const select = vi.fn(async () => ({ changed: true }));
    await expect(applyStudySwitch('900012', select, sync)).resolves.toEqual({
      success: true,
      changed: true,
    });
    expect(select).toHaveBeenCalledWith('900012');
    expect(sync).toHaveBeenCalledOnce();
    finish();
  });

  // The caller's rollback after a timeout names the study already in use.
  it('starts no crawl when nothing changed', async () => {
    const sync = vi.fn(async () => {});
    await applyStudySwitch('900011', async () => ({ changed: false }), sync);
    expect(sync).not.toHaveBeenCalled();
  });

  it('refuses a missing study, and passes a refused one on, crawling neither', async () => {
    const sync = vi.fn(async () => {});
    await expect(applyStudySwitch(undefined, vi.fn(), sync)).rejects.toThrow('missing studium');
    await expect(
      applyStudySwitch('1', () => Promise.reject(new Error('not active')), sync)
    ).rejects.toThrow('not active');
    expect(sync).not.toHaveBeenCalled();
  });
});
