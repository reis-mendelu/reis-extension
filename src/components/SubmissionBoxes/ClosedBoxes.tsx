import type { Odevzdavarna } from '../../api/odevzdavarny';
import { boxDeadline } from '../../utils/submissionBoxes';
import { useBoxLabels } from './useBoxLabels';

/**
 * Boxes IS no longer takes files for, collapsed and in grey. Most of a
 * period's closed boxes are exam-date boxes the student never sat (one per
 * date), so an empty one reads "nic", never "missed".
 */
export function ClosedBoxes({ boxes }: { boxes: Odevzdavarna[] }) {
  const L = useBoxLabels();
  if (boxes.length === 0) return null;

  return (
    <details
      data-testid="submission-boxes-closed"
      className="rounded-xl border border-base-300 px-3 py-2"
    >
      <summary className="cursor-pointer py-1 text-xs font-semibold text-base-content/70">
        {L.t('odevzdavarny.closed')} · {boxes.length}
      </summary>
      <ul className="mt-1 divide-y divide-base-300">
        {boxes.map((box, i) => {
          const deadline = boxDeadline(box);
          const facts = [
            deadline ? L.shortDate(deadline) : '',
            box.fileCount > 0 ? L.files(box.fileCount) : L.t('odevzdavarny.nothing'),
            box.points ? L.t('odevzdavarny.points', { n: box.points }) : '',
          ].filter(Boolean);
          return (
            <li key={box.odevzdavarnaId || `${box.name}-${i}`}>
              <a
                href={box.uploadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-baseline justify-between gap-3 py-1.5 text-xs hover:text-[var(--tone-primary)]"
              >
                <span className="min-w-0 break-words">{box.name}</span>
                <span
                  className={`shrink-0 whitespace-nowrap ${box.fileCount > 0 ? 'text-base-content/80' : 'text-base-content/60'}`}
                >
                  {facts.join(' · ')}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
