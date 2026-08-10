import type { ReactNode } from 'react';

export interface ScreenHeaderProps {
  /** Optional: omit where the title already says it. Student's "IS MENDELU
   *  v kapse" was a tagline rather than context, unlike the other screens'
   *  eyebrows, which carry the semester or exam period. */
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}

/** The shared screen title block: small eyebrow above a display-face title. */
export function ScreenHeader({ eyebrow, title, action }: ScreenHeaderProps) {
  return (
    // paddingTop carries --safe-top because this is the topmost element on every
    // mobile screen and targetSdk 36 forces edge-to-edge: without it the eyebrow
    // renders *underneath* the status bar and camera cutout (measured 48px on a
    // 1080x2392 device). A flat pt-5 was the bug.
    <div
      className="flex flex-shrink-0 items-end justify-between gap-3 px-5 pb-1"
      style={{ paddingTop: 'calc(1.25rem + var(--safe-top, 0px))' }}
    >
      {/* min-w-0 + truncate keeps the eyebrow on one line: a long one
                ("B-OI prez - ZS 2025/2026") wrapped at 320px and pushed the
                title out of line with the action button beside it. */}
      <div className="flex min-w-0 flex-col gap-0.5">
        {eyebrow && (
          <span className="truncate text-sm font-medium text-base-content/60">{eyebrow}</span>
        )}
        <span className="truncate font-display text-2xl font-extrabold tracking-tight">
          {title}
        </span>
      </div>
      {action}
    </div>
  );
}
