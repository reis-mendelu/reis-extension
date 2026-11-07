import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Odevzdavarna } from '../../api/odevzdavarny';
import { useAppStore } from '../../store/useAppStore';
import { boxCourseCode, listedInZaznamnik } from '../../utils/submissionBoxes';
import { SummaryBoxRow } from './SummaryBoxRow';
import { useBoxLabels } from './useBoxLabels';

interface SubmittedBoxesProps {
  /** Handed-in boxes, latest deadline first (submittedBoxes). At least one. */
  boxes: Odevzdavarna[];
  now: number;
  onOpen: (courseCode: string, box: Odevzdavarna) => void;
  /** Under the open part: a rule sets the two apart. */
  divided: boolean;
}

/**
 * The card's "Odevzdáno (N)": what the student handed in this period, with the
 * points once IS lists them. Collapsed by default, one line: the card is about
 * what is still to do, and graded work otherwise showed only in each subject's
 * Záznamník ("reis neukazuje hotove a obodovane projekty", reIS Task List).
 */
export function SubmittedBoxes({ boxes, now, onOpen, divided }: SubmittedBoxesProps) {
  const L = useBoxLabels();
  const subjects = useAppStore((s) => s.subjects?.data);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  return (
    <div className={divided ? 'mt-2 border-t border-base-300' : 'mt-1'}>
      <button
        type="button"
        data-testid="submitted-boxes-toggle"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((v) => !v)}
        className="group -mx-2 flex min-h-11 w-[calc(100%+1rem)] cursor-pointer items-center justify-between gap-2 rounded-lg px-2 text-left text-xs font-semibold text-base-content/70 hover:bg-base-200"
      >
        <span>{L.t('odevzdavarny.submittedCount', { n: boxes.length })}</span>
        <ChevronDown
          size={14}
          aria-hidden
          className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      <div id={listId}>
        {expanded && (
          <ul>
            {boxes.map((box, i) => {
              const code = boxCourseCode(box, subjects);
              return (
                <li key={box.odevzdavarnaId || `${box.name}-${i}`}>
                  <SummaryBoxRow
                    box={box}
                    now={now}
                    courseCode={code}
                    opensSubject={listedInZaznamnik(code, box, subjects)}
                    onOpen={onOpen}
                    showUpload={false}
                    testId="submitted-box-row"
                    aside={
                      box.points ? (
                        <span className="shrink-0 whitespace-nowrap rounded-md bg-base-content/8 px-1.5 py-0.5 text-[11px] font-semibold">
                          {L.t('odevzdavarny.points', { n: box.points })}
                        </span>
                      ) : (
                        <span className="shrink-0 whitespace-nowrap text-[11px] text-base-content/70">
                          {L.t('odevzdavarny.awaitingGrading')}
                        </span>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
