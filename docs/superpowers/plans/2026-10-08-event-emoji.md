# One Emoji per Society Event Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every society event shows its own emoji, picked from a curated set of 84 shipped Twemoji SVGs, instead of one emoji per broad category.

**Architecture:** A nullable `spolky_events.emoji` column holds a Twemoji codepoint filename. A catalog in `src/data/eventEmoji.ts` lists the shipped emoji, each mapped to one of the 10 legacy categories. Pins, rows and the peek band render `eventEmojiSrc(event)`, which falls back to the category's emoji. The admin composer's category chips become an emoji picker that writes both columns. Released builds keep reading `category`, which stays valid.

**Tech Stack:** React 18 + TypeScript, Zustand, Vitest + Testing Library, DaisyUI/Tailwind, Supabase (Postgres), Twemoji 15.1.0 SVGs (jdecked fork, CC BY 4.0).

**Spec:** `docs/superpowers/specs/2026-10-08-event-emoji-design.md`

## Global Constraints

- Branch `claude/society-events-emoji`, cut from `claude/society-events-redesign-54f4bf` (#515). Push to remote `personal`. Open the PR only after #515 merges, `--base test`. Never merge.
- Emoji codes match `^[0-9a-f]{2,6}(-[0-9a-f]{2,6})*$`: the same pattern in TS and in the SQL CHECK.
- `category` must stay one of `party, boardgames, trip, quiz, sports, film, karaoke, culture, social, other`. Builds 5.1.1–5.3.0 render it unchecked.
- SVGs come from `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/<code>.svg` and are committed to `public/emoji/`. No runtime fetch.
- No custom CSS: DaisyUI and Tailwind utilities only. Max ~200 lines per file. Direct imports, no barrels. Test first.
- The migration and backfill are NOT applied by this plan. Production writes need Dominik's explicit yes at apply time (`npx supabase db query --linked -f <file>`, never `db push`).
- The UI is shared (`src/components/CampusMap/`, `MapSheetPeek`), so both trees get it. Verify phone 320/390/430, tablet 834/1024/1194 (`?mobile=1`) and desktop 1280 (`?mobile=0`).
- Run locally: the touched tests (`npx vitest run <pattern>`) and `npm run typecheck`. Leave repo-wide lint, format and the full suite to CI.

## File Structure

| File | Responsibility |
|---|---|
| `src/data/eventEmoji.ts` (new) | The catalog: 84 entries, groups, category fallback codes, `findEventEmoji`, `eventEmojiCode`, `eventEmojiSrc`, `EMOJI_CODE_FORMAT` |
| `src/data/__tests__/eventEmoji.test.ts` (new) | Catalog integrity: format, uniqueness, every SVG shipped, no orphan SVGs, fallbacks |
| `scripts/emoji/fetch-event-emoji.ts` (new) | Downloads missing catalog SVGs from the pinned Twemoji version |
| `public/emoji/*.svg` | 74 new SVGs next to the 10 existing ones |
| `src/components/CampusMap/mapLayers.ts` | Twemoji credit in the map attribution |
| `supabase/migrations/20261010120000_event_emoji.sql` (new) | Column + format CHECK |
| `src/types/events.ts`, `src/api/mapEvents.ts`, `src/api/societyPosts.ts`, `src/components/CampusMap/composerPost.ts`, `composerRules.ts` | Carry `emoji` through read, create and edit |
| `EventPin.tsx`, `EventRow.tsx`, `MapSheetPeek.tsx` | Render `eventEmojiSrc` |
| `EventDetailCard.tsx` | Drop the category line |
| `ComposerEmojiField.tsx` (new), `EventComposer.tsx` | Emoji picker replacing `ComposerCategoryField.tsx` (deleted) |
| `src/data/eventCategories.ts` | Shrinks to what is still read (`CATEGORY_COLOR`) |
| `supabase/backfills/20261010_event_emoji.sql` (new) | Emoji + corrected category for the 57 production rows |

---

### Task 1: Emoji catalog, assets and attribution

**Files:**
- Create: `src/data/eventEmoji.ts`
- Create: `src/data/__tests__/eventEmoji.test.ts`
- Create: `scripts/emoji/fetch-event-emoji.ts`
- Modify: `package.json` (scripts)
- Modify: `src/components/CampusMap/mapLayers.ts:84-85`
- Modify: `src/components/CampusMap/__tests__/mapLayers.test.ts`
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json` (inside the top-level `"map"` object, line ~898)
- Add: 74 files in `public/emoji/`

**Interfaces:**
- Produces:
  - `type EmojiGroup = 'party' | 'games' | 'sport' | 'culture' | 'season' | 'travel' | 'other'`
  - `interface EventEmoji { code: string; category: EventCategory; group: EmojiGroup; cz: string; en: string }`
  - `EVENT_EMOJI: readonly EventEmoji[]`, `EMOJI_GROUPS: readonly EmojiGroup[]`
  - `EMOJI_CODE_FORMAT: RegExp`
  - `CATEGORY_EMOJI_CODE: Record<EventCategory, string>`
  - `findEventEmoji(code: string | null | undefined): EventEmoji | null`
  - `eventEmojiCode(e: { emoji?: string | null; category: EventCategory }): string`
  - `eventEmojiSrc(e: { emoji?: string | null; category: EventCategory }): string` → `/emoji/<code>.svg`
  - i18n keys `map.emojiGroup.<group>`, `map.emojiPickerLabel`, `map.emojiChange`

- [ ] **Step 1: Write the failing catalog test**

`src/data/__tests__/eventEmoji.test.ts`:

```ts
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
  'party', 'boardgames', 'trip', 'quiz', 'sports',
  'film', 'karaoke', 'culture', 'social', 'other',
];
const shipped = readdirSync(resolve(__dirname, '../../../public/emoji'))
  .filter((f) => f.endsWith('.svg'))
  .map((f) => f.replace(/\.svg$/, ''));

