import { describe, it, expect, vi, beforeEach } from 'vitest';
import { memFs } from './memPdfCacheFs';
import { serveFile } from '../pdfInkFiles';
import { pdfPath } from '../pdfCache';
import { logError } from '../../utils/reportError';

vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

const FILE = { link: 'slozka.pl?download=2', name: 'B', date: '1. 10. 2026' };

function deps() {
  const { fs, files } = memFs();
  return {
    files,
    deps: {
      fs,
      inkUri: async (key: string) => `file:///ink/${key}`,
      keyFor: async (link: string) => `key-${link.length}`,
      courseCode: 'EBC-MNG',
      now: () => 0,
    },
  };
}

/**
 * A sidebar file that cannot be served makes the reader show "Soubor se
 * nepodařilo otevřít" in its place — and suggestion #32 (iPad, 16 Oct) reported
 * exactly that with nothing to go on. The miss has to reach the diagnostic log
 * a report can attach, or the next such report is as blind as that one.
 */
describe('serveFile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('leaves a diagnostic when there is neither a fetch nor a copy', async () => {
    const { deps: d } = deps();
    await expect(serveFile(d, FILE, async () => null)).resolves.toEqual({ kind: 'unavailable' });
    expect(logError).toHaveBeenCalledWith('PdfInk.serveFile', expect.any(Error));
  });

  it('says nothing when a cached copy stands in', async () => {
    const { deps: d, files } = deps();
    files.set(pdfPath(await d.keyFor(FILE.link)), { base64: 'JVBERg==', size: 6 });
    await expect(serveFile(d, FILE, async () => null)).resolves.toMatchObject({
      kind: 'delivered',
    });
    expect(logError).not.toHaveBeenCalled();
  });
});
