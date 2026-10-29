import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * Exchange students see only ESN's EVENTS (decision 2026-10-29), and the rule
 * lives in one place, `canSee`, which every event surface reads through these
 * two hooks: pins, the Akce list and the peek band on the map, and Novinky
 * with its badge, on both trees.
 *
 * Partner cards (`useMatchingPartners`) and society pins on the map (places,
 * not events) are deliberately NOT filtered by it: the decision was about
 * events written in Czech for Czech students. If that changes, change it here
 * on purpose, not by a hook that quietly starts reading `exchange`.
 */
const EVENT_SEAMS = ['src/hooks/useVisibleMapEvents.ts', 'src/hooks/useNotificationFeed.ts'];
const NOT_EVENTS = [
  'src/hooks/useMatchingPartners.ts',
  'src/components/CampusMap/SocietyPinLayer.tsx',
];

describe('the exchange-student filter covers events only', () => {
  it.each(EVENT_SEAMS)('%s filters through the audience rule', (path) => {
    expect(readFileSync(path, 'utf8')).toMatch(/\b(canSee|visibleToStudent)\(/);
  });

  it.each(NOT_EVENTS)('%s does not apply the exchange filter', (path) => {
    const src = readFileSync(path, 'utf8');
    expect(src).not.toMatch(/\bexchange\b/);
    expect(src).not.toMatch(/\b(canSee|visibleToStudent)\(/);
  });
});
