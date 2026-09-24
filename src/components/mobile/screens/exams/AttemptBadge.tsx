import { useTranslation } from '../../../../hooks/useTranslation';
import type { ExamTerm } from '../../../../types/exams';

type Attempt = NonNullable<ExamTerm['attemptTypes']>[number];

// Literal class names so Tailwind ships them. Coloured by how late the attempt
// is: the regular term green, the first retake amber, the last ones red — the
// same reading the desktop's attempt pills give with their icons.
const LOOK: Record<Attempt, string> = {
  regular: 'bg-success text-success-content',
  retake1: 'bg-warning text-warning-content',
  retake2: 'bg-error text-error-content',
  retake3: 'bg-error text-error-content',
};

/**
 * One attempt a term counts as, as a small filled circle: Ř (or R in English)
 * for the regular term, 1 / 2 / 3 for the retakes.
 *
 * It replaced the words "Řádný · 1. opravný" in the row's sub-line, which cost
 * the seat count its room on a phone. The glyph is the glance; the full name is
 * the element's accessible label and tooltip, so a screen reader and a
 * long-press still say "1. opravný".
 */
export function AttemptBadge({ type }: { type: Attempt }) {
  const { t } = useTranslation();
  const name = t(`successRate.${type}`);
  const glyph = type === 'regular' ? t('mobile.exams.attemptRegularShort') : type.slice(-1);
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none ${LOOK[type]}`}
    >
      {glyph}
    </span>
  );
}
