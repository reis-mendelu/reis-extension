/**
 * Screenshot + measure the reIS webapp at fixed mobile widths, and assert the
 * things that eyes and stale preview frames get wrong: horizontal overflow,
 * colliding text, and surfaces/text that are invisible against their backdrop.
 *
 *   npm run verify:ui -- exams-rail --view exams
 *   npm run verify:ui -- drawer --view subjects --click "EBC-IV" --theme light
 *
 * Conventions exist so results are comparable between runs and can't go stale:
 *   - widths are always 320 / 390 / 430 unless overridden
 *   - output always lands in .verify/ (gitignored), WIPED at the start of a run
 *   - the view is seeded into IndexedDB, never clicked — clicking a nav tab and
 *     screenshotting the result is how a hidden preview pane lies to you
 *   - every written path is printed absolute, so there is no "wrong out dir"
 *
 * Requires `npm run dev:web` to be serving on :3000.
 */

import { chromium, type Page } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeProbe, type Finding, type ProbeResult } from './lib/uiFindings';

const DEFAULT_WIDTHS = [320, 390, 430];
const DEFAULT_URL = 'http://localhost:3000';
const OUT_DIR = resolve(process.cwd(), '.verify');
const VIEWPORT_HEIGHT = 844;

interface Options {
  label: string;
  url: string;
  widths: number[];
  view?: string;
  theme?: string;
  click?: string;
  wait: number;
  onboarding: boolean;
}

function parseArgs(argv: string[]): Options {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      // Boolean flags take no value — don't swallow the next argument.
      const next = argv[i + 1];
      flags.set(a.slice(2), next === undefined || next.startsWith('--') ? '' : argv[++i]!);
    } else positional.push(a);
  }
  const label = positional[0];
  if (!label) {
    console.error('usage: npm run verify:ui -- <label> [--view exams] [--theme dark] [--click TEXT]');
    process.exit(2);
  }
  const widths = flags.get('widths')?.split(',').map(Number).filter(Boolean) ?? DEFAULT_WIDTHS;
  return {
    label,
    url: flags.get('url') ?? DEFAULT_URL,
    widths,
    view: flags.get('view'),
    theme: flags.get('theme'),
    click: flags.get('click'),
    wait: Number(flags.get('wait') ?? 600),
    onboarding: flags.has('onboarding'),
  };
}

/** Write a value into the app's `meta` IndexedDB store, then reload so the app
 *  boots with it. Deterministic where a nav click is not. */
async function seedMeta(page: Page, entries: Record<string, unknown>): Promise<void> {
  if (Object.keys(entries).length === 0) return;
  await page.evaluate(async (kv) => {
    await new Promise<void>((done) => {
      const req = indexedDB.open('reis_db');
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('meta')) return done();
        const tx = db.transaction('meta', 'readwrite');
        const store = tx.objectStore('meta');
        for (const [k, v] of Object.entries(kv)) store.put(v, k);
        tx.oncomplete = () => done();
        tx.onerror = () => done();
      };
      req.onerror = () => done();
    });
  }, entries);
  await page.reload({ waitUntil: 'networkidle' });
}

/** Collect raw numbers only — rects, resolved RGBA, font metrics. Every
 *  threshold and judgement lives in the tested `uiFindings` module. */
