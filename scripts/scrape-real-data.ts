import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { installNodeRuntime } from './lib/nodeRuntime';
import { isLogin } from './lib/isLogin';
import { firstPages, laterPages, type Page } from './lib/isHtmlPages';

const OUT = resolve(process.cwd(), 'public/dev-real-data.json');
const verbose = process.argv.includes('--verbose');
// `--dump-html` writes the raw IS pages a parser reads, in BOTH languages, so a
// parser change can be made against real markup. CLAUDE.md requires exactly
// that as evidence, and until now there was no way to get it without hand-
// saving pages from a browser. Output is gitignored: it is one student's real
// record, not a fixture — trim by hand before committing anything from it.
//
// Deliberately NOT under public/. Vite copies publicDir into the build output
// verbatim, and stripDevRealDataPlugin only removes `dev-real-data.json` by
// name — so a folder of real study plans parked there would ride into
// dist-web/, which is the directory that gets deployed from a laptop.
const dumpHtml = process.argv.includes('--dump-html');
const HTML_OUT = resolve(process.cwd(), '.is-html');

/**
 * Save the pages the brittle parsers read, one file per language.
 *
 * Uses the same runtime the collectors do, so what lands here is byte-for-byte
 * what the parser was handed — not a browser's re-serialised DOM.
 */
async function dumpRawHtml() {
  const { getUserParams } = await import('@/utils/userParams');
  const { fetchWithAuth, BASE_URL } = await import('@/api/client');
  const params = await getUserParams();
  const studium = params?.studium;
  if (!studium) {
    process.stderr.write('[dump] no studium in userParams — skipping HTML dump\n');
    return;
  }
  mkdirSync(HTML_OUT, { recursive: true });
  const ids = { studium, obdobi: params.obdobi ?? '', studentId: params.studentId ?? '' };
  const dumped = new Map<string, string>();
  const save = async (pages: Page[]) => {
    for (const [name, base] of pages) {
      for (const lang of ['cz', 'en']) {
        const res = await fetchWithAuth(`${base}${base.includes('?') ? ';' : '?'}lang=${lang}`);
        const html = await res.text();
        if (lang === 'cz') dumped.set(name, html);
        const file = resolve(HTML_OUT, `${name}.${lang}.html`);
        writeFileSync(file, html);
        process.stderr.write(`[dump] ${file} (${html.length} bytes)\n`);
      }
    }
  };
  await save(firstPages(BASE_URL, ids));
  for (let next = laterPages(BASE_URL, ids, dumped); next.length;) {
    await save(next);
    next = laterPages(BASE_URL, ids, dumped);
  }
}

async function main() {
  const startedAt = Date.now();
  process.stderr.write('[scrape] logging in…\n');
  const cookieHeader = await isLogin();
  process.stderr.write('[scrape] session acquired, collecting data…\n');
  await installNodeRuntime(cookieHeader);
  if (dumpHtml) await dumpRawHtml();
  const { collectRealData } = await import('./lib/collectRealData');
  const data = await collectRealData();
  mkdirSync(resolve(process.cwd(), 'public'), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data));
  const counts = {
    schedule: Array.isArray(data.schedule) ? data.schedule.length : 0,
    exams: Array.isArray(data.exams) ? data.exams.length : 0,
    subjects:
      data.subjects && typeof data.subjects === 'object'
        ? Object.keys((data.subjects as { data?: object }).data ?? {}).length
        : 0,
    files: Object.keys((data.files as object) ?? {}).length,
  };
  const secs = ((Date.now() - startedAt) / 1000).toFixed(0);

  // Every section is collected under allSettled, so a fault that hits all of
  // them (a lapsed session, a missing platform, an IS redesign) still reaches
  // here with an empty payload. Reporting that as ✅ is how a broken scrape gets
  // mistaken for "IS had nothing" — and the snapshot it overwrites was the only
  // real data on the machine. Refuse instead.
  if (Object.values(counts).every((n) => n === 0)) {
    process.stderr.write(
      `\n❌ scrape:real collected NOTHING in ${secs}s — ${JSON.stringify(counts)}\n` +
        '   The snapshot was written but is empty, so the UI will show empty states.\n' +
        '   Check the [reIS:error] lines above: a lapsed session and an uninstalled\n' +
        '   platform both fail this way, per-section and silently.\n'
    );
    process.exit(1);
  }

  process.stdout.write(`\n✅ Wrote ${OUT} in ${secs}s\n   ${JSON.stringify(counts)}\n`);
  process.stdout.write(
    '   Next: npm run dev:web  →  open http://localhost:3000 (real data renders)\n'
  );
  if (verbose) process.stdout.write(`\n${JSON.stringify(data, null, 2).slice(0, 2000)}\n`);

  // The app's fetchers keep Node's HTTP keep-alive sockets (and happy-dom timers)
  // alive, so the event loop never drains on its own — exit explicitly once the
  // snapshot is safely written.
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write(`\n❌ scrape:real failed: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
