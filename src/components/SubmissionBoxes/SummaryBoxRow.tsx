import type { Odevzdavarna } from '../../api/odevzdavarny';
import { boxDeadline } from '../../utils/submissionBoxes';
import { daysUntil, useBoxLabels } from './useBoxLabels';
import { useCourseName } from '../../hooks/ui/useCourseName';

/** Past this, a relative "za 118 d" stops reading; the date does. */
const RELATIVE_DAYS = 14;

interface SummaryBoxRowProps {
  box: Odevzdavarna;
  now: number;
  /** The subject to open, or null to fall back to the box in IS. */
  courseCode: string | null;
  onOpen: (courseCode: string, box: Odevzdavarna) => void;
  /**
   * Mark an uploaded box. Due rows never have files, so only the full open
   * list asks. Only "Odevzdáno" is marked: a "Nic neodevzdáno" on every other
   * row left the subject three letters wide at 320px.
   */
  showUpload: boolean;
  testId: string;
}

/** One box on the Subjects-screen card: the box, its subject, its deadline. */
export function SummaryBoxRow({
  box,
  now,
  courseCode,
  onOpen,
  showUpload,
  testId,
}: SummaryBoxRowProps) {
  const L = useBoxLabels();
  const subjectName = useCourseName(courseCode ?? undefined, L.courseName(box));
  const deadline = boxDeadline(box);
  const uploaded = box.fileCount > 0;
  const days = deadline ? daysUntil(deadline, now) : null;
  const urgent = !uploaded && days !== null && days <= 2;
  const rowClass =
    'flex min-h-11 w-full items-center justify-between gap-2 rounded-lg py-1 text-left text-xs hover:bg-base-200';
  const content = (
    <>
      {/* Two lines, each clipped as a block: the box first, since that is
          what is due, and its subject under it. One shared line left neither
          readable at 320px. */}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{box.name}</span>
        <span className="flex min-w-0 gap-1 text-[11px] text-base-content/70">
          <span className="truncate">{subjectName}</span>
          {showUpload && uploaded && (
            <span className="shrink-0 whitespace-nowrap font-medium text-[var(--tone-success)]">
              · {L.t('odevzdavarny.uploaded')}
            </span>
          )}
        </span>
      </span>
      {deadline && days !== null && (
        <span
          className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
            urgent
              ? 'bg-warning/20 text-[var(--tone-warning)]'
              : 'bg-base-content/8 text-base-content/70'
          }`}
        >
          {days <= RELATIVE_DAYS
            ? L.relative(deadline, now)
            : L.t('odevzdavarny.until', { date: L.shortDate(deadline) })}
        </span>
      )}
    </>
  );

  return courseCode ? (
    <button
      type="button"
      data-testid={testId}
      onClick={() => onOpen(courseCode, box)}
      className={rowClass}
    >
      {content}
    </button>
  ) : (
    // No subject to open (a row cached before course codes were stored, for
    // a subject the store does not know): go to IS.
    <a
      href={box.uploadUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      className={rowClass}
    >
      {content}
    </a>
  );
}
