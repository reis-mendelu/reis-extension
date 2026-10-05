import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Odevzdavarna } from '../../api/odevzdavarny';
import { useAppStore } from '../../store/useAppStore';
import { boxCourseCode, boxesDueSoon, splitBoxes } from '../../utils/submissionBoxes';
import { SummaryBoxRow } from './SummaryBoxRow';
import { useBoxLabels } from './useBoxLabels';

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
 * Compact by default: teachers leave some boxes open all year, so listing
 * every open box up front would become a permanent wall. Collapsed, rows are
 * only boxes with nothing uploaded and a deadline in the next 14 days, at
 * most three. But "3 open" with nothing listed left the student asking which
 * ones, so the open count is a disclosure: expanded, it replaces those rows
 * with every open box, soonest first, with its upload state. It is offered
 * only when it would show something the collapsed card does not.
 */
export function SubmissionBoxesSummary({ onOpen, className = '' }: SubmissionBoxesSummaryProps) {
  const L = useBoxLabels();
  const boxes = useAppStore((s) => s.odevzdavarny);
  const subjects = useAppStore((s) => s.subjects?.data);
  const now = useAppStore((s) => s.now).getTime();
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const { open } = splitBoxes(boxes, now);
  if (open.length === 0) return null;
  const due = boxesDueSoon(boxes, now, WINDOW_DAYS).slice(0, MAX_ROWS);
  const canExpand = open.length > due.length;
  const showAll = canExpand && expanded;
  const rows = showAll ? open : due;

  return (
    <div
      data-testid="submission-boxes-summary"
      className={`rounded-2xl border border-base-300 bg-base-100 px-4 py-3 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{L.t('odevzdavarny.title')}</span>
        {canExpand ? (
          // -my/-mr keep a 44px target without making the header taller.
          <button
            type="button"
            data-testid="submission-boxes-toggle"
            aria-expanded={showAll}
            aria-controls={listId}
            onClick={() => setExpanded((v) => !v)}
            className="-my-3 -mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-[var(--tone-primary)] hover:bg-base-200"
          >
            {L.openCount(open.length)}
            <ChevronDown
              size={14}
              aria-hidden
              className={`transition-transform ${showAll ? 'rotate-180' : ''}`}
            />
          </button>
        ) : (
          <span className="text-xs text-base-content/70">{L.openCount(open.length)}</span>
        )}
      </div>
      <div id={listId}>
        {rows.length === 0 ? (
          <p className="mt-1 text-xs text-base-content/70">{L.t('odevzdavarny.nothingDueSoon')}</p>
        ) : (
          <ul className="mt-1.5">
            {rows.map((box, i) => (
              <li key={box.odevzdavarnaId || `${box.name}-${i}`}>
                <SummaryBoxRow
                  box={box}
                  now={now}
                  courseCode={boxCourseCode(box, subjects)}
                  onOpen={onOpen}
                  showUpload={showAll}
                  testId={showAll ? 'submission-open-row' : 'submission-due-row'}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
