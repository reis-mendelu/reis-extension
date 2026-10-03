import type { Odevzdavarna } from '../../api/odevzdavarny';
import { useAppStore } from '../../store/useAppStore';
import { splitBoxes } from '../../utils/submissionBoxes';
import { SubmissionBoxCard } from './SubmissionBoxCard';
import { ClosedBoxes } from './ClosedBoxes';
import { useBoxLabels } from './useBoxLabels';

/**
 * A subject's submission boxes — open ones as cards, soonest first, then the
 * closed ones folded away. Read-only: every action is a link into IS.
 * Rendered by ZaznamnikTab, so the extension, phone and iPad share it.
 */
export function SubmissionBoxList({ boxes }: { boxes: Odevzdavarna[] }) {
  const L = useBoxLabels();
  const now = useAppStore((s) => s.now).getTime();
  if (boxes.length === 0) return null;
  const { open, closed } = splitBoxes(boxes, now);

  return (
    <section className="space-y-2" data-testid="submission-boxes">
      <p className="text-[11px] font-bold uppercase tracking-wider text-base-content/70">
        {L.t('odevzdavarny.title')} · {boxes.length}
      </p>
      {open.map((box, i) => (
        <SubmissionBoxCard
          key={box.odevzdavarnaId || `${box.name}-${i}`}
          box={box}
          now={now}
          testId={`submission-box-${box.odevzdavarnaId || i}`}
        />
      ))}
      <ClosedBoxes boxes={closed} />
    </section>
  );
}
