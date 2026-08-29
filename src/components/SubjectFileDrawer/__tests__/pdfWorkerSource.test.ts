import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolvePdfWorkerSource, __resetPdfWorkerForTests } from '../pdfWorkerSource';

// The worker was resolved with a bare `chrome.runtime.getURL(...)`. `chrome` is
// undefined on Capacitor, so on the iPad app that threw before pdf.js could
// start and the inline viewer could never open — which is why the phone/tablet
// file rows went straight to a download instead. The platform seam already
// exposes getAssetUrl for exactly this, so the resolution goes through it.
describe('resolvePdfWorkerSource', () => {
  beforeEach(() => {
    __resetPdfWorkerForTests();
  });

  it('serves the worker from a blob URL built out of the host asset', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ text: () => Promise.resolve('self.onmessage=1') });
    const getAssetUrl = vi.fn().mockReturnValue('/assets/pdf.worker.js');

    const src = await resolvePdfWorkerSource({ getAssetUrl, fetchFn: fetchSpy });

    expect(getAssetUrl).toHaveBeenCalledWith(expect.stringContaining('pdf.worker'));
    expect(fetchSpy).toHaveBeenCalledWith('/assets/pdf.worker.js');
    expect(src).toMatch(/^blob:/);
  });

  it('resolves on a host with no chrome global (Capacitor)', async () => {
    const getAssetUrl = (p: string) => '/' + p.replace(/^\//, '');
    const fetchFn = vi.fn().mockResolvedValue({ text: () => Promise.resolve('worker') });

    await expect(resolvePdfWorkerSource({ getAssetUrl, fetchFn })).resolves.toMatch(/^blob:/);
  });

  it('fetches once and reuses the result across viewers', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ text: () => Promise.resolve('worker') });
    const deps = { getAssetUrl: (p: string) => p, fetchFn };

    const [a, b] = await Promise.all([resolvePdfWorkerSource(deps), resolvePdfWorkerSource(deps)]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('does not cache a failure, so a later viewer can retry', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(
      resolvePdfWorkerSource({ getAssetUrl: (p) => p, fetchFn: failing })
    ).rejects.toThrow();

    const ok = vi.fn().mockResolvedValue({ text: () => Promise.resolve('worker') });
    await expect(resolvePdfWorkerSource({ getAssetUrl: (p) => p, fetchFn: ok })).resolves.toMatch(
      /^blob:/
    );
  });
});
