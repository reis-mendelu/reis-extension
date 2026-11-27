/**
 * WebISKAM for the snapshots: sign in through alibaba (MENDELU's IdP) in a
 * browser with no one at the keyboard, then read a fixed list of pages.
 *
 * The password is typed only into alibaba.mendelu.cz's own form, and once: a
 * rejected password stops the run, so a wrong Keychain entry cannot lock the
 * account. alibaba's consent page needs a person once (`--headed`); the
 * browser profile then remembers it.
 *
 * GET only. The menu's links are recorded as text, never opened: WebISKAM pays
 * from the account on a single request (ZaplatitZKonta, no confirmation).
 */
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import type { Capture } from './archive';
import type { Credentials } from './keychain';

const ISKAM = 'https://webiskam.mendelu.cz';
const ISKAM_HOST = 'webiskam.mendelu.cz';
const IDP_HOST = 'alibaba.mendelu.cz';
const TICKET = '.ISKAMASPXAUTH';
export const BROWSER_PROFILE = resolve(
  homedir(),
  'Library/Application Support/reIS snapshots/browser'
);
const LOGIN_DEADLINE_MS = 60_000;
const CONSENT_WAIT_MS = 180_000;

/** Read every morning. Extend only with pages that show, never ones that act. */
export const WEBISKAM_PAGES = ['/Konta', '/InformaceOKlientovi'];
/** Links the menu record flags: they act, not show. */
export const RISKY_LINK = /zaplat|uhrad|platb|gopay|odhlas|logout|smaz|delete|zrus|storno/i;

type State = 'signed-in' | 'password' | 'consent' | 'two-factor' | 'other';
export type Outcome = 'signed-in' | 'rejected' | 'consent' | 'two-factor' | 'stuck';

export const OUTCOME_TEXT: Record<Exclude<Outcome, 'signed-in'>, string> = {
  rejected: 'alibaba rejected the login in the Keychain ("reIS snapshots"); not retried',
  consent: 'alibaba wants consent first: run `npm run snapshots -- --headed` once and accept it',
  'two-factor': 'alibaba asks for a second factor, which an unattended run cannot pass',
  stuck: `no WebISKAM login within ${LOGIN_DEADLINE_MS / 1000} s`,
};

const hostOf = (page: Page) => new URL(page.url()).hostname;

async function stateOf(page: Page, context: BrowserContext): Promise<State> {
  const host = hostOf(page);
  if (host === ISKAM_HOST) {
    const cookies = await context.cookies(`${ISKAM}/`);
    return cookies.some((c) => c.name === TICKET) ? 'signed-in' : 'other';
  }
  if (host !== IDP_HOST) return 'other';
  if (await page.locator('input[type="password"]').count()) return 'password';
  const html = await page.content();
  if (/_shib_idp_consent/i.test(html)) return 'consent';
  if (/otp|totp|two-?factor|dvoufáz|ověřovací kód/i.test(html)) return 'two-factor';
  return 'other';
}

async function typePassword(page: Page, creds: Credentials): Promise<void> {
  // The password goes to the IdP and nowhere else.
  if (hostOf(page) !== IDP_HOST)
    throw new Error(`refusing to type the password on ${hostOf(page)}`);
  const form = page.locator('form:has(input[type="password"])').first();
  const user = form
    .locator('input[name="j_username"], input[type="text"], input[type="email"]')
    .first();
  const pass = form.locator('input[type="password"]').first();
  await user.fill(creds.user);
  await pass.fill(creds.pass);
  await Promise.all([
    page.waitForNavigation({ timeout: 30_000 }).catch(() => undefined),
    pass.press('Enter'),
  ]);
}

async function signIn(
  page: Page,
  context: BrowserContext,
  creds: Credentials,
  headed: boolean
): Promise<Outcome> {
  await page.goto(`${ISKAM}/Prihlaseni/AuthShibb`, { waitUntil: 'domcontentloaded' });
  let typed = false;
  const deadline = Date.now() + LOGIN_DEADLINE_MS;
  while (Date.now() < deadline) {
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    const state = await stateOf(page, context);
    if (state === 'signed-in' || state === 'two-factor') return state;
    if (state === 'password') {
      if (typed) return 'rejected';
      await typePassword(page, creds);
      typed = true;
      continue;
    }
    if (state === 'consent') {
      if (!headed) return 'consent';
      process.stdout.write(
        'alibaba asks which details to give WebISKAM: accept it in the window.\n'
      );
      await page
        .waitForURL((u) => u.hostname !== IDP_HOST, { timeout: CONSENT_WAIT_MS })
        .catch(() => undefined);
      continue;
    }
    await page.waitForTimeout(1_000);
  }
  return 'stuck';
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** The menu as a page of its own, so a new menu item shows up in changes.md. */
async function menuCapture(page: Page): Promise<Capture> {
  const anchors = await page.$$eval('a[href]', (as) =>
    as.map((a) => ({
      text: (a.textContent ?? '').replace(/\s+/g, ' ').trim(),
      href: a.getAttribute('href') ?? '',
    }))
  );
  const rows = new Map<string, string>();
  for (const { text, href } of anchors) {
    let url: URL;
    try {
      url = new URL(href, `${ISKAM}/`);
    } catch {
      continue;
    }
    if (url.hostname !== ISKAM_HOST) continue;
    const key = url.pathname + url.search;
    if (!rows.has(key))
      rows.set(
        key,
        `<li>${escape(key)}\t${escape(text)}${RISKY_LINK.test(key + text) ? '\t(acts: never opened)' : ''}</li>`
      );
  }
  return { key: 'webiskam/_menu', html: `<ul>${[...rows.values()].sort().join('')}</ul>` };
}

/** Signs in and reads WEBISKAM_PAGES. Throws only on a browser fault. */
export async function readWebiskam(
  creds: Credentials,
  headed: boolean
): Promise<{ captures: Capture[]; problem: string | null }> {
  mkdirSync(BROWSER_PROFILE, { recursive: true });
  const context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
    headless: !headed,
    locale: 'cs-CZ',
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const outcome = await signIn(page, context, creds, headed);
    if (outcome !== 'signed-in')
      return { captures: [], problem: `WebISKAM: ${OUTCOME_TEXT[outcome]}` };
    const captures: Capture[] = [];
    let menu: Capture | null = null;
    for (const path of WEBISKAM_PAGES) {
      const res = await page.goto(`${ISKAM}${path}`, { waitUntil: 'domcontentloaded' });
      if (hostOf(page) !== ISKAM_HOST || !res || res.status() !== 200) {
        return {
          captures,
          problem: `WebISKAM: ${path} did not load (HTTP ${res?.status() ?? '?'})`,
        };
      }
      captures.push({ key: `webiskam${path}`, html: await res.text() });
      menu ??= await menuCapture(page);
    }
    if (menu) captures.push(menu);
    return { captures, problem: null };
  } finally {
    await context.close();
  }
}
