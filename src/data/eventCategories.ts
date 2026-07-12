import {
  PartyPopper,
  Dices,
  Bus,
  Brain,
  Volleyball,
  Clapperboard,
  Mic,
  Globe,
  Beer,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { EventCategory } from '../types/events';

// Display order for the category picker (composer). 'party' leads because it's
// the most common society event and stays the default; 'other' trails as the
// catch-all.
export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'party',
  'social',
  'boardgames',
  'quiz',
  'sports',
  'film',
  'karaoke',
  'culture',
  'trip',
  'other',
];

// One lucide (outline) icon per category — used by the side list + detail card,
// where outline glyphs read best in a row of text (the Fluent convention:
// outline in lists, filled for emphasis).
export const CATEGORY_ICON: Record<EventCategory, LucideIcon> = {
  party: PartyPopper,
  boardgames: Dices,
  trip: Bus,
  quiz: Brain,
  sports: Volleyball,
  film: Clapperboard,
  karaoke: Mic,
  culture: Globe,
  social: Beer,
  other: Sparkles,
};

// A vivid colour per category — used for the small accents that aren't the emoji
// itself: the selected-pin ring and the hover-bubble date text. (The emoji on the
// pin carries its own full colour.)
export const CATEGORY_COLOR: Record<EventCategory, string> = {
  party: '#ec4899', // pink
  boardgames: '#6366f1', // indigo
  trip: '#14b8a6', // teal
  quiz: '#8b5cf6', // violet
  sports: '#f97316', // orange
  film: '#ef4444', // red
  karaoke: '#d946ef', // fuchsia
  culture: '#22c55e', // green
  social: '#f59e0b', // amber
  other: '#64748b', // slate
};

// One REAL full-colour emoji per category, shown inside the white map pin
// (EventPin) — Google-Maps place-marker style. We ship the Twemoji SVGs from
// public/emoji/<codepoint>.svg (served at the extension root, like /spolky/*)
// instead of rendering the OS emoji font: a fixed modern multicolour set that
// looks identical on every device (an old Android/Windows OS emoji is what read
// as "outdated" before). Confetti is multicolour, the brain pink, the globe
// blue/green, etc. — the colour lives in the emoji, not a tint.
export const CATEGORY_EMOJI_SRC: Record<EventCategory, string> = {
  party: '/emoji/1f389.svg', // 🎉
  boardgames: '/emoji/1f3b2.svg', // 🎲
  trip: '/emoji/1f68c.svg', // 🚌
  quiz: '/emoji/1f9e0.svg', // 🧠
  sports: '/emoji/1f3d0.svg', // 🏐
  film: '/emoji/1f3ac.svg', // 🎬
  karaoke: '/emoji/1f3a4.svg', // 🎤
  culture: '/emoji/1f30d.svg', // 🌍
  social: '/emoji/1f37b.svg', // 🍻
  other: '/emoji/2728.svg', // ✨
};
