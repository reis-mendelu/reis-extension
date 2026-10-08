import type { EventCategory } from '../types/events';

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
