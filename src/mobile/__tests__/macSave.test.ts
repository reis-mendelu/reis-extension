import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShareCanceledError } from '../../errors/shareCanceled';

let platform = 'ios';
const plugin = {
  isMac: vi.fn(async () => ({ mac: true })),
  save: vi.fn(async () => ({ url: 'file:///Users/x/Downloads/a.pdf' })),
  open: vi.fn(async () => ({ opened: true })),
};
const registerPlugin = vi.fn((_name: string) => plugin);

vi.mock('@capacitor/core', () => ({
  registerPlugin: (name: string) => registerPlugin(name),
  Capacitor: { getPlatform: () => platform },
}));

const { isMacApp, saveWithPanel, openOnMac, __resetMacSaveForTests } = await import('../macSave');
// Read now: the suite's config clears mock calls between tests.
const registeredAs = registerPlugin.mock.calls.map((c) => c[0]);

describe('isMacApp', () => {
  beforeEach(() => {
    __resetMacSaveForTests();
    platform = 'ios';
    plugin.isMac.mockReset().mockResolvedValue({ mac: true });
  });

  it('registers the plugin under its native jsName', () => {
    expect(registeredAs).toEqual(['MacSave']);
  });

  it('asks native whether this iOS app runs on a Mac', async () => {
    await expect(isMacApp()).resolves.toBe(true);
  });

  it('is false on an iPhone or iPad', async () => {
    plugin.isMac.mockResolvedValue({ mac: false });
    await expect(isMacApp()).resolves.toBe(false);
  });

  /** Asked once: the answer cannot change while the app runs. */
  it('asks native once and remembers the answer', async () => {
    await isMacApp();
    await isMacApp();
    expect(plugin.isMac).toHaveBeenCalledTimes(1);
  });

  it('never asks native off iOS — Android has no half of this plugin', async () => {
    platform = 'android';
    await expect(isMacApp()).resolves.toBe(false);
    expect(plugin.isMac).not.toHaveBeenCalled();
  });

  /**
   * Failing closed toward the phones: a native half that cannot answer (an
   * older build, a rejected call) must leave an iPhone on the share sheet it
   * has always had, never on a Save panel that does not exist there.
   */
  it('reads a plugin that cannot answer as "not a Mac"', async () => {
    plugin.isMac.mockRejectedValue(new Error('"MacSave" plugin is not implemented on ios'));
    await expect(isMacApp()).resolves.toBe(false);
  });
});

describe('saveWithPanel', () => {
  beforeEach(() => {
    plugin.save.mockReset();
  });

  it('hands the written file to the Save panel', async () => {
    plugin.save.mockResolvedValue({ url: 'file:///Users/x/Downloads/a.pdf' });
    await saveWithPanel('file:///c/Documents/a.pdf');
    expect(plugin.save).toHaveBeenCalledWith({ url: 'file:///c/Documents/a.pdf' });
  });

  /** Same call as the share sheet: closing it is a choice, not a failure. */
  it('turns a cancelled panel into ShareCanceledError', async () => {
    plugin.save.mockRejectedValue(
      Object.assign(new Error('Save panel cancelled'), { code: 'cancelled' })
    );
    await expect(saveWithPanel('file:///c/a.pdf')).rejects.toBeInstanceOf(ShareCanceledError);
  });

  it('keeps a real failure a failure', async () => {
    plugin.save.mockRejectedValue(new Error('nothing to save at /c/a.pdf'));
    await expect(saveWithPanel('file:///c/a.pdf')).rejects.toThrow(/nothing to save/);
  });
});

describe('openOnMac', () => {
  it('reports whether macOS took the file', async () => {
    plugin.open.mockResolvedValueOnce({ opened: false });
    await expect(openOnMac('file:///c/x.mobileconfig')).resolves.toBe(false);
    plugin.open.mockResolvedValueOnce({ opened: true });
    await expect(openOnMac('file:///c/x.mobileconfig')).resolves.toBe(true);
  });
});
