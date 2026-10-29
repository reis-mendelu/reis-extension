import type { Odevzdavarna } from '../../api/odevzdavarny';
import { useAppStore } from '../../store/useAppStore';
import { splitBoxes } from '../../utils/submissionBoxes';
import { boxKey } from '../../utils/newSubmissionBoxes';
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
  // Opening this tab marks the boxes seen straight away; the ones seen this
  // run keep the mark, so the visit the "Nová odevzdávárna" row led to has it.
  const unseen = useAppStore((s) => s.odevzdavarnyNew);
  const seen = useAppStore((s) => s.odevzdavarnySeenNew);
  if (boxes.length === 0) return null;
  const fresh = new Set([...unseen, ...seen]);
  const split = splitBoxes(boxes, now);
  const isNew = (b: Odevzdavarna) => fresh.has(boxKey(b));
  // New first, so the subject opens on the box its row was about.
  const open = [...split.open.filter(isNew), ...split.open.filter((b) => !isNew(b))];
  const { closed } = split;

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
          isNew={isNew(box)}
        />
      ))}
      <ClosedBoxes boxes={closed} />
    </section>
  );
}
