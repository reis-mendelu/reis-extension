/**
 * The icon sysid within `scope`, across both markups IS has served, preferring
 * the mime icon over any other.
 *
 * On 2026-08-07 a live fetch of `slozka.pl?ds=1;id=153918` contained ZERO
 * `img[sysid]` elements: IS had replaced `<img sysid="mime-pdf">` with
 * `<span class="uf-icon" data-sysid="mime-pdf">` wrapping an inline SVG. Every
 * file therefore parsed as 'unknown' and the UI badge read "FILE" for a folder
 * of PDFs.
 *
 * Two orderings matter, and both are load-bearing:
 *  - mime FIRST, because a row also carries 'stav-precteno' (read status) and
 *    'prohlizeni-info', and the read-status icon comes earlier in DOM order.
 *  - a non-mime data-sysid STILL returned when there is no mime icon, because
 *    callers below identify IS's view-info link by its 'prohlizeni-info' icon
 *    and skip it. Returning '' there let that link through as a phantom
 *    'unknown' attachment beside every real file.
 *
 * The legacy branch stays: only slozka.pl was re-verified, and other IS pages
 * may still serve the old markup.
 *
 * Lives in its own file rather than inside parser.ts: that parser is brittle and
 * load-bearing, and keeping this beside it means a markup change is reviewed on
 * its own instead of buried in a 250-line diff.
 */
export function iconSysid(scope: Element | null | undefined): string {
  if (!scope) return '';
  const mime = scope.querySelector('[data-sysid^="mime-"]')?.getAttribute('data-sysid');
  if (mime) return mime;
  const anyModern = scope.querySelector('[data-sysid]')?.getAttribute('data-sysid');
  if (anyModern) return anyModern;
  return scope.querySelector('img[sysid]')?.getAttribute('sysid') || '';
}
