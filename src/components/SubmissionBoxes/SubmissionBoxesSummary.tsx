import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Odevzdavarna } from '../../api/odevzdavarny';
import { useAppStore } from '../../store/useAppStore';
import {
  boxCourseCode,
  boxesDueSoon,
  listedInZaznamnik,
  splitBoxes,
  submittedBoxes,
} from '../../utils/submissionBoxes';
import { SummaryBoxRow } from './SummaryBoxRow';
import { SubmittedBoxes } from './SubmittedBoxes';
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
 * only boxes not yet handed in (nothing uploaded, or uploaded but not
 * confirmed in IS) with a deadline in the next 14 days, at most three. But "3 open" with nothing listed left the student asking which
 * ones, so the open count is a disclosure: expanded, it replaces those rows
 * with every open box, soonest first, with its upload state. It is offered
 * only when it would show something the collapsed card does not.
 *
 * Under it, "Odevzdáno (N)" lists what was handed in this period, graded or
 * not (SubmittedBoxes). With nothing open the card is that part alone; with
 * neither it is not shown.
 */
export function SubmissionBoxesSummary({ onOpen, className = '' }: SubmissionBoxesSummaryProps) {
  const L = useBoxLabels();
  const boxes = useAppStore((s) => s.odevzdavarny);
  const subjects = useAppStore((s) => s.subjects?.data);
  const now = useAppStore((s) => s.now).getTime();
  const obdobi = useAppStore((s) => s.obdobiId);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const { open } = splitBoxes(boxes, now);
  const submitted = submittedBoxes(boxes, now, obdobi);
  if (open.length === 0 && submitted.length === 0) return null;
  const due = boxesDueSoon(boxes, now, WINDOW_DAYS).slice(0, MAX_ROWS);
  const canExpand = open.length > due.length;
  const showAll = canExpand && expanded;
  const rows = showAll ? open : due;
  const title = <span className="text-sm font-semibold">{L.t('odevzdavarny.title')}</span>;
  // Part of the header, so a tap on it toggles too. Only ever collapsed:
  // expanded lists every open box, and there is at least one.
  const nothingDue = rows.length === 0 && (
    <span className="mt-1 block text-xs text-base-content/70">
      {L.t('odevzdavarny.nothingDueSoon')}
    </span>
  );

  return (
    <div
      data-testid="submission-boxes-summary"
      className={`rounded-2xl border border-base-300 bg-base-100 px-4 py-3 ${className}`}
    >
      {open.length === 0 ? (
        <div>{title}</div>
      ) : canExpand ? (
        // The whole header is the disclosure, not only the count: a tap on the
        // title or on "nothing due" did nothing. Negative margins with matching
        // padding reach the card's edges and keep a 44px target. Above rows it
        // stops where the list starts (-mb-1.5 = the list's mt-1.5): reaching
        // further would slide under the first row, which paints on top.
        <button
          type="button"
          data-testid="submission-boxes-toggle"
          aria-expanded={showAll}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
          className={`group -mx-4 -mt-3 block min-h-11 w-[calc(100%+2rem)] cursor-pointer rounded-2xl px-4 py-3 text-left ${
            rows.length > 0 ? '-mb-1.5' : '-mb-3'
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            {title}
            <span className="-my-1 -mr-2 inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--tone-primary)] group-hover:bg-base-200">
              {L.openCount(open.length)}
              <ChevronDown
                size={14}
                aria-hidden
                className={`transition-transform ${showAll ? 'rotate-180' : ''}`}
              />
            </span>
          </span>
          {nothingDue}
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            {title}
            <span className="text-xs text-base-content/70">{L.openCount(open.length)}</span>
          </div>
          {nothingDue}
        </>
      )}
      <div id={listId}>
        {rows.length > 0 && (
          <ul className="mt-1.5">
            {rows.map((box, i) => {
              const code = boxCourseCode(box, subjects);
              return (
                <li key={box.odevzdavarnaId || `${box.name}-${i}`}>
                  <SummaryBoxRow
                    box={box}
                    now={now}
                    courseCode={code}
                    opensSubject={listedInZaznamnik(code, box, subjects)}
                    onOpen={onOpen}
                    showUpload={showAll}
                    testId={showAll ? 'submission-open-row' : 'submission-due-row'}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {submitted.length > 0 && (
        <SubmittedBoxes boxes={submitted} now={now} onOpen={onOpen} divided={open.length > 0} />
      )}
    </div>
  );
}
