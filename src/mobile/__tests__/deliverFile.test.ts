import { describe, it, expect, vi } from 'vitest';
import { deliverFile, deliveryKindFor, type DeliverDeps } from '../deliverFile';
import { ShareCanceledError } from '../../errors/shareCanceled';

function deps(over: Partial<DeliverDeps> = {}): DeliverDeps {
  return {
    platform: 'android',
    saveToDownloads: vi.fn(async () => ({ uri: 'content://downloads/1' })),
    shareFile: vi.fn(async () => {}),
    isMac: vi.fn(async () => false),
    saveWithPanel: vi.fn(async () => {}),
    ...over,
  };
}

describe('deliveryKindFor', () => {
  it('uses Downloads on Android — a share sheet is not how a download behaves', () => {
    expect(deliveryKindFor('android')).toBe('downloads');
  });

  it('uses the share sheet on iOS, which genuinely has no Downloads folder', () => {
    expect(deliveryKindFor('ios')).toBe('share');
  });

  /**
   * reIS on a Mac is this iOS app ("Designed for iPad"), so `platform` reads
   * `ios` there too. A share sheet (AirDrop, Messages, Notes…) is not how a Mac
   * downloads a file; its Save panel is.
   */
  it('uses the Save panel on a Mac, where the same iOS build runs', () => {
    expect(deliveryKindFor('ios', true)).toBe('saved');
  });

  it('never asks Android or the web about a Mac', () => {
    expect(deliveryKindFor('android', true)).toBe('downloads');
    expect(deliveryKindFor('web', true)).toBe('share');
  });
});

describe('deliverFile', () => {
  it('writes to Downloads on Android and never opens a share sheet', async () => {
    const d = deps();
    await expect(deliverFile('a.pdf', 'AAA=', 'application/pdf', d)).resolves.toBe('downloads');
    expect(d.saveToDownloads).toHaveBeenCalledWith({
      filename: 'a.pdf',
      base64: 'AAA=',
      mime: 'application/pdf',
    });
    expect(d.shareFile).not.toHaveBeenCalled();
  });

  it('shares on iOS and never touches Downloads', async () => {
    const d = deps({ platform: 'ios' });
    await expect(deliverFile('a.pdf', 'AAA=', 'application/pdf', d)).resolves.toBe('share');
    expect(d.shareFile).toHaveBeenCalled();
    expect(d.saveToDownloads).not.toHaveBeenCalled();
  });

  it('opens the Save panel on a Mac and never the share sheet', async () => {
    const d = deps({ platform: 'ios', isMac: vi.fn(async () => true) });
    await expect(deliverFile('a.pdf', 'AAA=', 'application/pdf', d)).resolves.toBe('saved');
    expect(d.saveWithPanel).toHaveBeenCalledWith({
      filename: 'a.pdf',
      base64: 'AAA=',
      mime: 'application/pdf',
    });
    expect(d.shareFile).not.toHaveBeenCalled();
    expect(d.saveToDownloads).not.toHaveBeenCalled();
  });

  /** iPhone and iPad keep the share sheet: it IS their save flow. */
  it('keeps the share sheet on an iPhone or iPad', async () => {
    const d = deps({ platform: 'ios', isMac: vi.fn(async () => false) });
    await expect(deliverFile('a.pdf', 'AAA=', 'application/pdf', d)).resolves.toBe('share');
    expect(d.saveWithPanel).not.toHaveBeenCalled();
  });

  it('does not ask whether it is a Mac on Android', async () => {
    const d = deps();
    await deliverFile('a.pdf', 'AAA=', 'application/pdf', d);
    expect(d.isMac).not.toHaveBeenCalled();
  });

  it('passes a cancelled Save panel through, so the caller can treat it as a choice', async () => {
    const d = deps({
      platform: 'ios',
      isMac: vi.fn(async () => true),
      saveWithPanel: vi.fn(async () => {
        throw new ShareCanceledError();
      }),
    });
    await expect(deliverFile('a.pdf', 'AAA=', 'application/pdf', d)).rejects.toBeInstanceOf(
      ShareCanceledError
    );
  });

  it('sanitises the IS-supplied filename before it reaches a native save', async () => {
    const d = deps();
    await deliverFile('../../databases/reis.db', 'AAA=', 'application/pdf', d);
    expect(d.saveToDownloads).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'reis.db' })
    );
  });

  it('sanitises on the share path too', async () => {
    const d = deps({ platform: 'ios' });
    await deliverFile('sub/dir/x.pdf', 'AAA=', 'application/pdf', d);
    expect(d.shareFile).toHaveBeenCalledWith(expect.objectContaining({ filename: 'x.pdf' }));
  });

  it('propagates a save failure instead of reporting a phantom success', async () => {
    const d = deps({
      saveToDownloads: vi.fn(async () => {
        throw new Error('no Downloads entry');
      }),
    });
    await expect(deliverFile('a.pdf', 'AAA=', 'application/pdf', d)).rejects.toThrow(
      /no Downloads entry/
    );
  });
});
