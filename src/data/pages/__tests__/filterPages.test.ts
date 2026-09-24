import { describe, it, expect } from 'vitest';
import { filterPageCategories, normalizePageQuery } from '../filterPages';
import type { PageCategory } from '../types';

const categories: PageCategory[] = [
  {
    id: 'moje-studium',
    label: 'Moje studium',
    labelEn: 'My College',
    children: [
      { id: 'e-index', label: 'E-index', labelEn: 'E-study record', href: 'https://is/a' },
      {
        id: 'zkousky',
        label: 'Přihlašování na zkoušky',
        labelEn: 'Exam registration',
        href: 'https://is/b',
      },
    ],
  },
  {
    id: 'portal-info',
    label: 'Portál veřejných informací',
    labelEn: 'Public information portal',
    children: [
      {
        id: 'katalog',
        label: 'Katalog předmětů',
        labelEn: 'Course catalogue',
        href: 'https://is/c',
      },
      { id: 'rozvrhy', label: 'Rozvrhy', labelEn: 'Timetables', href: 'https://is/d' },
    ],
  },
];

describe('normalizePageQuery', () => {
  it('lowercases, trims and strips diacritics', () => {
    expect(normalizePageQuery('  Přihlašování ')).toBe('prihlasovani');
  });
});

describe('filterPageCategories', () => {
  it('returns the very same list for an empty query', () => {
    expect(filterPageCategories(categories, '   ', 'cz')).toBe(categories);
  });

  it('matches without diacritics, keeping only the matching children', () => {
    const out = filterPageCategories(categories, 'zkousky', 'cz');
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('moje-studium');
    expect(out[0]?.children.map((c) => c.id)).toEqual(['zkousky']);
  });

  it('matches a query typed WITH diacritics too', () => {
    const out = filterPageCategories(categories, 'předmětů', 'cz');
    expect(out.map((c) => c.id)).toEqual(['portal-info']);
    expect(out[0]?.children.map((c) => c.id)).toEqual(['katalog']);
  });

  it('matches the English labels in English, and not the Czech ones', () => {
    expect(
      filterPageCategories(categories, 'timetable', 'en').flatMap((c) =>
        c.children.map((i) => i.id)
      )
    ).toEqual(['rozvrhy']);
    expect(filterPageCategories(categories, 'rozvrhy', 'en')).toEqual([]);
  });

  it('keeps every child when the CATEGORY name matches', () => {
    const out = filterPageCategories(categories, 'portal verejnych', 'cz');
    expect(out).toHaveLength(1);
    // The category object itself, with both children intact.
    expect(out[0]).toBe(categories[1]);
    expect(out[0]?.children).toHaveLength(2);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterPageCategories(categories, 'xyzzy', 'cz')).toEqual([]);
  });
});
