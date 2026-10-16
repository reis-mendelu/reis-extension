import { ExternalLink } from 'lucide-react';
import type { Odevzdavarna } from '../../api/odevzdavarny';
import { boxDeadline, boxState, type BoxState } from '../../utils/submissionBoxes';
import { daysUntil, useBoxLabels } from './useBoxLabels';

const STATUS_TONE: Record<BoxState, string | undefined> = {
  empty: undefined,
  unconfirmed: 'font-medium text-[var(--tone-warning)]',
  confirmed: 'font-medium text-[var(--tone-success)]',
};

const ACTION_LABEL: Record<BoxState, string> = {
  empty: 'odevzdavarny.submitInIs',
  unconfirmed: 'odevzdavarny.confirmInIs',
  confirmed: 'odevzdavarny.openInIs',
};

interface SubmissionBoxCardProps {
  box: Odevzdavarna;
  now: number;
  testId: string;
}

/**
 * One open box. The whole card is the link: uploading happens in IS, and a
 * card-sized target is what a thumb on the phone actually hits.
 */
export function SubmissionBoxCard({ box, now, testId }: SubmissionBoxCardProps) {
  const L = useBoxLabels();
  const deadline = boxDeadline(box);
  const state = boxState(box);
  const urgent = state !== 'confirmed' && deadline !== null && daysUntil(deadline, now) <= 2;

  return (
    <a
      href={box.uploadUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      className={`block rounded-xl border p-3 transition-colors ${
        urgent
          ? 'border-warning/40 bg-warning/10 hover:bg-warning/15'
          : 'border-base-300 bg-base-100 hover:bg-base-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-words text-sm font-semibold">{box.name}</span>
        {deadline && (
          <span
            className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
              urgent
                ? 'bg-warning/20 text-[var(--tone-warning)]'
                : 'bg-base-content/8 text-base-content/70'
            }`}
          >
            {L.relative(deadline, now)}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-1.5 text-xs text-base-content/70">
        {deadline && <span>{L.until(deadline)}</span>}
        {deadline && <span aria-hidden>·</span>}
        <span className={STATUS_TONE[state]}>
          {state === 'empty'
            ? L.t('odevzdavarny.nothingUploaded')
            : `${L.t(state === 'confirmed' ? 'odevzdavarny.uploaded' : 'odevzdavarny.unconfirmed')} · ${L.files(box.fileCount)}`}
        </span>
        {box.points && <span>· {L.t('odevzdavarny.points', { n: box.points })}</span>}
      </div>
      <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--tone-primary)]">
        {L.t(ACTION_LABEL[state])}
        <ExternalLink size={12} aria-hidden />
      </span>
    </a>
  );
}
