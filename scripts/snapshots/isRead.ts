/**
 * IS for the snapshots: the browserless login reIS for Claude uses
 * (mcp/login.ts), then the app's own fetchWithAuth for each page on the fixed
 * list, one page a second. Czech only: the English pages say the same.
 *
 * A page that does not come back as an IS page (no main column: a login
 * form, an error page) is reported, not saved, so a lapsed session is never
 * mistaken for "the page changed".
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loginToIs } from '../../mcp/login';
import { installNodeRuntime } from '../lib/nodeRuntime';
import type { Capture } from './archive';
import { isFirstPages, isKept, isSubjectPages } from './isPages';
import type { Credentials } from './keychain';

const GAP_MS = 1_000;
/** A signed-in IS page: the main column, the logout link, no login form (cf. src/api/isPage.ts). */
const isSignedInPage = (html: string) =>
  html.includes('<div class="mainpage">') &&
  html.includes('logout.pl') &&
  !html.includes('name="credential_1"');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function readIs(
  creds: Credentials
): Promise<{ captures: Capture[]; problems: string[] }> {
  let cookie: string;
  try {
    cookie = await loginToIs(creds.user, creds.pass, fetch);
  } catch (err) {
    return {
      captures: [],
      problems: [`IS: ${err instanceof Error ? err.message : 'login failed'}`],
    };
  }
  await installNodeRuntime(cookie);
  const { getUserParams } = await import('@/utils/userParams');
  const { fetchWithAuth, BASE_URL } = await import('@/api/client');
  const params = await getUserParams();
  if (!params?.studium) return { captures: [], problems: ['IS: signed in, but found no study'] };
  const ids = {
    studium: params.studium,
    obdobi: params.obdobi ?? '',
    studentId: params.studentId ?? '',
  };

  const captures: Capture[] = [];
  const problems: string[] = [];
  const read = async (name: string, url: string) => {
    try {
      const res = await fetchWithAuth(`${url}${url.includes('?') ? ';' : '?'}lang=cz`);
      const html = await res.text();
      if (!isSignedInPage(html))
        problems.push(`IS: ${name} did not load as an IS page (HTTP ${res.status})`);
      else captures.push({ key: `is/${name}`, html });
    } catch (err) {
      problems.push(
        `IS: ${name} failed (${err instanceof Error ? err.message.split('\n')[0] : 'error'})`
      );
    }
    await sleep(GAP_MS);
  };

  for (const [name, url] of isFirstPages(BASE_URL, ids)) await read(name, url);
  const list = captures.find((c) => c.key === 'is/list')?.html ?? '';
  for (const [name, url] of isSubjectPages(BASE_URL, ids, list)) await read(name, url);
  return { captures, problems };
}

/** A saved dump (`scrape:real --dump-html`'s `<name>.cz.html`, plus `webiskam/*.html`) as captures. */
export function readDump(dir: string): Capture[] {
  const captures: Capture[] = [];
  for (const file of readdirSync(dir)) {
    const name = /^(.+)\.cz\.html$/.exec(file)?.[1];
    if (name && isKept(name))
      captures.push({ key: `is/${name}`, html: readFileSync(join(dir, file), 'utf8') });
  }
  let iskam: string[] = [];
  try {
    iskam = readdirSync(join(dir, 'webiskam'));
  } catch {
    // no WebISKAM pages in this dump
  }
  for (const file of iskam.filter((f) => f.endsWith('.html'))) {
    captures.push({
      key: `webiskam/${file.replace(/\.html$/, '')}`,
      html: readFileSync(join(dir, 'webiskam', file), 'utf8'),
    });
  }
  return captures;
}
