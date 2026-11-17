import { describe, it, expect } from 'vitest';
import { pagesData } from '../index';
import { injectUserParams, type PageItem } from '../types';

// Resolve the way the phone does (usePageDirectory, MobileSearchOverlay): studium
// and language only. The desktop also passes obdobi and faculty, but the faculty
// is always empty (userParams/fetchers.ts returns facultyId: ''), so a
// placeholder that only a faculty can fill reaches IS as the literal text and IS
// answers "Nekorektní použití aplikace".
const resolve = (item: PageItem, lang: 'cz' | 'en' = 'cz') =>
  injectUserParams(item.href, '123', lang);

const allItems = pagesData.flatMap((c) => c.children);
const byId = (id: string) => {
  const item = allItems.find((i) => i.id === id);
  if (!item) throw new Error(`no page item ${id}`);
  return item;
};

describe('IS page links resolve without leftover placeholders', () => {
  it.each(allItems.map((i) => [i.id, i] as const))('%s', (_id, item) => {
    expect(resolve(item)).not.toContain('{{');
  });
});

describe('Moje studium links that used to need the faculty', () => {
  it('Kontaktní oddělení opens the faculty picker of "Kam se obrátit"', () => {
    expect(resolve(byId('kontaktni-oddeleni'))).toBe(
      'https://is.mendelu.cz/pracoviste/stud_odd.pl?lang=cz'
    );
    expect(resolve(byId('kontaktni-oddeleni'), 'en')).toBe(
      'https://is.mendelu.cz/pracoviste/stud_odd.pl?lang=en'
    );
  });

  it("Harmonogram akademického roku opens on the student's own faculty", () => {
    expect(resolve(byId('harmonogram-ak-roku'))).toBe(
      'https://is.mendelu.cz/auth/student/harmonogram.pl?lang=cz'
    );
    expect(resolve(byId('harmonogram-ak-roku'), 'en')).toBe(
      'https://is.mendelu.cz/auth/student/harmonogram.pl?lang=en'
    );
  });
});
