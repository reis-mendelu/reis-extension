import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Exchange students see only ESN's EVENTS (decision 2026-10-29), and the rule
 * lives in one place, `canSee`, which every event surface reads through two
 * hooks: pins, the Akce list and the peek band on the map, and Novinky with
 * its badge, on both trees. A component reading the raw store fields would
 * skip it, so every reader is listed here with its reason.
 *
 * Partner cards (`useMatchingPartners`) and society pins on the map (places,
 * not events) are deliberately NOT filtered by it: the decision was about
 * events written in Czech for Czech students. If that changes, change it here
 * on purpose, not by a hook that quietly starts reading `exchange`.
 */
const READERS: Record<string, string> = {
  'src/hooks/useVisibleMapEvents.ts': 'the map seam: filters through visibleToStudent',
  'src/hooks/useNotificationFeed.ts': 'the Novinky seam: filters through canSee',
  'src/hooks/useOpenNotification.ts': 'looks up the event of a row the feed already filtered',
  'src/store/slices/createMapSlice.ts': 'owns mapEvents: loads and focuses, shows nothing',
  'src/store/slices/createNotificationSlice.ts':
    'owns the feed: loads and marks read, shows nothing',
  'src/store/types.ts': 'declares the two fields',
};
const NOT_EVENTS = [
  'src/hooks/useMatchingPartners.ts',
  'src/components/CampusMap/SocietyPinLayer.tsx',
];
// Any `mapEvents` in code (a destructure too, not an import path), the feed's
// `.data`, and the whole slice by selector or destructure, which reach `.data`
// by an alias.
const RAW_EVENTS =
  /(?<![/\w])mapEvents\b|\bnotifications\.data\b|\bs\.notifications\)|\{[^}]*\bnotifications\b[^}]*\}\s*=\s*(useAppStore|get)\b/;
// A property read or a destructure, not the word in prose.
const USES_EXCHANGE = /\.exchange\b|\{[^}]*\bexchange\b[^}]*\}/;

/** Source without comments, so prose never counts as a read. */
const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sources(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

describe('the exchange-student filter covers events only', () => {
  it('only the listed hooks read raw society events', () => {
    // All of src: the phone tree also lives in src/mobile.
    const readers = sources('src').filter((path) => RAW_EVENTS.test(code(path)));
    expect(readers.sort()).toEqual(Object.keys(READERS).sort());
  });

  it.each(['src/hooks/useVisibleMapEvents.ts', 'src/hooks/useNotificationFeed.ts'])(
    '%s filters through the audience rule',
    (path) => {
      expect(code(path)).toMatch(/\b(canSee|visibleToStudent)\(/);
    }
  );

  it.each(NOT_EVENTS)('%s does not apply the exchange filter', (path) => {
    const src = code(path);
    expect(src).not.toMatch(USES_EXCHANGE);
    expect(src).not.toMatch(/\b(canSee|visibleToStudent)\(/);
  });
});
