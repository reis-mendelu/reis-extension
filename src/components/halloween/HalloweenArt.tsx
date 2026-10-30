/**
 * The Halloween week's drawings (src/utils/halloween.ts). Decorative only:
 * every one is aria-hidden and takes no pointer events.
 *
 * The pumpkin carries its own oranges, like ReisLogo carries its lime. The bat,
 * spider and cobweb draw in `currentColor`, so the caller's `text-*` class gives
 * them the theme's ink in light and dark alike.
 */

interface ArtProps {
  className?: string;
}

const HIDDEN = { 'aria-hidden': true, focusable: false } as const;

/** The pumpkin's shapes on a 64×64 grid, shared by Pumpkin and ReisLogo. */
export function PumpkinShapes() {
  return (
    <>
      <path
        d="M33 14c0-5 3-8 7-9"
        stroke="#3f6212"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="20" cy="38" rx="13" ry="20" fill="#ea580c" />
      <ellipse cx="44" cy="38" rx="13" ry="20" fill="#ea580c" />
      <ellipse cx="32" cy="38" rx="13" ry="21" fill="#f97316" />
      <path
        d="M32 18c-3 6-3 34 0 40M32 18c3 6 3 34 0 40"
        stroke="#c2410c"
        strokeWidth="1.5"
        fill="none"
        opacity=".6"
      />
      <path d="M38 12c4-3 9-2 11 1-4 0-7 1-9 3z" fill="#65a30d" />
    </>
  );
}

export function Pumpkin({ className = 'h-6 w-6' }: ArtProps) {
  return (
    <svg {...HIDDEN} viewBox="0 0 64 64" className={className}>
      <PumpkinShapes />
    </svg>
  );
}

export function Bat({ className = 'h-4 w-8' }: ArtProps) {
  return (
    <svg {...HIDDEN} viewBox="0 0 64 32" className={className}>
      <path
        fill="currentColor"
        d="M32 10c2-4 4-4 5 0 3-1 6 0 7 3 3-6 10-9 20-8-5 3-7 7-6 12-4-2-8-1-10 3-2-3-6-4-9-2-2 2-4 4-7 5-3-1-5-3-7-5-3-2-7-1-9 2-2-4-6-5-10-3 1-5-1-9-6-12 10-1 17 2 20 8 1-3 4-4 7-3 1-4 3-4 5 0z"
      />
    </svg>
  );
}

/**
 * A spider on its thread. `thread` is the thread's length in the 30-wide
 * viewBox, so the caller sets the drop and the spider stays the same size.
 */
export function Spider({ thread, className }: ArtProps & { thread: number }) {
  const h = thread + 30;
  return (
    <svg {...HIDDEN} viewBox={`0 0 30 ${h}`} width={30} height={h} className={className}>
      <line x1="15" y1="0" x2="15" y2={thread} stroke="currentColor" strokeWidth="1" opacity=".4" />
      <g
        transform={`translate(15 ${thread + 12})`}
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      >
        <path d="M-4 -2l-7 -6l-2 5M-4 1l-9 -1l-2 6M-4 3l-7 5l-1 5M4 -2l7 -6l2 5M4 1l9 -1l2 6M4 3l7 5l1 5" />
        <ellipse rx="5" ry="6" fill="currentColor" stroke="none" />
        <circle cx="-2" cy="-2" r="1.2" fill="#f97316" stroke="none" />
        <circle cx="2" cy="-2" r="1.2" fill="#f97316" stroke="none" />
      </g>
    </svg>
  );
}

/** A corner cobweb anchored at the top-left; rotate it for other corners. */
export function Cobweb({ className = 'h-12 w-12' }: ArtProps) {
  return (
    <svg {...HIDDEN} viewBox="0 0 100 100" className={className}>
      <g stroke="currentColor" strokeWidth="1.2" fill="none">
        <path d="M0 0L100 100M0 0L70 100M0 0L100 30M0 0L40 100M0 0L100 60" />
        <path d="M15 0Q12 12 0 15M32 0Q26 25 0 32M50 0Q40 40 0 50M70 0Q55 55 0 70" />
      </g>
    </svg>
  );
}
