import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The iOS and Android apps do not pinch-zoom the page; the extension does.
 *
 * In the Capacitor shell a pinch on a plain scrolling screen (Exams, Subjects,
 * Profile) zoomed the whole app, tab bar and all, and left the student stuck
 * in a magnified frame with no browser chrome to reset it. Capacitor's own
 * guards are not enough: on iOS its scroll-view delegate disables the pinch
 * recognizer only once zooming has already begun, and on Android it relies on
 * built-in zoom controls being off. The page has to say it is not scalable, and
 * both WKWebView and Android WebView honour `maximum-scale=1, user-scalable=no`
 * (only Safari ignores it). This also stops iOS auto-zooming into a focused
 * input set below 16px.
 *
 * What still zooms, by design, is unaffected: the Leaflet map, the PDF viewer's
 * JS pinch (`SubjectFileDrawer/usePinchZoom.ts`, which calls preventDefault
 * itself) and the native PdfInk reader. Dynamic Type / system text size is
 * untouched — only the user's pinch on the page goes.
 *
 * The extension is the other half and stays scalable on purpose: it runs in a
 * desktop browser, where zoom is the student's own browser control and taking
 * it away is an accessibility regression with nothing to gain.
 *
 * `viewport-fit=cover` is asserted too. Losing it zeroes every
 * `env(safe-area-inset-*)`, which would put the tab bar under the home
 * indicator and the header under the notch — worse than any zoom.
 */
const root = process.cwd();
const APP_HTML = 'capacitor/index.html';
const EXTENSION_HTML = 'src/entrypoints/main/index.html';

function viewport(file: string): Map<string, string> {
  const html = readFileSync(join(root, file), 'utf-8');
  const meta = html.match(/<meta\s+name="viewport"\s+content="([^"]*)"/);
  expect(meta, `${file} has no viewport meta`).not.toBeNull();
  return new Map(
    meta![1]!
      .split(',')
      .map((pair) => pair.split('=').map((s) => s.trim().toLowerCase()) as [string, string])
  );
}

describe('viewport zoom', () => {
  it('locks pinch zoom in the Capacitor app', () => {
    const vp = viewport(APP_HTML);
    expect(vp.get('width')).toBe('device-width');
    expect(Number(vp.get('initial-scale'))).toBe(1);
    expect(Number(vp.get('maximum-scale'))).toBe(1);
    expect(vp.get('user-scalable')).toBe('no');
    expect(vp.get('viewport-fit')).toBe('cover');
  });

  it('leaves the extension zoomable', () => {
    const vp = viewport(EXTENSION_HTML);
    expect(vp.has('maximum-scale')).toBe(false);
    expect(vp.get('user-scalable')).not.toBe('no');
  });
});
