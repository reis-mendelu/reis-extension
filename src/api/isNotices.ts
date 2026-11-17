import { fetchWithAuth, BASE_URL } from './client';
import type { IsNotice } from '../types/isNotices';
import type { Language } from '../store/types';

/**
 * The notices IS shows above the menu on its home page ("zásadky"). Read from
 * the student's OWN page, never from a shared source: some are for that student
 * alone. Nothing read here leaves the device.
 *
 * The markup is the same in today's design and the new one IS deploys in
 * November 2026 (fixtures from both, zasadky-prod.* and zasadky-test.*): a
 * `.zasadka` per tile, the vývěska being one of them, and per notice an anchor
 * whose onclick opens the full text: `uis.box.open_fixed('<n>','<html>')`.
 * The HTML is a JS string literal inside the attribute.
 */
export async function fetchIsNotices(lang: Language): Promise<IsNotice[]> {
  const response = await fetchWithAuth(`${BASE_URL}/auth/index.pl?lang=${lang}`);
  const html = await response.text();
  // A page without IS's logout link is not the student's home page (a login
  // page served as 200, say). Parsed, it would read as "IS took every notice
  // down" and empty Novinky until the next read; thrown, the slice keeps
  // what it had. The same marker the Capacitor transport checks.
  if (!html.includes('logout.pl')) throw new Error('IS home page without a session');
  return parseIsNoticesHtml(html);
}

const HIDE_LINK = 'jiz_nezobrazovat_zasadku=';
const OPEN_FIXED = /open_fixed\(\s*'[^']*'\s*,\s*'([\s\S]*)'\s*\)\s*;?\s*$/;

export function parseIsNoticesHtml(html: string): IsNotice[] {
  if (!html || typeof html !== 'string') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const notices: IsNotice[] = [];
  for (const tile of Array.from(doc.querySelectorAll('.zasadka:not(.vyveska)'))) {
    const severity = tile.querySelector('table.zasadky-crit') ? 'crit' : 'info';
    for (const anchor of Array.from(tile.querySelectorAll('a[onclick*="open_fixed"]'))) {
      const notice = parseNotice(anchor, severity);
      if (notice && !notices.some((n) => n.key === notice.key)) notices.push(notice);
    }
  }
  return notices;
}

function parseNotice(anchor: Element, severity: IsNotice['severity']): IsNotice | null {
  const literal = OPEN_FIXED.exec(anchor.getAttribute('onclick') ?? '')?.[1];
  if (literal === undefined) return null;
  const box = new DOMParser().parseFromString(unescapeJsString(literal), 'text/html').body;

  const title = clean(box.querySelector('big')?.textContent ?? anchor.textContent ?? '');
  if (!title) return null;

  // The text is the first block that is not IS's own footer (`.small`: the
  // display window, "cannot be hidden", the hide link) or the title.
  const content = Array.from(box.querySelectorAll('div')).find(
    (d) =>
      !d.classList.contains('small') && !d.querySelector('big, div') && clean(d.textContent ?? '')
  );
  const link = content ? firstLink(content) : null;
  const meta = Array.from(box.querySelectorAll('.small'))
    .map((s) => s.textContent ?? '')
    .join(' ');
  const [from, until] = readWindow(meta);
  const hideHref = box.querySelector(`a[href*="${HIDE_LINK}"]`)?.getAttribute('href') ?? '';
  const id = new RegExp(`${HIDE_LINK}(\\d+)`).exec(hideHref)?.[1];

  return {
    key: id ? `zasadka:${id}` : link ? `link:${linkKey(link)}` : `title:${title}`,
    title,
    text: content ? textOf(content) : '',
    link,
    severity,
    from,
    until,
  };
}

/** Undoes the JS string escaping IS applies inside the onclick literal. */
function unescapeJsString(s: string): string {
  return s.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
}

function clean(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Text with IS's paragraph and line breaks kept as newlines. */
function textOf(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll('br, p').forEach((b) => b.before('\n'));
  return (copy.textContent ?? '').split('\n').map(clean).filter(Boolean).join('\n');
}

/**
 * The notice's own link, absolute. Only http(s) and IS paths: never
 * `javascript:`, and never the hide link, which is a GET that hides the notice
 * in the student's IS.
 */
function firstLink(el: Element): string | null {
  for (const a of Array.from(el.querySelectorAll('a[href]'))) {
    const href = a.getAttribute('href')?.trim() ?? '';
    if (!href || href.includes(HIDE_LINK)) continue;
    // Resolved the way the browser resolves it on the home page, so a
    // relative link ("kontrola/") keeps its destination.
    try {
      const url = new URL(href, `${BASE_URL}/auth/index.pl`);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        return /^https?:\/\//i.test(href) ? href : url.href;
      }
    } catch {
      // Not a URL at all: try the next link.
    }
  }
  return null;
}

/**
 * The link as a key: path and parameters, minus `lang`, which is the one
 * thing that differs between the Czech and the English copy. IS separates
 * parameters with `;` as well as `&`.
 */
function linkKey(url: string): string {
  try {
    const u = new URL(url);
    const params = u.search
      .replace(/^\?/, '')
      .split(/[;&]/)
      .filter((p) => p && !/^lang=/i.test(p));
    const where = u.host === new URL(BASE_URL).host ? u.pathname : `${u.host}${u.pathname}`;
    return params.length ? `${where}?${params.join(';')}` : where;
  } catch {
    return url;
  }
}

/**
 * IS's "shown from … until …" line. Czech pages write `DD.MM.YYYY HH:MM`,
 * English ones `MM/DD/YYYY HH:MM`; both come out as local `YYYY-MM-DDTHH:MM`.
 */
function readWindow(meta: string): [string | null, string | null] {
  const text = meta.replace(/\u00a0/g, ' ');
  const stamps: string[] = [];
  const re = /(\d{2})([./])(\d{2})\2(\d{4}) (\d{2}):(\d{2})/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const [, a, sep, b, year, hh, mm] = m;
    const [day, month] = sep === '.' ? [a, b] : [b, a];
    stamps.push(`${year}-${month}-${day}T${hh}:${mm}`);
  }
  return [stamps[0] ?? null, stamps[1] ?? null];
}
