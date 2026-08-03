import { describe, it, expect, vi } from 'vitest';
import { saveBlob, type SaveDeps } from '../saveDocument';

function deps(over: Partial<SaveDeps> = {}): SaveDeps {
  return {
    kind: 'capacitor',
    anchorSave: vi.fn(),
    nativeSave: vi.fn(async () => 'file:///docs/x.pdf'),
    assertExists: vi.fn(async () => true),
    ...over,
  };
}

const blob = new Blob(['x'], { type: 'application/pdf' });

describe('saveBlob', () => {
  it('uses the anchor path on the extension', async () => {
    const d = deps({ kind: 'extension' });
    await saveBlob(blob, 'a.pdf', d);
    expect(d.anchorSave).toHaveBeenCalledWith(blob, 'a.pdf');
    expect(d.nativeSave).not.toHaveBeenCalled();
  });

  it('uses the native path on Capacitor, never the anchor', async () => {
    const d = deps();
    await saveBlob(blob, 'a.pdf', d);
    expect(d.nativeSave).toHaveBeenCalledWith(blob, 'a.pdf');
    expect(d.anchorSave).not.toHaveBeenCalled();
  });

  it('THROWS when the native write reports no file — the silent no-op must not survive', async () => {
    const d = deps({ assertExists: vi.fn(async () => false) });
    await expect(saveBlob(blob, 'a.pdf', d)).rejects.toThrow(/not saved/i);
  });

  it('verifies the exact uri that nativeSave returned', async () => {
    const d = deps({ nativeSave: vi.fn(async () => 'file:///docs/real.pdf') });
    await saveBlob(blob, 'a.pdf', d);
    expect(d.assertExists).toHaveBeenCalledWith('file:///docs/real.pdf');
  });

  it('does not assert existence on the extension path', async () => {
    const d = deps({ kind: 'extension' });
    await saveBlob(blob, 'a.pdf', d);
    expect(d.assertExists).not.toHaveBeenCalled();
  });
});
