import { describe, it, expect } from 'vitest';
import { CATEGORY_ICON, CATEGORY_EMOJI_SRC, CATEGORY_COLOR } from '../eventCategories';
import type { EventCategory } from '../../types/events';

const ALL_CATEGORIES: EventCategory[] = ['party', 'boardgames', 'trip', 'quiz', 'sports', 'film', 'karaoke', 'culture', 'social', 'other'];

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
