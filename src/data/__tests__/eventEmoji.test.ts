import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EVENT_EMOJI,
  EMOJI_GROUPS,
  EMOJI_CODE_FORMAT,
  CATEGORY_EMOJI_CODE,
  findEventEmoji,
  eventEmojiSrc,
} from '../eventEmoji';
import type { EventCategory } from '../../types/events';

const CATEGORIES: EventCategory[] = [
  'party',
  'boardgames',
  'trip',
  'quiz',
  'sports',
  'film',
  'karaoke',
  'culture',
  'social',
  'other',
];
const shipped = readdirSync(resolve(__dirname, '../../../public/emoji'))
  .filter((f) => f.endsWith('.svg'))
  .map((f) => f.replace(/\.svg$/, ''));

// The pin, the row and the peek band draw /emoji/<code>.svg. A catalog entry
// without its file is a broken image on every device; a file without an entry
// is dead weight in every bundle.
describe('event emoji catalog', () => {
  it('has 85 entries with unique codes', () => {
    expect(EVENT_EMOJI).toHaveLength(85);
    expect(new Set(EVENT_EMOJI.map((e) => e.code)).size).toBe(85);
  });

  it('uses the format the database CHECK enforces', () => {
    for (const e of EVENT_EMOJI) expect(e.code).toMatch(EMOJI_CODE_FORMAT);
  });

  it('ships an SVG for every entry and no SVG without one', () => {
    expect(shipped.sort()).toEqual(EVENT_EMOJI.map((e) => e.code).sort());
  });

  it('maps every entry to a category released builds understand', () => {
    for (const e of EVENT_EMOJI) expect(CATEGORIES).toContain(e.category);
  });

  it('puts every entry in a listed group, and every group has entries', () => {
    for (const e of EVENT_EMOJI) expect(EMOJI_GROUPS).toContain(e.group);
    for (const g of EMOJI_GROUPS) expect(EVENT_EMOJI.some((e) => e.group === g)).toBe(true);
  });

  it('names every entry in both languages', () => {
    for (const e of EVENT_EMOJI) {
      expect(e.cz.trim()).not.toBe('');
      expect(e.en.trim()).not.toBe('');
    }
  });

  it('keeps every category fallback inside the catalog', () => {
    for (const c of CATEGORIES) expect(findEventEmoji(CATEGORY_EMOJI_CODE[c])).not.toBeNull();
  });
});

describe('eventEmojiSrc', () => {
  it("draws the event's own emoji", () =>
    expect(eventEmojiSrc({ emoji: '26f8', category: 'sports' })).toBe('/emoji/26f8.svg'));
  it('falls back to the category when the event has none', () =>
    expect(eventEmojiSrc({ emoji: null, category: 'quiz' })).toBe('/emoji/1f9e0.svg'));
  // A code added to the catalog after this build shipped: fall back, never a broken image.
  it('falls back to the category for a code this build does not ship', () =>
    expect(eventEmojiSrc({ emoji: '1f9a9', category: 'party' })).toBe('/emoji/1f389.svg'));
  it('falls back to ✨ for a category this build does not know', () =>
    expect(eventEmojiSrc({ emoji: null, category: 'opera' as EventCategory })).toBe(
      '/emoji/2728.svg'
    ));
});
