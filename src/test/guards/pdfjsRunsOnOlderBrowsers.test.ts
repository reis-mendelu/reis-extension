import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pdfjsLegacyAliases } from '../../../scripts/pdfjsLegacyAlias';

// pdf.js 6 (reIS 5.3.0 onwards) calls Map.prototype.getOrInsertComputed and
// Math.sumPrecise without a guard. Chromium 143 has neither: every PDF opened in
// the side pane died in getDocument and react-pdf printed "Failed to load PDF
// file." (Windows Vivaldi report, 2026-10-21). The legacy build polyfills them,
// so the app builds alias react-pdf's pdf.js imports to it. This runs the build
// those aliases select, worker included, in a clean Node with the APIs removed.
const ROOT = resolve(__dirname, '../../..');
const require = createRequire(import.meta.url);

// What react-pdf imports (node_modules/react-pdf/dist: index/Document → the
// bare package, LinkService → the viewer), as the app's bundler will see them.
const REACT_PDF_IMPORTS = ['pdfjs-dist', 'pdfjs-dist/web/pdf_viewer.mjs'];

function throughAliases(specifier: string): string {
  const alias = pdfjsLegacyAliases.find((a) => a.find.test(specifier));
  return alias ? specifier.replace(alias.find, alias.replacement) : specifier;
}

function workerSpecifier(): string {
  const src = readFileSync(resolve(ROOT, 'src/components/SubjectFileDrawer/pdfWorkerSource.ts'), 'utf8');
  const m = src.match(/from '(pdfjs-dist\/[^'?]+)\?url'/);
  if (!m?.[1]) throw new Error('pdfWorkerSource.ts no longer imports a pdf.js worker URL');
  return m[1];
}

const fileUrl = (specifier: string) => pathToFileURL(require.resolve(specifier)).href;

// A one-page PDF with a line of text, xref offsets computed.
const MINIMAL_PDF = (() => {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length 41 >>\nstream\nBT /F1 12 Tf 20 100 Td (Management) Tj ET\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((o, i) => {
    const at = body.length;
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return body;
})();

describe('the pdf.js the app ships', () => {
  it('opens a PDF in a browser without getOrInsertComputed and sumPrecise (Chromium 143)', () => {
    // The viewer module touches `document` on import, so Node cannot load it;
    // the alias test below keeps it on the same build as this one.
    const main = fileUrl(throughAliases('pdfjs-dist'));
    const worker = fileUrl(workerSpecifier());
    // By URL, as the viewer gets it (a blob URL): the loader that path takes
    // is where getOrInsertComputed is first called. getOperatorList is the
    // render path, which calls it again on the main thread.
    const dir = mkdtempSync(join(tmpdir(), 'reis-pdfjs-'));
    const pdf = join(dir, 'doc.pdf');
    writeFileSync(pdf, MINIMAL_PDF);
    const script = `
      delete Map.prototype.getOrInsert;
      delete Map.prototype.getOrInsertComputed;
      delete WeakMap.prototype.getOrInsert;
      delete WeakMap.prototype.getOrInsertComputed;
      delete Math.sumPrecise;
      const pdfjs = await import(${JSON.stringify(main)});
      pdfjs.GlobalWorkerOptions.workerSrc = ${JSON.stringify(worker)};
      const doc = await pdfjs.getDocument({ url: ${JSON.stringify(pathToFileURL(pdf).href)} }).promise;
      const page = await doc.getPage(1);
      await page.getOperatorList();
      const text = await page.getTextContent();
      console.log(JSON.stringify({ pages: doc.numPages, text: text.items.map((i) => i.str).join('') }));
    `;
    let out: string;
    try {
      out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      throw new Error(String((e as { stderr?: string }).stderr || e));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(JSON.parse(out.trim().split('\n').pop() ?? '')).toEqual({ pages: 1, text: 'Management' });
  }, 30_000);

  it('keeps the worker on the same build as the API', () => {
    // A modern worker under the legacy API fails the same way: the worker
    // calls the missing methods itself.
    expect(workerSpecifier()).toMatch(/^pdfjs-dist\/legacy\//);
    expect(REACT_PDF_IMPORTS.map(throughAliases)).toEqual([
      'pdfjs-dist/legacy/build/pdf.mjs',
      'pdfjs-dist/legacy/web/pdf_viewer.mjs',
    ]);
  });

  it.each(['wxt.config.ts', 'vite.capacitor.config.ts', 'vite.web.config.ts'])(
    '%s applies the legacy aliases',
    (config) => {
      expect(readFileSync(resolve(ROOT, config), 'utf8')).toMatch(/\.\.\.pdfjsLegacyAliases\b/);
    }
  );
});
