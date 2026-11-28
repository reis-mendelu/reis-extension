import { chromium } from 'playwright';

const LOGIN_URL = 'https://is.mendelu.cz/system/login.pl';

/**
 * Signs in to IS Mendelu as the student in `.env` (MENDELU_USER / MENDELU_PASS)
 * in a headless browser and returns the session's Cookie header. Local only:
 * the credentials never leave the laptop and are never in CI. Shared by
 * `scrape:real` and `personas:check`.
 */
export async function isLogin(): Promise<string> {
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