// The pin, the row and the peek band draw /emoji/<code>.svg. A catalog entry
// without its file is a broken image on every device; a file without an entry
// is dead weight in every bundle.
describe('event emoji catalog', () => {
  it('has 84 entries with unique codes', () => {
    expect(EVENT_EMOJI).toHaveLength(84);
    expect(new Set(EVENT_EMOJI.map((e) => e.code)).size).toBe(84);
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/data/__tests__/eventEmoji.test.ts`
Expected: FAIL, `Cannot find module '../eventEmoji'`.

- [ ] **Step 3: Write the catalog**

`src/data/eventEmoji.ts`:

```ts
import type { EventCategory } from '../types/events';

/**
 * The emoji an imported event can carry (spec 2026-10-08-event-emoji-design).
 *
 * A category used to pick the picture, and the categories were broader than
 * their pictures: ice skating drew as volleyball, a trip to Finland as a bus.
 * Each event now carries its own code, and its category is only the fallback,
 * kept valid because builds 5.1.1–5.3.0 render it unchecked.
 *
 * `code` is the Twemoji 15.1.0 SVG filename in public/emoji (CC BY 4.0,
 * credited in the map attribution). `category` is what an event with this
 * emoji is filed under for those older builds. Add an entry, then run
 * `npm run emoji:fetch`; the test fails until the SVG is there.
 */
export type EmojiGroup = 'party' | 'games' | 'sport' | 'culture' | 'season' | 'travel' | 'other';

export interface EventEmoji {
  code: string;
  category: EventCategory;
  group: EmojiGroup;
  cz: string;
  en: string;
}

/** Same pattern as the spolky_events_emoji_format CHECK. */
export const EMOJI_CODE_FORMAT = /^[0-9a-f]{2,6}(-[0-9a-f]{2,6})*$/;

export const EMOJI_GROUPS: readonly EmojiGroup[] = [
  'party', 'games', 'sport', 'culture', 'season', 'travel', 'other',
];

const e = (code: string, category: EventCategory, group: EmojiGroup, cz: string, en: string) =>
  ({ code, category, group, cz, en }) satisfies EventEmoji;

export const EVENT_EMOJI: readonly EventEmoji[] = [
  e('1f389', 'party', 'party', 'Párty', 'Party'),
  e('1f37b', 'social', 'party', 'Posezení', 'Drinks with friends'),
  e('1f37a', 'social', 'party', 'Pivo', 'Beer'),
  e('1f377', 'social', 'party', 'Víno', 'Wine'),
  e('1f347', 'social', 'party', 'Ochutnávka vína', 'Wine tasting'),
  e('1f378', 'party', 'party', 'Koktejly', 'Cocktails'),
  e('1f942', 'party', 'party', 'Přípitek', 'Toast'),
  e('1f483', 'party', 'party', 'Tanec', 'Dancing'),
  e('1faa9', 'party', 'party', 'Disko', 'Disco'),
  e('1f3a7', 'party', 'party', 'DJ', 'DJ'),
  e('1f6a2', 'party', 'party', 'Loď', 'Boat'),
  e('1f68b', 'party', 'party', 'Tramvaj', 'Tram'),
  e('1f3d3', 'social', 'party', 'Beerpong', 'Beer pong'),
  e('1f37d', 'social', 'party', 'Večeře', 'Dinner'),
  e('1f355', 'social', 'party', 'Pizza', 'Pizza'),
  e('2615', 'social', 'party', 'Káva', 'Coffee'),
  e('1f9fa', 'social', 'party', 'Piknik', 'Picnic'),
  e('1f382', 'party', 'party', 'Narozeniny', 'Birthday'),
  e('1f91d', 'social', 'party', 'Setkání', 'Meetup'),
  e('1f44b', 'party', 'party', 'Rozloučení', 'Goodbye'),
  e('1f3b2', 'boardgames', 'games', 'Deskovky', 'Board games'),
  e('1f9e0', 'quiz', 'games', 'Kvíz', 'Quiz'),
  e('2753', 'quiz', 'games', 'Hádanky', 'Riddles'),
  e('1f3ae', 'other', 'games', 'Videohry', 'Video games'),
  e('265f', 'boardgames', 'games', 'Šachy', 'Chess'),
  e('1f0cf', 'boardgames', 'games', 'Karty', 'Cards'),
  e('1f9e9', 'boardgames', 'games', 'Hlavolamy', 'Puzzles'),
  e('1f5fa', 'other', 'games', 'Hra ve městě', 'City game'),
  e('1f3d0', 'sports', 'sport', 'Volejbal', 'Volleyball'),
  e('26bd', 'sports', 'sport', 'Fotbal', 'Football'),
  e('1f3c0', 'sports', 'sport', 'Basketbal', 'Basketball'),
  e('1f3be', 'sports', 'sport', 'Tenis a padel', 'Tennis and padel'),
  e('1f3f8', 'sports', 'sport', 'Badminton', 'Badminton'),
  e('26f8', 'sports', 'sport', 'Bruslení', 'Ice skating'),
  e('26f7', 'sports', 'sport', 'Lyžování', 'Skiing'),
  e('1f3d2', 'sports', 'sport', 'Hokej', 'Hockey'),
  e('1f93a', 'sports', 'sport', 'Šerm', 'Fencing'),
  e('1f3c3', 'sports', 'sport', 'Běh', 'Running'),
  e('1f6b4', 'sports', 'sport', 'Cyklistika', 'Cycling'),
  e('1f9d7', 'sports', 'sport', 'Lezení', 'Climbing'),
  e('1f3ca', 'sports', 'sport', 'Plavání', 'Swimming'),
  e('1f6f6', 'sports', 'sport', 'Vodáctví', 'Canoeing'),
  e('1f9d8', 'sports', 'sport', 'Jóga', 'Yoga'),
  e('1f3c6', 'other', 'sport', 'Ocenění a turnaje', 'Awards and tournaments'),
  e('1f30d', 'culture', 'culture', 'Kultura', 'Culture'),
  e('1f3ac', 'film', 'culture', 'Film', 'Film'),
  e('1f3a4', 'karaoke', 'culture', 'Karaoke', 'Karaoke'),
  e('1f3ad', 'culture', 'culture', 'Divadlo', 'Theatre'),
  e('1f3b5', 'culture', 'culture', 'Hudba', 'Music'),
  e('1f3b8', 'culture', 'culture', 'Koncert', 'Concert'),
  e('1f3a8', 'culture', 'culture', 'Umění', 'Art'),
  e('1f4f8', 'culture', 'culture', 'Fotografie', 'Photography'),
  e('1f3db', 'culture', 'culture', 'Muzeum', 'Museum'),
  e('1f4da', 'culture', 'culture', 'Knihy', 'Books'),
  e('1f393', 'culture', 'culture', 'Přednáška', 'Lecture'),
  e('1f399', 'culture', 'culture', 'Diskuze', 'Talk'),
  e('1f4bc', 'other', 'culture', 'Kariéra', 'Careers'),
  e('1f4bb', 'other', 'culture', 'Workshop', 'Workshop'),
  e('1f6cd', 'culture', 'culture', 'Trh', 'Market'),
  e('1f1e8-1f1ff', 'culture', 'culture', 'Česko', 'Czechia'),
  e('1f1eb-1f1ee', 'culture', 'culture', 'Finsko', 'Finland'),
  e('1f1f8-1f1ea', 'culture', 'culture', 'Švédsko', 'Sweden'),
  e('1f1f5-1f1ed', 'culture', 'culture', 'Filipíny', 'Philippines'),
  e('1f1e8-1f1f7', 'culture', 'culture', 'Kostarika', 'Costa Rica'),
  e('1f384', 'culture', 'season', 'Vánoce', 'Christmas'),
  e('1f385', 'culture', 'season', 'Mikuláš', 'St. Nicholas'),
  e('1f381', 'other', 'season', 'Dárky a sbírky', 'Gifts and charity'),
  e('2764', 'other', 'season', 'Dobrovolnictví', 'Volunteering'),
  e('1f383', 'party', 'season', 'Halloween', 'Halloween'),
  e('1f338', 'other', 'season', 'Jaro', 'Spring'),
  e('1fa78', 'other', 'season', 'Darování krve', 'Blood donation'),
  e('1f68c', 'trip', 'travel', 'Výlet autobusem', 'Bus trip'),
  e('1f686', 'trip', 'travel', 'Výlet vlakem', 'Train trip'),
  e('2708', 'trip', 'travel', 'Let', 'Flight'),
  e('1f3d4', 'trip', 'travel', 'Hory', 'Mountains'),
  e('1f3f0', 'trip', 'travel', 'Hrad', 'Castle'),
  e('26fa', 'trip', 'travel', 'Kempování', 'Camping'),
  e('1f9f3', 'trip', 'travel', 'Cestování', 'Travel'),
  e('1f333', 'other', 'other', 'Příroda', 'Nature'),
  e('1f331', 'other', 'other', 'Zahrada', 'Garden'),
  e('1f43e', 'other', 'other', 'Zvířata', 'Animals'),
  e('1f4e2', 'other', 'other', 'Oznámení', 'Announcement'),
  e('1f5f3', 'other', 'other', 'Volby', 'Elections'),
  e('2728', 'other', 'other', 'Akce', 'Event'),
];

/** What each category drew before events had their own emoji: the fallback. */
export const CATEGORY_EMOJI_CODE: Record<EventCategory, string> = {
  party: '1f389',
  boardgames: '1f3b2',
  trip: '1f68c',
  quiz: '1f9e0',
  sports: '1f3d0',
  film: '1f3ac',
  karaoke: '1f3a4',
  culture: '1f30d',
  social: '1f37b',
  other: '2728',
};

const BY_CODE = new Map(EVENT_EMOJI.map((x) => [x.code, x]));

export function findEventEmoji(code: string | null | undefined): EventEmoji | null {
  return (code && BY_CODE.get(code)) || null;
}

/** The event's own emoji when this build ships it, else its category's. */
export function eventEmojiCode(ev: { emoji?: string | null; category: EventCategory }): string {
  return (
    findEventEmoji(ev.emoji)?.code ?? CATEGORY_EMOJI_CODE[ev.category] ?? CATEGORY_EMOJI_CODE.other
  );
}

export function eventEmojiSrc(ev: { emoji?: string | null; category: EventCategory }): string {
  return `/emoji/${eventEmojiCode(ev)}.svg`;
}
```

- [ ] **Step 4: Write the fetch script and its npm entry**

`scripts/emoji/fetch-event-emoji.ts`:

```ts
// Downloads every catalog emoji missing from public/emoji, from the pinned
// Twemoji release. Run after adding an entry to src/data/eventEmoji.ts:
//   npm run emoji:fetch
// The SVGs are committed; the app never fetches them at runtime.
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EVENT_EMOJI } from '../../src/data/eventEmoji';

const VERSION = '15.1.0';
const DIR = fileURLToPath(new URL('../../public/emoji/', import.meta.url));

let added = 0;
for (const { code } of EVENT_EMOJI) {
  const out = `${DIR}${code}.svg`;
  if (existsSync(out)) continue;
  const res = await fetch(`https://cdn.jsdelivr.net/gh/jdecked/twemoji@${VERSION}/assets/svg/${code}.svg`);
  if (!res.ok) throw new Error(`${code}: HTTP ${res.status} (not in Twemoji ${VERSION}?)`);
  await writeFile(out, await res.text());
  added += 1;
  console.log('added', code);
}
console.log(`${added} added, ${EVENT_EMOJI.length} in the catalog`);
```

In `package.json` `"scripts"`, after `"verify:ui"`, add:

```json
"emoji:fetch": "tsx --tsconfig tsconfig.app.json scripts/emoji/fetch-event-emoji.ts",
```

- [ ] **Step 5: Fetch the SVGs**

Run: `npm run emoji:fetch`
Expected: 74 `added <code>` lines, then `74 added, 84 in the catalog`. Then `ls public/emoji | wc -l` prints `84`.

- [ ] **Step 6: Run the catalog test**

Run: `npx vitest run src/data/__tests__/eventEmoji.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 7: Write the failing attribution test**

Append to `src/components/CampusMap/__tests__/mapLayers.test.ts`, reusing that file's existing `init()`/`afterEach` pattern inside a new describe:

```ts
// The pins draw Twemoji SVGs, which are CC BY 4.0: the credit sits beside
// OpenStreetMap's in the one attribution line the map already shows.
describe('initLeafletMap attribution', () => {
  let map: L.Map | null = null;
  let el: HTMLDivElement | null = null;
  afterEach(() => {
    map?.remove();
    el?.remove();
    map = null;
    el = null;
  });

  it('credits Twemoji next to OpenStreetMap', () => {
    el = document.createElement('div');
    document.body.appendChild(el);
    map = initLeafletMap(el, [
      [49.209, 16.613],
      [49.212, 16.619],
    ]);
    const text = el.querySelector('.leaflet-control-attribution')?.textContent ?? '';
    expect(text).toContain('OpenStreetMap');
    expect(text).toContain('Twemoji');
    expect(text).toContain('CC BY 4.0');
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/mapLayers.test.ts`
Expected: FAIL on `toContain('Twemoji')`.

- [ ] **Step 9: Add the credit**

In `src/components/CampusMap/mapLayers.ts`, replace the `attribution:` value:

```ts
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Emoji: <a href="https://github.com/jdecked/twemoji">Twemoji</a>, CC BY 4.0',
```

- [ ] **Step 10: Add the picker strings**

In both locale files, inside the top-level `"map"` object (line ~898, the one holding `"categoryLabel"`), add after `"categoryLabel"`:

`src/i18n/locales/cs.json`:

```json
    "emojiPickerLabel": "Obrázek akce",
    "emojiChange": "Změnit obrázek",
    "emojiGroup": {
      "party": "Párty a jídlo",
      "games": "Hry a kvízy",
      "sport": "Sport",
      "culture": "Kultura a vzdělávání",
      "season": "Svátky",
      "travel": "Výlety",
      "other": "Ostatní"
    },
```

`src/i18n/locales/en.json`:

```json
    "emojiPickerLabel": "Event picture",
    "emojiChange": "Change picture",
    "emojiGroup": {
      "party": "Parties and food",
      "games": "Games and quizzes",
      "sport": "Sport",
      "culture": "Culture and learning",
      "season": "Holidays",
      "travel": "Trips",
      "other": "Other"
    },
```

- [ ] **Step 11: Run the tests and typecheck**

Run: `npx vitest run src/data src/components/CampusMap/__tests__/mapLayers.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 12: Commit**

```bash
git add src/data/eventEmoji.ts src/data/__tests__/eventEmoji.test.ts scripts/emoji package.json public/emoji src/components/CampusMap/mapLayers.ts src/components/CampusMap/__tests__/mapLayers.test.ts src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(events): a curated Twemoji catalog for per-event emoji

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Carry `emoji` from the database to the event and back

**Files:**
- Create: `supabase/migrations/20261010120000_event_emoji.sql`
- Modify: `src/types/events.ts:94-111` (`MapEvent`)
- Modify: `src/api/mapEvents.ts:7-56` (`SpolkyEventRow`, `toMapEvent`)
- Modify: `src/api/societyPosts.ts:7-73` (`PostInput`, `SpolkyEventRow`, `toRow`)
- Modify: `src/components/CampusMap/composerPost.ts:41-59` (`toPatch`)
- Test: `src/api/__tests__/mapEvents.test.ts`, `src/api/__tests__/societyPosts.test.ts`, `src/components/CampusMap/__tests__/composerPost.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `MapEvent.emoji?: string | null`, `PostInput.emoji?: string | null`; both row types gain `emoji?: string | null`; `toRow` and `toPatch` write `emoji`.

- [ ] **Step 1: Write the migration**

`supabase/migrations/20261010120000_event_emoji.sql`:

```sql
-- One emoji per society event (docs/superpowers/specs/2026-10-08-event-emoji-design.md).
--
-- A Twemoji codepoint filename ('26f8', '1f1eb-1f1ee'). Format-checked, not
-- enumerated: the shipped set lives in src/data/eventEmoji.ts and grows without
-- a migration, and a build that does not ship a code falls back to `category`.
-- `category` keeps its CHECK: builds 5.1.1–5.3.0 render it unchecked and never
-- read this column.
alter table public.spolky_events add column if not exists emoji text;

alter table public.spolky_events drop constraint if exists spolky_events_emoji_format;
alter table public.spolky_events add constraint spolky_events_emoji_format
  check (emoji is null or emoji ~ '^[0-9a-f]{2,6}(-[0-9a-f]{2,6})*$');

comment on column public.spolky_events.emoji is
  'Twemoji codepoint filename shown for the event; null = the category''s emoji.';
```

- [ ] **Step 2: Write the failing mapping tests**

Append to `src/api/__tests__/mapEvents.test.ts`, which already has a row fixture `const base` at line 12:

```ts
describe('toMapEvent emoji', () => {
  it('carries the row emoji', () =>
    expect(toMapEvent({ ...base, emoji: '26f8' }, {}).emoji).toBe('26f8'));
  it('reads a missing column as none', () => {
    const { emoji: _drop, ...row } = { ...base, emoji: undefined };
    expect(toMapEvent(row, {}).emoji).toBeNull();
  });
});
```

Append to `src/api/__tests__/societyPosts.test.ts`, which already has `const base: PostInput` at line 11:

```ts
describe('toRow emoji', () => {
  it('writes the chosen emoji', () =>
    expect(toRow({ ...base, emoji: '1f3d3' }, 'supef', 'u1').emoji).toBe('1f3d3'));
  it('writes null when none was chosen', () =>
    expect(toRow({ ...base, emoji: undefined }, 'supef', 'u1').emoji).toBeNull());
});
```

In `src/components/CampusMap/__tests__/composerPost.test.ts`, add `emoji: '1f3b2'` to the `input` fixture, add `emoji: '1f3b2'` to the object expected by `'maps every field the composer edits to its column'`, and add:

```ts
it('writes the emoji, so an edit can change the picture', () =>
  expect(toPatch({ ...input, emoji: '26f8' }).emoji).toBe('26f8'));
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/api/__tests__/mapEvents.test.ts src/api/__tests__/societyPosts.test.ts src/components/CampusMap/__tests__/composerPost.test.ts`
Expected: FAIL (`emoji` undefined / missing from the patch), plus type errors on `emoji` in the fixtures.

- [ ] **Step 4: Implement**

`src/types/events.ts`, in `MapEvent` after `category: EventCategory;`:

```ts
  /** Its own Twemoji code ('26f8'), or null for its category's emoji. Optional
   *  so hand-built fixtures need not carry it. Render through eventEmojiSrc. */
  emoji?: string | null;
```

`src/api/mapEvents.ts`: add `emoji?: string | null;` to `SpolkyEventRow` after `category: string;`, and in `toMapEvent` after the `category:` line:

```ts
    // Absent on builds of the database before the column; none either way.
    emoji: row.emoji ?? null,
```

`src/api/societyPosts.ts`:
- in `PostInput` after `category`: `/** Twemoji code from src/data/eventEmoji; category is its fallback. */ emoji?: string | null;`
- in `SpolkyEventRow` after `category: string;`: `emoji?: string | null;`
- in `toRow` after `category: input.category,`: `emoji: input.emoji ?? null,`

`src/components/CampusMap/composerPost.ts`, in `toPatch` after `category: input.category,`:

```ts
    emoji: input.emoji ?? null,
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `npx vitest run src/api src/components/CampusMap/__tests__/composerPost.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Dry-run the migration against production without keeping it**

Write `scratchpad/emoji-dryrun.sql` (the session scratchpad, not the repo):

```sql
do $$
begin
  alter table public.spolky_events add column if not exists emoji text;
  alter table public.spolky_events add constraint spolky_events_emoji_format_dry
    check (emoji is null or emoji ~ '^[0-9a-f]{2,6}(-[0-9a-f]{2,6})*$');
  update public.spolky_events set emoji = '26f8' where title = 'Ice skating';
  begin
    update public.spolky_events set emoji = 'NOT A CODE' where title = 'Ice skating';
    raise exception 'check did not fire';
  exception when check_violation then null;
  end;
  raise exception 'dry run ok, rolling back';
end $$;
```

Run: `npx supabase db query --linked -f <scratchpad>/emoji-dryrun.sql`
Expected: an error ending in `dry run ok, rolling back`. Then `npx supabase db query --linked "select column_name from information_schema.columns where table_name='spolky_events' and column_name='emoji'"` returns no rows, so production is unchanged.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261010120000_event_emoji.sql src/types/events.ts src/api/mapEvents.ts src/api/societyPosts.ts src/components/CampusMap/composerPost.ts src/api/__tests__ src/components/CampusMap/__tests__/composerPost.test.ts
git commit -m "feat(events): spolky_events.emoji, read and written with the event

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Draw the event's emoji; drop the category line from the card

**Files:**
- Modify: `src/components/CampusMap/EventPin.tsx:3,25`
- Modify: `src/components/CampusMap/EventRow.tsx` (import, the `<img src=...>` in the fallback tile)
- Modify: `src/components/mobile/screens/map/MapSheetPeek.tsx:1,68`
- Modify: `src/components/CampusMap/EventDetailCard.tsx:2,80-85`
- Modify: `src/data/eventCategories.ts` (remove `CATEGORY_EMOJI_SRC`)
- Modify: `src/data/__tests__/eventCategories.test.ts`
- Test: `src/components/CampusMap/__tests__/EventPin.test.tsx`, `EventRow.test.tsx`, `EventDetailCard.test.tsx`

**Interfaces:**
- Consumes: `eventEmojiSrc(e)` (Task 1), `MapEvent.emoji` (Task 2).
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

`EventPin.test.tsx`, inside `describe('EventPin')`, using the file's `group()` and `ev()` helpers:

```tsx
it("draws the event's own emoji over its category's", () => {
  const { container } = render(
    <EventPin
      group={group([{ ...ev('Bruslení', 'sports'), emoji: '26f8' }])}
      x={100}
      y={100}
      selected={false}
      locale="en-US"
      onSelect={() => {}}
    />
  );
  expect(container.querySelector('img')?.getAttribute('src')).toBe('/emoji/26f8.svg');
});
```

`EventRow.test.tsx`, using the file's `ev` fixture and `t`:

```tsx
it("shows the event's own emoji in the tile", () => {
  render(
    <EventRow event={{ ...ev, imageUrl: null, emoji: '1f3d3' }} locale="cs-CZ" t={t} selected={false} onClick={() => {}} />
  );
  expect(document.querySelector('img[src="/emoji/1f3d3.svg"]')).toBeTruthy();
});
```

`EventDetailCard.test.tsx`:

```ts
// The category word was wrong as often as the picture, and the title already
// says what the event is (spec 2026-10-08-event-emoji-design).
it('does not name a category', () => {
  render(<EventDetailCard event={{ ...ev, category: 'party' }} />);
  expect(screen.queryByText('Párty')).toBeNull();
  expect(screen.queryByText('Party')).toBeNull();
});
```

(`ev` is that file's existing fixture.) Remove any existing assertion in that file that expects the category label.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/CampusMap/__tests__/EventPin.test.tsx src/components/CampusMap/__tests__/EventRow.test.tsx src/components/CampusMap/__tests__/EventDetailCard.test.tsx`
Expected: the three new tests FAIL.

- [ ] **Step 3: Implement**

`EventPin.tsx`: replace the import of `CATEGORY_EMOJI_SRC, CATEGORY_COLOR` with

```ts
import { CATEGORY_COLOR } from '../../data/eventCategories';
import { eventEmojiSrc } from '../../data/eventEmoji';
```

and `const emojiSrc = CATEGORY_EMOJI_SRC[lead.category];` with `const emojiSrc = eventEmojiSrc(lead);`.

`EventRow.tsx`: replace `import { CATEGORY_EMOJI_SRC } from '../../data/eventCategories';` with `import { eventEmojiSrc } from '../../data/eventEmoji';`, and `src={CATEGORY_EMOJI_SRC[event.category]}` with `src={eventEmojiSrc(event)}`.

`MapSheetPeek.tsx`: the same swap: import `eventEmojiSrc` from `'../../../../data/eventEmoji'`, and `src={eventEmojiSrc(next)}`.

`EventDetailCard.tsx`: delete the `CATEGORY_EMOJI_SRC` import and this block from "the facts":

```tsx
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <img src={CATEGORY_EMOJI_SRC[event.category]} alt="" className="h-4 w-4 shrink-0" />
            <span>{t(`map.category.${event.category}`)}</span>
          </div>
```

Update the header comment's list "the facts (when / what / where)" to "the facts (when / where)".

`src/data/eventCategories.ts`: delete `CATEGORY_EMOJI_SRC` and its comment. In `src/data/__tests__/eventCategories.test.ts`, drop `CATEGORY_EMOJI_SRC` from the import and remove its `toMatch(/^\/emoji\/.../)` line.

- [ ] **Step 4: Confirm nothing else reads the removed export**

Run: `git grep -n "CATEGORY_EMOJI_SRC" -- src`
Expected: no output.

- [ ] **Step 5: Run the tests and typecheck**

Run: `npx vitest run src/components/CampusMap src/components/mobile/screens/map src/data && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/CampusMap src/components/mobile/screens/map/MapSheetPeek.tsx src/data
git commit -m "feat(events): pins and rows draw the event's own emoji; the card drops the category word

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Composer emoji picker

**Files:**
- Create: `src/components/CampusMap/ComposerEmojiField.tsx`
- Create: `src/components/CampusMap/__tests__/ComposerEmojiField.test.tsx`
- Delete: `src/components/CampusMap/ComposerCategoryField.tsx`
- Modify: `src/components/CampusMap/composerRules.ts:5-17,42-60` (`ComposerDraft`, `buildPostInput`)
- Modify: `src/components/CampusMap/composerPost.ts:61-77` (`latestCategory` → `latestEmoji`)
- Modify: `src/components/CampusMap/EventComposer.tsx:65-67,100-112,203-204`
- Modify: `src/data/eventCategories.ts` (remove `CATEGORY_ICON` and `EVENT_CATEGORIES` once unread)
- Test: `src/components/CampusMap/__tests__/EventComposer.test.tsx`, `composerRules.test.ts`, `composerPost.test.ts`

**Interfaces:**
- Consumes: `EVENT_EMOJI`, `EMOJI_GROUPS`, `findEventEmoji`, `eventEmojiCode`, `CATEGORY_EMOJI_CODE` (Task 1); `PostInput.emoji` (Task 2).
- Produces:
  - `ComposerEmojiField({ value: string; onChange: (code: string) => void; t; language: 'cz' | 'en' })`
  - `ComposerDraft.emoji: string`, replacing `ComposerDraft.category`
  - `latestEmoji(posts: ReadonlyArray<{ date: string; category: string; emoji?: string | null }>): string | null`

- [ ] **Step 1: Write the failing picker test**

`src/components/CampusMap/__tests__/ComposerEmojiField.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposerEmojiField } from '../ComposerEmojiField';

const t = (k: string) =>
  ({
    'map.emojiChange': 'Změnit obrázek',
    'map.emojiGroup.sport': 'Sport',
  })[k] ?? k;

describe('ComposerEmojiField', () => {
  it('shows the chosen emoji and its name, with the grid closed', () => {
    render(<ComposerEmojiField value="26f8" onChange={() => {}} t={t} language="cz" />);
    expect(screen.getByRole('button', { name: /Bruslení/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Fotbal' })).toBeNull();
  });

  it('opens the grid, picks an emoji and closes', () => {
    const onChange = vi.fn();
    render(<ComposerEmojiField value="1f389" onChange={onChange} t={t} language="cz" />);
    fireEvent.click(screen.getByRole('button', { name: /Párty/ }));
    expect(screen.getByText('Sport')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fotbal' }));
    expect(onChange).toHaveBeenCalledWith('26bd');
    expect(screen.queryByRole('button', { name: 'Fotbal' })).toBeNull();
  });

  it('marks the current emoji as pressed in the grid', () => {
    render(<ComposerEmojiField value="26bd" onChange={() => {}} t={t} language="en" />);
    fireEvent.click(screen.getByRole('button', { name: /Football/ }));
    expect(screen.getByRole('button', { name: 'Football', pressed: true })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/CampusMap/__tests__/ComposerEmojiField.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the picker**

`src/components/CampusMap/ComposerEmojiField.tsx`:

```tsx
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { EVENT_EMOJI, EMOJI_GROUPS, findEventEmoji } from '../../data/eventEmoji';

/**
 * The composer's picture for an event: the chosen emoji and its name, opening
 * a grouped grid of the shipped catalog. Picking one closes the grid. Its
 * category follows from the catalog (buildPostInput), so there is no second
 * control for the fallback older builds read.
 */
export function ComposerEmojiField({
  value,
  onChange,
  t,
  language,
}: {
  value: string;
  onChange: (code: string) => void;
  t: (k: string) => string;
  language: 'cz' | 'en';
}) {
  const [open, setOpen] = useState(false);
  const current = findEventEmoji(value);
  const name = (code: string) => {
    const e = findEventEmoji(code);
    return e ? e[language] : code;
  };
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${current ? name(value) : value} · ${t('map.emojiChange')}`}
        className="btn btn-ghost btn-sm gap-2 border border-base-content/15"
        onClick={() => setOpen((o) => !o)}
      >
        <img src={`/emoji/${current?.code ?? '2728'}.svg`} alt="" className="h-5 w-5" />
        <span>{current ? name(value) : value}</span>
        <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-base-content/10 p-2">
          {EMOJI_GROUPS.map((g) => (
            <div key={g}>
              <div className="mb-1 text-xs font-semibold text-base-content/70">
                {t(`map.emojiGroup.${g}`)}
              </div>
              <div className="flex flex-wrap gap-1">
                {EVENT_EMOJI.filter((e) => e.group === g).map((e) => (
                  <button
                    key={e.code}
                    type="button"
                    aria-label={e[language]}
                    aria-pressed={e.code === value}
                    title={e[language]}
                    className={`btn btn-square btn-sm ${e.code === value ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => {
                      onChange(e.code);
                      setOpen(false);
                    }}
                  >
                    <img src={`/emoji/${e.code}.svg`} alt="" className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the picker test**

Run: `npx vitest run src/components/CampusMap/__tests__/ComposerEmojiField.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing draft and default tests**

`composerRules.test.ts`: in its draft fixture, replace `category: '<x>'` with `emoji: '1f3d3'`, and add:

```ts
it('files the event under the category its emoji maps to', () => {
  const input = buildPostInput({ ...draft, emoji: '26f8' });
  expect(input.emoji).toBe('26f8');
  expect(input.category).toBe('sports');
});
```

`composerPost.test.ts`: replace the `latestCategory` import and tests with:

```ts
describe('latestEmoji', () => {
  it("starts on the latest-dated event's emoji", () =>
    expect(
      latestEmoji([
        { date: '2026-07-01', category: 'party', emoji: '1f389' },
        { date: '2026-07-20', category: 'boardgames', emoji: '265f' },
      ])
    ).toBe('265f'));
  it("falls back to that event's category emoji", () =>
    expect(latestEmoji([{ date: '2026-07-20', category: 'quiz', emoji: null }])).toBe('1f9e0'));
  it('is null for a society that never posted', () => expect(latestEmoji([])).toBeNull());
});
```

`EventComposer.test.tsx`:
- In `'publishes with the category chosen in the picker'`, rename the test to `'publishes with the emoji chosen in the picker'` and replace the `Kvíz` click and the final expectation with:

```ts
    fireEvent.click(screen.getByRole('button', { name: /Párty/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Kvíz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0]).toMatchObject({ emoji: '1f9e0', category: 'quiz' });
```

- Replace the describe `'EventComposer — the category a society usually picks'` with:

```ts
describe('EventComposer — the picture a society usually picks', () => {
  it('starts on the emoji of the society’s latest event', () => {
    useAppStore.setState({
      draftCoord: [16.61, 49.21],
      societyPosts: [
        { id: 'p1', date: '2026-07-01', category: 'party', emoji: null },
        { id: 'p2', date: '2026-07-20', category: 'boardgames', emoji: null },
      ],
    } as never);
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByRole('button', { name: /Deskovky/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('starts on Párty for a society that has never posted', () => {
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByRole('button', { name: /Párty/ })).toBeInTheDocument();
  });
});
```

- Every other `category: '...'` in this file's fixtures stays; the tests that assert `patch.category` (line ~185) keep passing, because editing an event with no emoji starts on its category's emoji, which maps back to the same category.

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run src/components/CampusMap/__tests__/composerRules.test.ts src/components/CampusMap/__tests__/composerPost.test.ts src/components/CampusMap/__tests__/EventComposer.test.tsx`
Expected: FAIL (`latestEmoji` missing, `emoji` not on the draft, no picker in the composer).

- [ ] **Step 7: Implement the draft, the default and the composer**

`composerRules.ts`: in `ComposerDraft` replace `category: EventCategory;` with `emoji: string;`. In `buildPostInput` replace `category: d.category,` with:

```ts
    // The catalog decides the category older builds file it under.
    category: findEventEmoji(d.emoji)?.category ?? 'other',
    emoji: d.emoji,
```

Add `import { findEventEmoji } from '../../data/eventEmoji';` and drop the `EventCategory` import if it is now unused.

`composerPost.ts`: replace `latestCategory` (with its doc comment) by:

```ts
/**
 * The emoji of the society's latest-dated event: what a new one starts on,
 * since most societies run one kind of thing (Deskovky, a quiz night). Its
 * category's emoji when that event has none; null for a first event.
 */
export function latestEmoji(
  posts: ReadonlyArray<{ date: string; category: string; emoji?: string | null }>
): string | null {
  const latest = posts.reduce<(typeof posts)[number] | null>(
    (best, p) => (!best || p.date > best.date ? p : best),
    null
  );
  return latest ? eventEmojiCode({ emoji: latest.emoji, category: latest.category as EventCategory }) : null;
}
```

with `import { eventEmojiCode } from '../../data/eventEmoji';`, and remove the `EVENT_CATEGORIES` import.

`EventComposer.tsx`:
- Replace the `category` state with:

```ts
  const [emoji, setEmoji] = useState<string>(
    source ? eventEmojiCode(source) : (latestEmoji(posts) ?? CATEGORY_EMOJI_CODE.party)
  );
```

- In `buildPostInput({...})` replace `category,` with `emoji,`.
- Replace the field (around line 203):

```tsx
      <label className={LABEL}>{t('map.emojiPickerLabel')}</label>
      <ComposerEmojiField value={emoji} onChange={setEmoji} t={t} language={language} />
```

- Imports: drop `ComposerCategoryField`, `latestCategory` and `EventCategory` (if unused). Add `ComposerEmojiField`, `latestEmoji`, and `eventEmojiCode, CATEGORY_EMOJI_CODE` from `'../../data/eventEmoji'`. Read `language` from the component's existing `useTranslation()` call (add it to the destructure if it only takes `t`).

Delete `src/components/CampusMap/ComposerCategoryField.tsx`.

- [ ] **Step 8: Remove what nothing reads any more**

Run: `git grep -n "CATEGORY_ICON\|EVENT_CATEGORIES\|latestCategory\|ComposerCategoryField\|map.categoryLabel" -- src`
For each export with no remaining reader outside `src/data/eventCategories.ts` and its test, delete it (and its lucide imports) from `eventCategories.ts`, and drop its assertions from `eventCategories.test.ts`. Remove `"categoryLabel"` from both locale files if unused. `CATEGORY_COLOR` stays (the pin ring).

- [ ] **Step 9: Run the tests and typecheck**

Run: `npx vitest run src/components/CampusMap src/data src/components/AdminConsole && npm run typecheck`
Expected: PASS. The composer file stays under ~230 lines (it was 230).

- [ ] **Step 10: Commit**

```bash
git add -A src/components/CampusMap src/data src/i18n/locales
git commit -m "feat(events): the composer picks an emoji, and its category follows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Production backfill script, verification, PR

**Files:**
- Create: `supabase/backfills/20261010_event_emoji.sql`

**Interfaces:**
- Consumes: catalog codes (Task 1), column (Task 2).

- [ ] **Step 1: Write the backfill**

`supabase/backfills/20261010_event_emoji.sql`:

```sql
-- One emoji per production event, and a better legacy category where one
-- exists (builds 5.1.1–5.3.0 still draw the category). Apply only after
-- 20261010120000_event_emoji.sql, and only with Dominik's yes:
--   npx supabase db query --linked -f supabase/backfills/20261010_event_emoji.sql
-- 'Bruch s USAFem' (usaf) stays null: unknown event type, falls back to culture.
begin;
update public.spolky_events as e set emoji = v.emoji, category = v.category
from (values
  ('au_frrms', 'Kvíz v S-klubu', '1f9e0', 'quiz'),
  ('au_frrms', 'Filipínský den + fotbálek v Sklubu', '1f1f5-1f1ed', 'culture'),
  ('au_frrms', 'Půlení semestru na fakultě', '1f389', 'party'),
  ('au_frrms', 'Prezentace Costarica + fotbálek', '1f1e8-1f1f7', 'culture'),
  ('au_frrms', 'Deskovky v Sklubu', '1f3b2', 'boardgames'),
  ('au_frrms', 'AU Kvíz', '1f9e0', 'quiz'),
  ('esn', 'Flag Party', '1f389', 'party'),
  ('esn', 'BYO Picnic (B - bring, Y - your, O - own)', '1f9fa', 'social'),
  ('esn', 'City Game (bring a pen)', '1f5fa', 'other'),
  ('esn', 'Erasmus Cup: Football', '26bd', 'sports'),
  ('esn', 'Historical fencing', '1f93a', 'sports'),
  ('esn', 'Brno United Karaoke', '1f3a4', 'karaoke'),
  ('esn', 'Country Presentation', '1f30d', 'culture'),
  ('esn', 'Boat Party', '1f6a2', 'party'),
  ('esn', 'Pub Quiz', '1f9e0', 'quiz'),
  ('esn', 'Beerpong', '1f3d3', 'social'),
  ('esn', 'Erasmus Cup: Volleyball', '1f3d0', 'sports'),
  ('esn', 'Beer Marathon', '1f37a', 'social'),
  ('esn', 'Erasmus Cup: Padel', '1f3be', 'sports'),
  ('esn', 'International Market', '1f6cd', 'culture'),
  ('esn', 'Halloween party', '1f383', 'party'),
  ('esn', 'Board games', '1f3b2', 'boardgames'),
  ('esn', 'Starobrno excursion', '1f37a', 'trip'),
  ('esn', 'Tram Party', '1f68b', 'party'),
  ('esn', 'Timetravels trip to Finland', '1f1eb-1f1ee', 'trip'),
  ('esn', 'Erasmus Cup: Basketball', '1f3c0', 'sports'),
  ('esn', 'Trip to Olomouc', '1f68c', 'trip'),
  ('esn', 'St. Nicholas visit', '1f385', 'culture'),
  ('esn', 'Christmas market', '1f384', 'culture'),
  ('esn', 'Ice skating', '26f8', 'sports'),
  ('esn', 'Trip to Prague', '1f68c', 'trip'),
  ('esn', 'Timetravels trip to Sweden', '1f1f8-1f1ea', 'trip'),
  ('esn', 'Christmas dinner', '1f37d', 'social'),
  ('esn', 'Goodbye party', '1f44b', 'party'),
  ('esn', 'Erasmus awards', '1f3c6', 'other'),
  ('supef', 'Deskovky', '1f3b2', 'boardgames'),
  ('supef', 'Deskovky — test notifikace', '1f3b2', 'boardgames'),
  ('supef', 'Filmový klub', '1f3ac', 'film'),
  ('supef', 'Tour de Pub', '1f37b', 'social'),
  ('supef', 'Redbull Felite Gamenight', '1f3ae', 'other'),
  ('supef', 'Beerpong', '1f3d3', 'social'),
  ('supef', 'PEF Quiz', '1f9e0', 'quiz'),
  ('supef', 'Tour de Svařák', '1f377', 'social'),
  ('supef', 'Pro Dobro Vánoc', '1f381', 'other'),
  ('supef', 'Karneval na ledu', '26f8', 'sports')
) as v(association_id, title, emoji, category)
where e.association_id = v.association_id and e.title = v.title;

-- Every row but the one deliberately left out must now carry an emoji.
do $$
declare missing int;
begin
  select count(*) into missing from public.spolky_events
   where emoji is null and not (association_id = 'usaf' and title = 'Bruch s USAFem');
  if missing > 0 then raise exception '% rows still without an emoji', missing; end if;
end $$;
commit;
```

- [ ] **Step 2: Check every backfill code is in the catalog**

Run:

```bash
grep -oE "'[0-9a-f]{2,6}(-[0-9a-f]{2,6})*'" supabase/backfills/20261010_event_emoji.sql | tr -d "'" | sort -u | while read -r c; do test -f "public/emoji/$c.svg" || echo "MISSING $c"; done
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add supabase/backfills/20261010_event_emoji.sql
git commit -m "chore(events): backfill an emoji for every production event

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Verify on screen with emoji seeded**

The dev map reads production, where the column does not exist yet, so seed the events. Start `reis-webapp` with `preview_start` (note its port), then:

```bash
D=$(date -v+1d +%F)
SEED=$(node -e '
const d = process.argv[1];
const mk = (id, title, emoji, category) => ({ id, title, emoji, category, url: "", date: d, endDate: null,
  time: null, location: null, imageUrl: null, organizerKey: "pef", societyId: "supef", coord: null,
  roomCode: null, venueKind: "tba", description: null, subscribersOnly: false });
console.log(JSON.stringify({ mapEventsLoaded: true, mapEvents: [
  mk("e1", "Karneval na ledu", "26f8", "sports"),
  mk("e2", "Beerpong", "1f3d3", "social"),
  mk("e3", "Trip to Finland", "1f1eb-1f1ee", "trip") ] }));' "$D")
npm run verify:ui -- emoji-akce --view map --click "Rozbalit panel mapy" --wait 2500 --url http://localhost:<port> --seed-store "$SEED"
```

then the same with `--widths 834,1024,1194 --url http://localhost:<port>/?mobile=1` and with `--widths 1280 --url http://localhost:<port>/?mobile=0`. Expected: no findings, and the frames show ⛸️, 🏓 and 🇫🇮 in the rows. Then open the admin console composer (`reis-webapp-reis-admin` with the seed from the verify-ui recipes memory) at 390 and 1280, `--click "Párty"` to open the grid, and check it scrolls inside its own box without overflowing. Send the before/after PNGs to Dominik with SendUserFile.

- [ ] **Step 5: Push and record**

```bash
git push personal claude/society-events-emoji
```

Do not open the PR until #515 has merged. Then: `gh pr create --base test` as ElijaahInverted, enable Auto-fix, and put the order in the PR body:
1. Merge.
2. With Dominik's yes, apply `supabase/migrations/20261010120000_event_emoji.sql`.
3. Then apply `supabase/backfills/20261010_event_emoji.sql`.
4. Ask Dominik separately whether to delete the test row "Deskovky — test notifikace".

The device check is on the Pixel 9a via `npm run android:push`, after the backfill.

---

## Self-review notes

- Spec coverage: column (T2), catalog + assets + attribution (T1), rendering + fallback (T3), card drops the category (T3), composer picker with derived category (T4), released-build safety (CHECK kept, category corrected in T5), backfill (T5), test row left for approval (T5 step 5). No privacy change, so no `privacy/disclosures.ts` edit.
- Type names used across tasks: `eventEmojiSrc`, `eventEmojiCode`, `findEventEmoji`, `CATEGORY_EMOJI_CODE`, `EVENT_EMOJI`, `EMOJI_GROUPS`, `latestEmoji`, `ComposerEmojiField`, `ComposerDraft.emoji`, `PostInput.emoji`, `MapEvent.emoji`.
