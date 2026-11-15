import { Dumbbell } from 'lucide-react';
import type { Sport } from '../../types/campusMap';

/**
 * One glyph per sport. lucide-react (the app's icon set) has a dumbbell but no
 * basketball, football or ping-pong, so those three are Tabler Icons' outline
 * paths (v3.19.0, MIT, © Paweł Kuna), drawn the way lucide draws: 24-unit box,
 * currentColor, 2px round strokes.
 */
const PATHS: Record<Exclude<Sport, 'workout'>, string[]> = {
  basketball: [
    'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    'M5.65 5.65l12.7 12.7',
    'M5.65 18.35l12.7 -12.7',
    'M12 3a9 9 0 0 0 9 9',
    'M3 12a9 9 0 0 1 9 9',
  ],
  football: [
    'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    'M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55z',
    'M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45',
  ],
  pingpong: [
    'M12.718 20.713a7.64 7.64 0 0 1 -7.48 -12.755l.72 -.72a7.643 7.643 0 0 1 9.105 -1.283l2.387 -2.345a2.08 2.08 0 0 1 3.057 2.815l-.116 .126l-2.346 2.387a7.644 7.644 0 0 1 -1.052 8.864',
    'M14 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
    'M9.3 5.3l9.4 9.4',
  ],
};

export function SportIcon({ sport, size = 16 }: { sport: Sport; size?: number }) {
  if (sport === 'workout') return <Dumbbell size={size} aria-hidden="true" />;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[sport].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
