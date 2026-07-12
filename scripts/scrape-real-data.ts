import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { installNodeRuntime } from './lib/nodeRuntime';

const LOGIN_URL = 'https://is.mendelu.cz/system/login.pl';
const OUT = resolve(process.cwd(), 'public/.dev-real-data.json');
const verbose = process.argv.includes('--verbose');

async function login(): Promise<string> {
  const user = process.env.MENDELU_USER;
  const pass = process.env.MENDELU_PASS;
  if (!user || !pass) {
    throw new Error('Missing MENDELU_USER / MENDELU_PASS in .env');
  }
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="credential_0"]', user);
    await page.fill('input[name="credential_1"]', pass);
    await Promise.all([
      page
        .waitForURL('**/auth/**', { timeout: 30_000 })
        .catch(() => page.waitForLoadState('networkidle')),
      page.press('input[name="credential_1"]', 'Enter'),
    ]);
    const cookies = await context.cookies('https://is.mendelu.cz');
    if (!cookies.length) throw new Error('Login produced no cookies — check credentials');
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  } finally {
    await browser.close();
  }
}

async function main() {
  process.stderr.write('[scrape] logging in…\n');
  const cookieHeader = await login();
  process.stderr.write('[scrape] session acquired, collecting data…\n');
  await installNodeRuntime(cookieHeader);
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
  process.stdout.write(`\n✅ Wrote ${OUT}\n   ${JSON.stringify(counts)}\n`);
  process.stdout.write('   Now run: npm run dev  →  open http://localhost:3000/main.html\n');
  if (verbose) process.stdout.write(`\n${JSON.stringify(data, null, 2).slice(0, 2000)}\n`);
}

main().catch((e) => {
  process.stderr.write(
    `\n❌ scrape:real failed: ${e instanceof Error ? e.message : String(e)}\n`
  );
  process.exit(1);
});
