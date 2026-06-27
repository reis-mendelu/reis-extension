import {
  PartyPopper, Dices, Bus, Brain, Volleyball,
  Clapperboard, Mic, Globe, Beer, Sparkles, type LucideIcon,
} from 'lucide-react';
import type { EventCategory } from '../types/events';

// One lucide icon per category. Monochrome + consistent so the icon doubles as
// the map's legend (drawn in the society colour on the pin's white badge).
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

// Keyword → category, first match wins (specific before generic). The real
// backend will carry an organizer-picked category; this is the mock seam.
const RULES: Array<[EventCategory, RegExp]> = [
  ['boardgames', /deskov|board\s?game/i],
  ['trip', /\btrip\b|výlet|zájezd/i],
  ['quiz', /kvíz|quiz/i],
  ['karaoke', /karaoke/i],
  ['film', /film|movie|kino/i],
  ['sports', /sport|basket|volej|volley|fotbal|football|běh|\brun\b/i],
  ['culture', /country|\bden\b|\bday\b|prezentace|presentation|tématick|kultur/i],
  ['party', /party|párty|ples|ball|neon|tram|beer\s?pong|beerpong/i],
  ['social', /pub|tinder|tindelu|únikov|escape|seznam|mixer|drink/i],
];

export function inferCategory(title: string): EventCategory {
  for (const [cat, re] of RULES) if (re.test(title)) return cat;
  return 'other';
}