function probeSource(): ProbeResult {
  const MAX_ELEMENTS = 1500;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Resolve any CSS colour the browser understands — including the oklch()
  // that Tailwind 4 / DaisyUI 5 emit and getComputedStyle returns verbatim.
  const colorCache = new Map<string, { r: number; g: number; b: number; a: number } | null>();
  function resolveColor(css: string) {
    if (!css) return null;
    const hit = colorCache.get(css);
    if (hit !== undefined) return hit;
    let out: { r: number; g: number; b: number; a: number } | null = null;
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      out = { r: d[0]!, g: d[1]!, b: d[2]!, a: d[3]! / 255 };
    } catch {
      out = null;
    }
    colorCache.set(css, out);
    return out;
  }

  const nodes: HTMLElement[] = [];
  const indexOf = new Map<HTMLElement, number>();
  for (const node of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
    if (nodes.length >= MAX_ELEMENTS) break;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
    const r = node.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    // Occlusion test: anything a modal/overlay covers is not on screen, and
    // measuring it produces findings about a page the user cannot see.
    const hit = document.elementFromPoint(
      Math.min(Math.max(r.x + r.width / 2, 0), window.innerWidth - 1),
      Math.min(Math.max(r.y + r.height / 2, 0), window.innerHeight - 1)
    );
    if (!hit || (hit !== node && !node.contains(hit) && !hit.contains(node))) continue;
    indexOf.set(node, nodes.length);
    nodes.push(node);
  }

  const describe = (node: HTMLElement) => {
    const cls = Array.from(node.classList).slice(0, 2).join('.');
    return (node.tagName.toLowerCase() + (cls ? `.${cls}` : '')).slice(0, 60);
  };

  const elements = nodes.map((node, idx) => {
    const style = getComputedStyle(node);
    const r = node.getBoundingClientRect();

    const bgChain: { r: number; g: number; b: number; a: number }[] = [];
    const ancestors: number[] = [];
    for (let p = node.parentElement; p; p = p.parentElement) {
      const known = indexOf.get(p);
      if (known !== undefined) ancestors.push(known);
      const c = resolveColor(getComputedStyle(p).backgroundColor);
      if (c) bgChain.push(c);
      if (c && c.a >= 1) break; // fully opaque backdrop — nothing below matters
    }

    const hasDirectText = Array.from(node.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0
    );

    return {
      idx,
      ancestors,
      sel: describe(node),
      text: hasDirectText ? (node.textContent ?? '').trim().slice(0, 40) : '',
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      bg: resolveColor(style.backgroundColor),
      bgChain,
      color: resolveColor(style.color),
      fontSize: parseFloat(style.fontSize) || 16,
      fontWeight: parseInt(style.fontWeight, 10) || 400,
      hasDirectText,
    };
  });

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    elements,
  };
}

async function run(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2));

  // Wipe first: reading a PNG left over from an earlier run is the exact failure
  // this script exists to prevent.
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const report: Record<string, { shot: string; findings: Finding[] }> = {};
  let errorCount = 0;

  try {
    for (const width of opts.widths) {
      const context = await browser.newContext({
        viewport: { width, height: VIEWPORT_HEIGHT },
        deviceScaleFactor: 2,
        colorScheme: opts.theme === 'light' ? 'light' : 'dark',
      });
      const page = await context.newPage();
      // tsx compiles with esbuild's keepNames, which wraps functions in a
      // `__name(...)` helper. Playwright serialises `probeSource` by source
      // text, so that helper has to exist in the page or the probe dies with
      // "__name is not defined". String form: this shim must not be rewritten.
      await page.addInitScript({
        content: 'globalThis.__name = globalThis.__name || ((f) => f);',
      });
      const consoleErrors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

      await page.goto(opts.url, { waitUntil: 'networkidle' });
      // Dismiss onboarding by default — otherwise every run screenshots the
      // welcome modal and measures the blurred page behind it.
      const seed: Record<string, unknown> = opts.onboarding ? {} : { welcome_dismissed: true };
      if (opts.view) seed['reis_current_view'] = opts.view;
      if (opts.theme) seed['reis_theme'] = opts.theme;
      await seedMeta(page, seed);

      if (opts.click) {
        await page.getByText(opts.click, { exact: false }).first().click();
      }
      await page.waitForTimeout(opts.wait);

      const shot = resolve(OUT_DIR, `${opts.label}-${width}.png`);
      await page.screenshot({ path: shot, fullPage: false });

      const probe = (await page.evaluate(probeSource)) as ProbeResult;
      const findings = analyzeProbe(probe);
      errorCount += findings.filter((f) => f.severity === 'error').length;
      report[String(width)] = { shot, findings };

      console.log(`\n\x1b[1m${width}px\x1b[0m  ${shot}`);
      if (consoleErrors.length) {
        console.log(`  \x1b[31mconsole:\x1b[0m ${consoleErrors.length} error(s)`);
        for (const e of consoleErrors.slice(0, 3)) console.log(`    ${e.slice(0, 160)}`);
      }
      if (findings.length === 0) {
        console.log('  \x1b[32mno layout or contrast findings\x1b[0m');
      }
      for (const f of findings) {
        const tag = f.severity === 'error' ? '\x1b[31mERROR\x1b[0m' : '\x1b[33mwarn \x1b[0m';
        console.log(`  ${tag} ${f.kind}  ${f.sel}\n        ${f.detail}`);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  const reportPath = resolve(OUT_DIR, `${opts.label}-report.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nreport: ${reportPath}`);
  return errorCount > 0 ? 1 : 0;
}

run().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    console.error('\nIs `npm run dev:web` running on :3000?');
    process.exit(2);
  }
);
