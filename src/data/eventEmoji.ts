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
  'party',
  'games',
  'sport',
  'culture',
  'season',
  'travel',
  'other',
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
  e('1f950', 'social', 'party', 'Snídaně', 'Breakfast'),
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
