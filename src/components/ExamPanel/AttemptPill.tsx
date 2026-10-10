import { CircleCheck, RotateCcw } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { AttemptType } from '../../utils/exams/attemptTypesIn';

// Literal class names so Tailwind ships them. The ink is the `--tone-*` token,
// not `text-warning`: raw warning amber on its own /10 tint is unreadable in
// the light theme, and the tone tokens are tuned per theme for exactly this.
const LOOK: Record<AttemptType, { tint: string; ink: string }> = {
  regular: { tint: 'bg-success/10', ink: 'text-[var(--tone-success)]' },
  retake1: { tint: 'bg-warning/10', ink: 'text-[var(--tone-warning)]' },
  retake2: { tint: 'bg-error/10', ink: 'text-[var(--tone-error)]' },
  retake3: { tint: 'bg-error/10', ink: 'text-[var(--tone-error)]' },
};

/**
 * One attempt a term tile counts as: a check for the regular term, a turn-back
 * arrow and a digit for a retake.
 *
 * Out of `TermTile`, which drew it twice (its wide and its narrow layout), so
 * `AttemptPillLegend` can show the very same mark. The `md:` steps are those
 * two layouts' sizes, folded into one element.
 *
 * `decorative` is for the legend, which prints the name beside the pill.
 */
export function AttemptPill({
  type,
  decorative = false,
}: {
  type: AttemptType;
  decorative?: boolean;
}) {
  const { t } = useTranslation();
  const { tint, ink } = LOOK[type];
  const icon = `h-[9px] w-[9px] md:h-2.5 md:w-2.5 ${ink}`;
  return (
    <div
      {...(decorative ? { 'aria-hidden': true } : { title: t(`successRate.${type}`) })}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 md:rounded-md md:px-2 ${tint}`}
    >
      {type === 'regular' ? (
        <CircleCheck className={icon} />
      ) : (
        <>
          <RotateCcw className={icon} />
          <span className={`text-[8px] font-black leading-none md:text-[9px] md:font-bold ${ink}`}>
            {type.slice(-1)}
          </span>
        </>
      )}
    </div>
  );
}
