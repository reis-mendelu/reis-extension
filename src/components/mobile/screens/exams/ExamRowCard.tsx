import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type ExamAccent = 'success' | 'warning' | 'info' | 'neutral';

// Literal class names: Tailwind only ships classes it can find verbatim.
const ACCENT_BAR: Record<ExamAccent, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  neutral: 'bg-base-content/30',
};

export interface ExamRowCardProps {
  /** Bold first line — the subject ("Ekonometrie 1"). */
  title: string;
  /** Muted second line — the assessment type ("Průběžný test 1", "Zkouška"). */
  subtitle: string;
  /** Right column, first line: the date for a registered exam, the free-slot
   *  count for an open one. Carries the accent colour. */
  primaryMeta: string;
  /**
   * Whether that first line is something the student can act on.
   *
   * The success green means "this is yours" or "this is bookable". A section
   * whose registration has not opened is neither, and painting its opening date
   * the same green made the one group nobody can do anything with the loudest
   * thing in the list. Defaults to the accent, so every existing caller is
   * unchanged.
   */
  primaryTone?: 'accent' | 'muted';
  /** Right column, second line: room, or how many terms are on offer. */
  secondaryMeta: string;
  /**
   * The colour of the left bar, which says which group the row is in:
   * registered (success), still to open (warning), bookable (info). The bar is
   * the only always-on colour in the row, so it is what tells the three apart
   * at a glance — "ať se mezi tím user vyzná".
   */
  accent?: ExamAccent;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

/**
 * One exam row. The subject leads and the assessment type follows beneath it:
 * the subject is what a student recognises at a glance, while "Průběžný test 1"
 * is a label several subjects in the same list wear at once.
 *
 * (This row read the other way round until the phone screens were reviewed
 * against real exam-season data, where a column of "Průběžný test 1 / 2" told
 * the reader nothing about which course each belonged to.)
 *
 * The left accent bar is the only always-on colour in the row, so a glance down
 * the list reads as a column of markers rather than a wall of cards.
 */
export function ExamRowCard({
  title,
  subtitle,
  primaryMeta,
  primaryTone = 'accent',
  secondaryMeta,
  accent = 'success',
  expanded,
  onToggle,
  children,
}: ExamRowCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
      >
        <span
          data-testid="exam-accent"
          className={`h-8 w-1 flex-shrink-0 rounded-full ${ACCENT_BAR[accent]}`}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-md font-bold text-base-content">{title}</span>
          <span className="truncate text-2sm text-base-content/60">{subtitle}</span>
        </span>
        <span className="flex flex-shrink-0 flex-col items-end gap-0.5">
          {/* Each rendered only when there is something to say: an empty span
              still takes a line box, which pushed the remaining line off centre. */}
          {primaryMeta && (
            <span
              className={`whitespace-nowrap text-2sm font-bold ${
                primaryTone === 'muted' ? 'text-base-content/70' : 'text-[var(--tone-success)]'
              }`}
            >
              {primaryMeta}
            </span>
          )}
          {secondaryMeta && (
            <span className="whitespace-nowrap text-2sm text-base-content/60">{secondaryMeta}</span>
          )}
        </span>
        {expanded ? (
          <ChevronUp size={16} className="flex-shrink-0 text-base-content/40" />
        ) : (
          <ChevronDown size={16} className="flex-shrink-0 text-base-content/40" />
        )}
      </button>
      {expanded && children && <div className="flex flex-col gap-2 px-3.5 pb-3">{children}</div>}
    </div>
  );
}
