import type { ReactNode } from 'react';

/**
 * The round icon at the head of a fact on an event card (when, where). A place a student can open is
 * tinted in the brand colour so it reads as a control before it is read; a plain fact stays quiet.
 * Decorative: the words beside it say the same thing.
 */
export function EventFactChip({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${active ? 'bg-primary/15 text-primary' : 'bg-base-200 text-base-content/70 ring-1 ring-base-content/10'}`}
    >
      {children}
    </span>
  );
}
