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
