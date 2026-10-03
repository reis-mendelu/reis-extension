import type { Odevzdavarna } from '../../api/odevzdavarny';
import { useAppStore } from '../../store/useAppStore';
import { boxCourseCode, boxDeadline, boxesDueSoon, splitBoxes } from '../../utils/submissionBoxes';
import { daysUntil, useBoxLabels } from './useBoxLabels';

const WINDOW_DAYS = 14;
const MAX_ROWS = 3;

interface SubmissionBoxesSummaryProps {
  /** Open the subject on its Záznamník tab — each tree has its own drawer. */
  onOpen: (courseCode: string, box: Odevzdavarna) => void;
  className?: string;
}

/**
 * Every subject's boxes at a glance, for the Subjects screen on both trees.
 *
 * Deliberately compact: teachers leave some boxes open all year, so listing
 * every open box would become a permanent wall. Rows are only boxes with
 * nothing uploaded and a deadline in the next 14 days, at most three; the
 * rest show up in the count and in each subject's Záznamník tab.
 */
export function SubmissionBoxesSummary({ onOpen, className = '' }: SubmissionBoxesSummaryProps) {
  const L = useBoxLabels();
  const boxes = useAppStore((s) => s.odevzdavarny);
  const subjects = useAppStore((s) => s.subjects?.data);
  const now = useAppStore((s) => s.now).getTime();
  const { open } = splitBoxes(boxes, now);
  if (open.length === 0) return null;
  const due = boxesDueSoon(boxes, now, WINDOW_DAYS).slice(0, MAX_ROWS);

  return (
    <div
      data-testid="submission-boxes-summary"
      className={`rounded-2xl border border-base-300 bg-base-100 px-4 py-3 ${className}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{L.t('odevzdavarny.title')}</span>
        <span className="text-xs text-base-content/70">{L.openCount(open.length)}</span>
      </div>
      {due.length === 0 ? (
        <p className="mt-1 text-xs text-base-content/70">{L.t('odevzdavarny.nothingDueSoon')}</p>
      ) : (
        <ul className="mt-1.5">
          {due.map((box, i) => {
            const deadline = boxDeadline(box)!; // due rows always have one
            const urgent = daysUntil(deadline, now) <= 2;
            const code = boxCourseCode(box, subjects);
            const rowClass =
              'flex min-h-11 w-full items-center justify-between gap-2 rounded-lg py-1 text-left text-xs hover:bg-base-200';
            const content = (
              <>
                {/* Two lines, each clipped as a block: the box first, since that
                    is what is due, and its subject under it. One shared line
                    left neither readable at 320px. */}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{box.name}</span>
                  <span className="truncate text-[11px] text-base-content/70">
                    {L.courseName(box)}
                  </span>
                </span>
                <span
                  className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                    urgent
                      ? 'bg-warning/20 text-[var(--tone-warning)]'
                      : 'bg-base-content/8 text-base-content/70'
                  }`}
                >
                  {L.relative(deadline, now)}
                </span>
              </>
            );
            return (
              <li key={box.odevzdavarnaId || `${box.name}-${i}`}>
                {code ? (
                  <button
                    type="button"
                    data-testid="submission-due-row"
                    onClick={() => onOpen(code, box)}
                    className={rowClass}
                  >
                    {content}
                  </button>
                ) : (
                  // No subject to open (a row cached before course codes were
                  // stored, for a subject the store does not know): go to IS.
                  <a
                    href={box.uploadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="submission-due-row"
                    className={rowClass}
                  >
                    {content}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
