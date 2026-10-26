import { useTranslation } from '@/hooks/useTranslation';
import { isRealCredits } from './utils';

/**
 * A subject's credits, on the line under its name — at every width, in the
 * study plan and in the hardest-subjects card above it. The two used to place
 * the same number differently (under the name, beside the fail-rate chip, or a
 * column after it from `md:` up), so one screen showed it three ways.
 *
 * Render it as the next sibling of the name, inside the name's column. Hides
 * IS Mendelu's 999 "credits unknown" sentinel.
 */
export function SubjectCredits({ credits }: { credits: number }) {
  const { t } = useTranslation();
  if (!isRealCredits(credits)) return null;
  return (
    <span className="text-[11px] leading-none font-semibold text-base-content/80 mt-0.5">
      {credits} {t('subjects.creditsShort')}
    </span>
  );
}
