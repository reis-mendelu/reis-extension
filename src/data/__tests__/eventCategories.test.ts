import { describe, it, expect } from 'vitest';
import { inferCategory, CATEGORY_ICON } from '../eventCategories';
import type { EventCategory } from '../../types/events';

describe('inferCategory', () => {
  const cases: Array<[string, EventCategory]> = [
    ['Deskovky', 'boardgames'],
    ['Trip to Ostrava', 'trip'],
    ['PEF Kvíz', 'quiz'],
    ['Akademické středy — ASY-Quiz', 'quiz'],
    ['Erasmus Cup: Basketball', 'sports'],
    ['Erasmus Cup: Volleyball', 'sports'],
    ['Filmový klubík', 'film'],
    ['BU Karaoke', 'karaoke'],
    ['Country Presentation', 'culture'],
    ['Tématické dny — Taiwanský den', 'culture'],
    ['NEON Party', 'party'],
    ['Tram Party', 'party'],
    ['Beer Pong', 'party'],
    ['International Student Ball', 'party'],
    ['Tour de Pub', 'social'],
    ['TINDELU', 'social'],
    ['Únikovka', 'social'],
    ['Something Unmapped', 'other'],
  ];
  it.each(cases)('maps %s → %s', (title, expected) => {
    expect(inferCategory(title)).toBe(expected);
  });
});

describe('CATEGORY_ICON', () => {
  it('has an icon for every category used by inferCategory', () => {
    const all: EventCategory[] = ['party', 'boardgames', 'trip', 'quiz', 'sports', 'film', 'karaoke', 'culture', 'social', 'other'];
    for (const c of all) expect(CATEGORY_ICON[c]).toBeTruthy();
  });
});
