import { describe, it, expect, vi } from 'vitest';
import { deliverFile, deliveryKindFor, type DeliverDeps } from '../deliverFile';

function deps(over: Partial<DeliverDeps> = {}): DeliverDeps {
  return {
    platform: 'android',
    saveToDownloads: vi.fn(async () => ({ uri: 'content://downloads/1' })),
    shareFile: vi.fn(async () => {}),
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
