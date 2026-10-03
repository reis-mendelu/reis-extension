import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { HeaderActions } from '../HeaderActions';

export interface ScreenHeaderProps {
  /** Optional: omit where the title already says it. Student's "IS MENDELU
   *  v kapse" was a tagline rather than context, unlike the other screens'
   *  eyebrows, which carry the semester or exam period. */
  eyebrow?: string;
  title: string;
  /**
   * The screen's OWN control, on its own row under the title — Subjects' study
   * plan button, Exams' registered count. Not beside the actions: four 40px
   * targets plus a text button overflows a 320px viewport.
   */
  below?: ReactNode;
  /**
   * Makes the title itself a control, with a return glyph beside it — the
   * calendar's way back to today. A glyph, not a pill: the header is full at a
   * date and three actions, and "Dnes" beside the date never fit at 375.
   */
  titleAction?: { label: string; onClick: () => void };
}

const TITLE_CLASS =
  'truncate font-display text-2xl font-extrabold tracking-tight max-[359px]:text-xl';

/**
 * The shared screen title block: small eyebrow above a display-face title,
 * with the four header actions on the right.
 *
 * `HeaderActions` is rendered HERE, not passed in by each screen. The vývěska,
 * notifications and settings buttons lived on the Calendar screen alone, so
 * three destinations were reachable from one of five tabs; making the actions
 * part of the header means a screen cannot render one without them.
 */
export function ScreenHeader({ eyebrow, title, below, titleAction }: ScreenHeaderProps) {
  return (
    // The top padding carries --safe-top because this is the topmost element on
    // every mobile screen and targetSdk 36 forces edge-to-edge: without it the
    // eyebrow renders *underneath* the status bar and camera cutout (measured
    // 48px on a 1080x2392 device). A flat pt-5 was the bug.
    //
    // A Tailwind arbitrary value rather than an inline style, matching
    // ScreenSkeleton's identical one: happy-dom's CSS parser rejects a calc()
    // containing a var() outright and leaves the style attribute EMPTY, so the
    // inline form could not be asserted on at all — which is why the map's
    // inset guard had to reach for the class instead.
    <div className="flex flex-shrink-0 flex-col gap-2 px-5 pb-1 pt-[calc(1.25rem_+_var(--safe-top,0px))]">
      <div className="flex items-end justify-between gap-3">
        {/* min-w-0 + truncate keeps the eyebrow on one line: a long one
                  ("B-OI prez - ZS 2025/2026") wrapped at 320px and pushed the
                  title out of line with the actions beside it. */}
        <div className="flex min-w-0 flex-col gap-0.5">
          {eyebrow && (
            <span className="truncate text-sm font-medium text-base-content/60">{eyebrow}</span>
          )}
          {titleAction ? (
            <button
              type="button"
              aria-label={`${title}, ${titleAction.label}`}
              onClick={titleAction.onClick}
              // Padding pulled back by an equal negative margin: a 44px target
              // without the header growing a line taller than the other tabs.
              className="-my-1.5 flex min-w-0 items-center gap-1.5 py-1.5 text-left"
            >
              <span className={TITLE_CLASS}>{title}</span>
              <RotateCcw
                size={20}
                strokeWidth={2.5}
                className="flex-shrink-0 text-[var(--tone-primary)]"
              />
            </button>
          ) : (
            <span className={TITLE_CLASS}>{title}</span>
          )}
        </div>
        <HeaderActions />
      </div>
      {below}
    </div>
  );
}
