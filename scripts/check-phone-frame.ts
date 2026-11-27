/**
 * Lays an IS-shaped page out in a real browser at phone widths, with the script
 * the in-app browser injects (src/mobile/isPhoneFrame.ts), and fails when the
 * page does not fit.
 *
 *   npm run check:phone-frame      # no credentials, no network, runs in CI
 *
 * Why this exists: the unit tests run in happy-dom, which has no layout. They
 * prove the stylesheet is inserted, not what it does. The first sweep over
 * real IS pages (2026-11-27) found files folders scrolling sideways at 320 px
 * because an icon row and the paginator did not wrap; nothing in the unit
 * tests could have seen that.
 *
 * The page is `scripts/fixtures/isPhoneFrame.html`: made up, in the shape of a
 * signed-in IS page, with the things that make one too wide. It is served to
 * the browser as an is.mendelu.cz URL (the script acts on that host only) and
 * every other request is refused, so this never contacts IS.
 */
import { chromium, type Page } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPhoneFrameScript, PHONE_FRAME_STYLE_ID } from '../src/mobile/isPhoneFrame';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(resolve(HERE, 'fixtures/isPhoneFrame.html'), 'utf8');
const URL_ON_IS = 'https://is.mendelu.cz/auth/reis-phone-frame-fixture';
/** The widths the app claims to support. Same three `scripts/shot.ts` uses. */
const WIDTHS = [320, 390, 430];

interface Facts {
  styled: boolean;
  layoutWidth: number;
  pageScrollWidth: number;
  /** Elements wider than the page that are not inside a box that scrolls. */
  stickingOut: string[];
  /** Form controls whose right edge is past the page's. */
  controlsPastEdge: string[];
  tableScrollsInside: boolean;
  lastColumnReachable: boolean;
}

async function gather(page: Page, styleId: string): Promise<Facts> {
  return page.evaluate((id) => {
    const width = document.documentElement.clientWidth;
    const name = (el: Element) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '');
    const inScrollBox = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll') return true;
      }
      return false;
    };
    const past = (el: Element) => el.getBoundingClientRect().right > width + 1;
    const table = document.getElementById('wide')!;
    const scrolls = table.scrollWidth > table.clientWidth + 1;
    table.scrollLeft = table.scrollWidth;
    const last = document.getElementById('last-column')!.getBoundingClientRect();
    const box = table.getBoundingClientRect();
    const facts = {
      styled: !!document.getElementById(id),
      layoutWidth: width,
      pageScrollWidth: document.documentElement.scrollWidth,
      stickingOut: [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().width > 0 && past(el) && !inScrollBox(el))
        .map(name),
      controlsPastEdge: [...document.querySelectorAll('input, select, textarea, button')]
        .filter(past)
        .map(name),
      tableScrollsInside: scrolls,
      lastColumnReachable: last.width > 0 && last.right <= box.right + 1 && last.right <= width + 1,
    };
    table.scrollLeft = 0;
    return facts;
  }, styleId);
}

function problems(width: number, f: Facts): string[] {
  const out: string[] = [];
  if (!f.styled) out.push('the frame stylesheet was not applied');
  if (f.layoutWidth !== width) out.push(`laid out ${f.layoutWidth}px wide, not ${width}px`);
  if (f.pageScrollWidth > width) out.push(`the page scrolls sideways (${f.pageScrollWidth}px)`);
  if (f.stickingOut.length) out.push(`sticking out of the page: ${f.stickingOut.join(', ')}`);
  if (f.controlsPastEdge.length)
    out.push(`form controls past the edge: ${f.controlsPastEdge.join(', ')}`);
  if (!f.tableScrollsInside) out.push('the wide table does not scroll inside its own box');
  if (!f.lastColumnReachable) out.push('the last table column cannot be scrolled into view');
  return out;
}

async function main() {
  const browser = await chromium.launch();
  let failed = false;
  try {
    for (const width of WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      // tsx (esbuild, keepNames) wraps the named functions in `gather` in a
      // `__name(...)` helper that does not exist in the page. Same shim
      // scripts/check-app.ts installs. String form: it must not be rewritten.
      await context.addInitScript({
        content: 'globalThis.__name = globalThis.__name || ((f) => f);',
      });
      await context.addInitScript(buildPhoneFrameScript());
      const page = await context.newPage();
      await page.route('**/*', (route) =>
        route.request().url() === URL_ON_IS
          ? route.fulfill({ contentType: 'text/html; charset=UTF-8', body: FIXTURE })
          : route.abort()
      );
      await page.goto(URL_ON_IS, { waitUntil: 'load' });
      const found = problems(width, await gather(page, PHONE_FRAME_STYLE_ID));
      failed ||= found.length > 0;
      process.stdout.write(
        found.length
          ? `FAIL ${width}px\n${found.map((p) => `  - ${p}`).join('\n')}\n`
          : `ok   ${width}px\n`
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
  process.stdout.write(`check:phone-frame: ${failed ? 'FAIL' : 'PASS'}\n`);
  process.exit(failed ? 1 : 0);
}

void main();
