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
 * signed-in IS page, with the things that make one too wide and one table for
 * each treatment the script gives (exam rows, cards, attendance, shrink to fit,
 * a wrapping filter form, and the one that still scrolls sideways). It is served to
 * the browser as an is.mendelu.cz URL (the script acts on that host only) and
 * every other request is refused, so this never contacts IS.
 */
import { chromium, type Page } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPhoneFrameScript, PHONE_FRAME_STYLE_ID } from '../src/mobile/isPhoneFrame';
import { findCrushedText, findOverlaps } from './lib/phoneOverlaps.mjs';
import { problems, type Facts } from './lib/phoneFrameProblems';

const HERE = dirname(fileURLToPath(import.meta.url));
const part = (name: string) => readFileSync(resolve(HERE, 'fixtures', name), 'utf8');
/** The page shell with its two table fixtures put in (three files, each short enough to read). */
const FIXTURE = part('isPhoneFrame.html')
  .replace(
    /<!-- TABLES:[^>]*-->/,
    () => part('isPhoneFrameTablesRead.html') + part('isPhoneFrameTablesRest.html')
  )
  .replace(/\/\* ICONS:[^*]*\*\//, () => part('isPhoneFrameIcons.css'));
if (
  !FIXTURE.includes('data-expect') ||
  !FIXTURE.includes("svg[data-size-sysid='decorator']") ||
  FIXTURE.includes('/* ICONS:')
)
  throw new Error('check:phone-frame: the table or icon fixtures were not inserted');
const URL_ON_IS = 'https://is.mendelu.cz/auth/reis-phone-frame-fixture';
/** The widths the app claims to support. Same three `scripts/shot.ts` uses. */
const WIDTHS = [320, 390, 430];

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
    const shown = (el: Element) => el.getBoundingClientRect().width > 0;
    const past = (el: Element) => shown(el) && el.getBoundingClientRect().right > width + 1;
    const tables = [...document.querySelectorAll<HTMLElement>('table[data-expect]')].map((t) => {
      const overflowX = getComputedStyle(t).overflowX;
      const needs = t.scrollWidth > t.clientWidth + 1;
      const cellsPastEdge = [...t.querySelectorAll('td, th')].filter(past).length;
      const last = t.querySelector('#last-column');
      let reachable = true;
      if (last) {
        t.scrollLeft = t.scrollWidth;
        const cell = last.getBoundingClientRect();
        reachable =
          cell.width > 0 &&
          cell.right <= t.getBoundingClientRect().right + 1 &&
          cell.right <= width + 1;
        t.scrollLeft = 0;
      }
      return {
        id: t.id,
        expect: t.dataset['expect'] ?? '',
        classes: t.className,
        needsSidewaysScroll: needs,
        // `hidden` would pass the size test and scroll from script, but not by touch.
        scrollsByTouch: needs && (overflowX === 'auto' || overflowX === 'scroll'),
        cellsPastEdge,
        lastColumnReachable: reachable,
      };
    });
    const register = document.getElementById('register')!.getBoundingClientRect();
    return {
      styled: !!document.getElementById(id),
      layoutWidth: width,
      pageScrollWidth: document.documentElement.scrollWidth,
      stickingOut: [...document.querySelectorAll('body *')]
        .filter((el) => past(el) && !inScrollBox(el))
        .map(name),
      controlsPastEdge: [...document.querySelectorAll('input, select, textarea, button')]
        .filter(past)
        .map(name),
      tables,
      registerVisible: register.width > 0 && register.right <= width + 1,
      examSizes: ['x-predmet', 'x-druh', 'x-datum']
        .map((k) => {
          const cs = getComputedStyle(document.querySelector(`#exam td.${k}`)!);
          return `${k} ${cs.fontSize} pad ${cs.paddingLeft}`;
        })
        .join(', '),
      peopleSizes: (() => {
        const rows = [...document.querySelectorAll('#people tr.reis-person')];
        const photo = document.querySelector('#people td.reis-photo img')?.getBoundingClientRect();
        const tallest = Math.max(...rows.map((r) => r.getBoundingClientRect().height));
        const blanks = [
          ...document.querySelectorAll('#people td.reis-dash, #people td.reis-empty'),
        ];
        const shown = blanks.filter((c) => c.getBoundingClientRect().width > 0).length;
        return `${rows.length} rows, photo ${photo?.width}x${photo?.height}, ${tallest <= 110 ? 'short' : `${tallest}px tall`}, ${shown}/${blanks.length} blanks shown`;
      })(),
    };
  }, styleId);
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
      // The fixture has no overlaps of its own, so any is the phone script's.
      for (const o of await page.evaluate(findOverlaps))
        found.push(`drawn over each other (${o.size}px): ${o.key}`);
      for (const o of await page.evaluate(findCrushedText))
        found.push(`squeezed to a few letters per line: ${o.key}`);
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
