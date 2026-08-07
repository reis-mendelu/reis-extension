import { describe, it, expect } from 'vitest';
import { parseServerFiles } from '../parser';

/**
 * IS changed how it publishes a file's mime type.
 *
 * Captured live from is.mendelu.cz on 2026-08-07 (slozka.pl?ds=1;id=153918):
 * the old `<img sysid="mime-pdf">` is gone entirely — zero `img[sysid]` in the
 * whole document — and the type now rides on a `<span class="uf-icon"
 * data-sysid="mime-pdf">` wrapping an inline SVG. The parser still looked for
 * the old attribute, so every file fell through to 'unknown' and the UI badge
 * rendered "FILE" for a folder of PDFs. Not a mobile bug: the extension parses
 * the same HTML.
 *
 * The trap this pins: a row carries THREE data-sysid values — 'stav-precteno'
 * (read status), 'prohlizeni-info' (a view link) and 'mime-pdf'. A bare
 * `[data-sysid]` selector picks up the first and yields nonsense, so the
 * selector has to be mime-specific.
 */
const row = (name: string, downloadId: string, mime: string) => `
  <tr class=" uis-hl-table lbn">
    <td class="odsazena" align="center" nowrap="1">
      <span class="uf-icon xs" role="img" data-sysid="stav-precteno" data-id="2128"></span>
    </td>
    <td class="odsazena" align="left">${name}</td>
    <td class="odsazena" align="left"></td>
    <td class="odsazena" nowrap="1" align="left"><a href="/auth/lide/clovek.pl?id=118622;lang=cz">J. Gallus</a></td>
    <td class="odsazena" nowrap="1" align="left">30.04.2026</td>
    <td class="odsazena" nowrap="1" align="left">30.04.2026</td>
    <td class="odsazena" align="center">
      <a href="dokumenty_cteni.pl?id=153918;on=0;dok=${downloadId};lang=cz">
        <span class="uf-icon sm" role="img" data-sysid="prohlizeni-info" data-id="1146"></span>
      </a>
    </td>
    <td class="odsazena" align="center" nowrap="1">
      <a href="/auth/dok_server/slozka.pl?download=${downloadId};id=153918;z=1;lang=cz">
        <span class="uf-icon sm" role="img" data-sysid="${mime}" data-id="0" aria-label="${name}"></span>
      </a>
    </td>
  </tr>`;

const folderHtml = `
  <html><body>
    <table>
      <thead><tr><th>St</th><th>Název</th><th>Komentář</th><th>Vložil</th><th>Vloženo</th><th>Změněno</th><th>Info</th><th>Stáhnout</th></tr></thead>
      <tbody>
        ${row('JSON dokumentace', '359058', 'mime-pdf')}
        ${row('Projekt IoT 2026', '359059', 'mime-zip')}
      </tbody>
    </table>
  </body></html>`;

describe('parseServerFiles mime type', () => {
  it('reads the type from the current data-sysid markup', () => {
    const parsed = parseServerFiles(folderHtml);
    const all = parsed.files.flatMap((f) => f.files);
    const byName = (n: string) => all.find((f) => f.name.includes(n) || f.link.includes(n));

    expect(all.length).toBeGreaterThan(0);
    expect(byName('359058')?.type).toBe('pdf');
    expect(byName('359059')?.type).toBe('zip');
  });

  it('never reports a type of unknown when IS published one', () => {
    const parsed = parseServerFiles(folderHtml);
    const types = parsed.files.flatMap((f) => f.files).map((f) => f.type);
    expect(types).not.toContain('unknown');
  });

  /**
   * Each row holds TWO qualifying anchors — IS's view-info link and the real
   * download — and the view link is skipped by recognising its
   * 'prohlizeni-info' icon. A first cut of the data-sysid fix looked only for
   * `mime-` icons, so that link reported no icon at all, dodged the skip, and
   * every file gained a phantom 'unknown' sibling. Only a count catches it.
   */
  it('emits one attachment per file, not a phantom for the view link', () => {
    const parsed = parseServerFiles(folderHtml);
    const all = parsed.files.flatMap((f) => f.files);
    expect(all).toHaveLength(2);
    expect(all.every((f) => f.link.includes('download='))).toBe(true);
  });

  /**
   * The read-status icon comes first in DOM order. If the selector is not
   * mime-specific it wins, and the badge shows "STAV-PRECTENO".
   */
  it('does not mistake the read-status icon for a mime type', () => {
    const parsed = parseServerFiles(folderHtml);
    const types = parsed.files.flatMap((f) => f.files).map((f) => f.type);
    expect(types).not.toContain('stav-precteno');
    expect(types).not.toContain('prohlizeni-info');
  });

  /** The pre-2026-08 markup must keep working — other IS pages may still use it. */
  it('still reads the legacy img[sysid] markup', () => {
    const legacy = `
      <html><body><table>
        <thead><tr><th>Název</th><th>Stáhnout</th></tr></thead>
        <tbody><tr>
          <td>Stará prezentace</td>
          <td><a href="/auth/dok_server/slozka.pl?download=111;id=1;z=1;lang=cz"><img sysid="mime-pptx" /></a></td>
        </tr></tbody>
      </table></body></html>`;
    const parsed = parseServerFiles(legacy);
    const all = parsed.files.flatMap((f) => f.files);
    expect(all.find((f) => f.link.includes('download=111'))?.type).toBe('pptx');
  });
});
