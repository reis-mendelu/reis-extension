import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The IS nav menu, in the student's language only.
 *
 * It is scraped off the IS page the extension runs on, which is in whatever
 * language IS is showing, and the other language used to be fetched on every
 * page load so the menu could switch instantly. Now: a page already in the
 * student's language costs no request at all, a page in the other language
 * fetches the student's, and a switch fetches the new language once.
 */
const fetchNavMenuIn = vi.fn();
vi.mock('../menuScraper', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../menuScraper')>()),
  fetchNavMenuIn: (...a: unknown[]) => fetchNavMenuIn(...a),
}));

import { setScrapedNavMenu, ensureNavMenuLanguage, getNavMenu } from '../navMenuLanguage';
import type { RawCategory } from '../menuScraper';

const menu = (label: string, child: string): RawCategory[] => [
  { id: 's1', label, icon: 'x', children: [{ id: 'c1', label: child, href: '/a' }] },
];
const CZ = menu('Studium', 'Rozvrh');
const EN = menu('Studies', 'Timetable');

describe('the nav menu is fetched in the student language only', () => {
  let sent: unknown[];
  const send = (m: unknown) => sent.push(m);

  beforeEach(() => {
    sent = [];
    fetchNavMenuIn.mockReset();
    fetchNavMenuIn.mockResolvedValue(EN);
  });

  it('fetches nothing when the IS page is already in the student language', async () => {
    setScrapedNavMenu({ categories: CZ, lang: 'cz' });
    await ensureNavMenuLanguage('cz', send);
    expect(fetchNavMenuIn).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
    expect(getNavMenu()?.[0]?.label).toBe('Studium');
  });

  it("fetches the student's language when the page is in the other one", async () => {
    setScrapedNavMenu({ categories: CZ, lang: 'cz' });
    await ensureNavMenuLanguage('en', send);
    expect(fetchNavMenuIn).toHaveBeenCalledWith('en');
    expect(getNavMenu()?.[0]).toMatchObject({ label: 'Studium', labelEn: 'Studies' });
    expect(getNavMenu()?.[0]?.children[0]).toMatchObject({ labelEn: 'Timetable' });
    expect(sent).toHaveLength(1);
  });

  it('fetches a language once, however often it is asked for', async () => {
    setScrapedNavMenu({ categories: CZ, lang: 'cz' });
    await ensureNavMenuLanguage('en', send);
    await ensureNavMenuLanguage('en', send);
    await ensureNavMenuLanguage('cz', send);
    expect(fetchNavMenuIn).toHaveBeenCalledTimes(1);
  });

  // The page load and a trigger_sync can both ask before the first answer is
  // back; they share the one /auth/ request rather than each making it.
  it('shares one request between overlapping asks for the same language', async () => {
    setScrapedNavMenu({ categories: CZ, lang: 'cz' });
    let answer!: (v: RawCategory[]) => void;
    fetchNavMenuIn.mockReturnValueOnce(new Promise((r) => (answer = r)));
    const a = ensureNavMenuLanguage('en', send);
    const b = ensureNavMenuLanguage('en', send);
    answer(EN);
    await Promise.all([a, b]);
    expect(fetchNavMenuIn).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(1);
  });

  it('keeps the scraped labels when the fetch fails, and tries again next time', async () => {
    setScrapedNavMenu({ categories: CZ, lang: 'cz' });
    fetchNavMenuIn.mockResolvedValueOnce(null);
    await ensureNavMenuLanguage('en', send);
    expect(getNavMenu()?.[0]?.labelEn).toBe('Studium');
    await ensureNavMenuLanguage('en', send);
    expect(fetchNavMenuIn).toHaveBeenCalledTimes(2);
  });
});
