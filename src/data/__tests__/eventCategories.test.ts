import { describe, it, expect } from 'vitest';
import { inferCategory, CATEGORY_ICON, CATEGORY_EMOJI_SRC, CATEGORY_COLOR } from '../eventCategories';
import type { EventCategory } from '../../types/events';

const ALL_CATEGORIES: EventCategory[] = ['party', 'boardgames', 'trip', 'quiz', 'sports', 'film', 'karaoke', 'culture', 'social', 'other'];

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

describe('category maps', () => {
  it('have a lucide icon, an emoji svg path, and a vivid colour for every category', () => {
    for (const c of ALL_CATEGORIES) {
      expect(CATEGORY_ICON[c]).toBeTruthy();
      expect(CATEGORY_EMOJI_SRC[c]).toMatch(/^\/emoji\/[0-9a-f]+\.svg$/);
      expect(CATEGORY_COLOR[c]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('uses a distinct colour per category so the map reads as colourful', () => {
    const colours = ALL_CATEGORIES.map((c) => CATEGORY_COLOR[c]);
    expect(new Set(colours).size).toBe(ALL_CATEGORIES.length);
  });
});
