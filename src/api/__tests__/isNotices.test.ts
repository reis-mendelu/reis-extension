import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseIsNoticesHtml } from '../isNotices';

// Real IS home pages (/auth/index.pl) from 2026-11-09, trimmed to the notices.
// prod = is.mendelu.cz in today's design; test = test.is.mendelu.cz, the new
// design IS goes live with in November 2026 (its data is the 2026-10-24 copy,
// so it still shows "Kontrola" and not yet "Nový design UIS").
// prod-crit is the prod page as it was at 10:54, before the account confirmed
// its personal data and the red tile went away.
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
const PROD_CZ = fixture('zasadky-prod.cz.html');
const PROD_EN = fixture('zasadky-prod.en.html');
const PROD_CRIT_CZ = fixture('zasadky-prod-crit.cz.html');
const TEST_CZ = fixture('zasadky-test.cz.html');
const TEST_EN = fixture('zasadky-test.en.html');

const NEW_DESIGN = {
  key: 'zasadka:157890',
  title: 'Nový design UIS',
  link: 'https://test.is.mendelu.cz',
  severity: 'info',
  from: '2026-11-09T09:00',
  until: '2026-11-30T23:59',
};

const KONTROLA = {
  key: 'link:/auth/kontrola/',
  severity: 'crit',
  from: null,
  until: null,
};

/** HTML-escapes a value for a double-quoted attribute, `&` first, as IS does. */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

describe('parseIsNoticesHtml', () => {
  it('returns nothing for empty or unrelated pages', () => {
    expect(parseIsNoticesHtml('')).toEqual([]);
    expect(parseIsNoticesHtml('<html><body><p>nic</p></body></html>')).toEqual([]);
  });

  it('reads the info notice from the current design, and leaves the vývěska out', () => {
    const notices = parseIsNoticesHtml(PROD_CZ);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject(NEW_DESIGN);
    expect(notices[0]?.text).toContain('v průběhu listopadu bude nasazena nová podoba designu');
    expect(notices[0]?.text).toContain('OIT MENDELU');
  });

  it('reads the same window from the English page, whose dates are MM/DD/YYYY', () => {
    expect(parseIsNoticesHtml(PROD_EN)).toMatchObject([NEW_DESIGN]);
  });

  it('keeps the window and the hide link out of the text', () => {
    const [notice] = parseIsNoticesHtml(PROD_CZ);
    expect(notice?.text).not.toMatch(/zobrazována|nezobrazovat|display/i);
    expect(notice?.text).not.toContain('\\n');
  });

  it('reads the red notice, which has no id and no window, in both designs', () => {
    const prod = parseIsNoticesHtml(PROD_CRIT_CZ);
    expect(prod.map((n) => n.key)).toEqual([KONTROLA.key, NEW_DESIGN.key]);
    expect(prod[0]).toMatchObject({
      ...KONTROLA,
      title: 'Kontrola osobních údajů',
      link: 'https://is.mendelu.cz/auth/kontrola/?lang=cz',
    });
    expect(prod[0]?.text).toContain('potvrdit správnost Vašich osobních údajů');
    expect(prod[0]?.text).not.toMatch(/skrýt/);

    expect(parseIsNoticesHtml(TEST_CZ)).toMatchObject([
      { ...KONTROLA, title: 'Kontrola osobních údajů' },
    ]);
    expect(parseIsNoticesHtml(TEST_EN)).toMatchObject([
      {
        ...KONTROLA,
        title: 'Personal data check',
        link: 'https://is.mendelu.cz/auth/kontrola/?lang=en',
      },
    ]);
  });

  // A mute or a read mark has to cover the notice whatever language the
  // student reads IS in, and survive IS switching to its new design.
  it('gives one notice the same key in Czech and English, in both designs', () => {
    const keys = (html: string) => parseIsNoticesHtml(html).map((n) => n.key);
    expect(keys(PROD_EN)).toEqual(keys(PROD_CZ));
    expect(keys(TEST_EN)).toEqual(keys(TEST_CZ));
    expect(keys(TEST_CZ)[0]).toBe(keys(PROD_CRIT_CZ)[0]);
  });

  // "Již nezobrazovat" is a GET that hides the notice in the student's IS.
  // Making it the row's link would hide it for them on a tap.
  it('never takes the hide link as the notice link', () => {
    const body =
      '<div><big><b>Jen text</b></big><p /><div>Bez odkazu.</div>' +
      '<div class="small"><span class="small"><a href="?;jiz_nezobrazovat_zasadku=42;lang=cz"><b>Již nezobrazovat tuto informaci</b></a></span></div></div>';
    const html =
      '<div class="zasadky-container"><div class="zasadka"><table class="zasadky-info"><tbody><tr><td>' +
      `<a href="javascript:void(0);" onclick="uis.box.open_fixed('1','${escapeAttribute(body)}');">Jen text</a>` +
      '</td></tr></tbody></table></div></div>';
    expect(parseIsNoticesHtml(html)).toMatchObject([
      { key: 'zasadka:42', title: 'Jen text', text: 'Bez odkazu.', link: null },
    ]);
  });

  const oneNotice = (inner: string) =>
    '<div class="zasadky-container"><div class="zasadka"><table class="zasadky-info"><tbody><tr><td>' +
    `<a href="javascript:void(0);" onclick="uis.box.open_fixed('1','${escapeAttribute(`<div><big><b>T</b></big><div>${inner}</div></div>`)}');">T</a>` +
    '</td></tr></tbody></table></div></div>';

  it('resolves a relative link the way the IS home page would', () => {
    expect(parseIsNoticesHtml(oneNotice('<a href="kontrola/?lang=cz">tady</a>'))).toMatchObject([
      { key: 'link:/auth/kontrola/', link: 'https://is.mendelu.cz/auth/kontrola/?lang=cz' },
    ]);
  });

  // Two notices pointing at one page with different parameters are two
  // notices; only `lang` differs between a notice's Czech and English copy.
  it('keys a link by its parameters, except lang', () => {
    const key = (href: string) => parseIsNoticesHtml(oneNotice(`<a href="${href}">x</a>`))[0]?.key;
    expect(key('/auth/anketa/?id=1;lang=cz')).toBe('link:/auth/anketa/?id=1');
    expect(key('/auth/anketa/?lang=en;id=1')).toBe('link:/auth/anketa/?id=1');
    expect(key('/auth/anketa/?id=2;lang=cz')).toBe('link:/auth/anketa/?id=2');
  });

  it('skips a link that is not http(s)', () => {
    expect(
      parseIsNoticesHtml(oneNotice('<a href="javascript:alert(1)">x</a>'))[0]?.link
    ).toBeNull();
  });
});
