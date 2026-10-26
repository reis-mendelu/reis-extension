import { useTranslation } from '../../../../hooks/useTranslation';
import type { ExamTerm } from '../../../../types/exams';
import { attemptTypesIn } from '../../../../utils/exams/attemptTypesIn';
import { AttemptBadge } from './AttemptBadge';

/**
 * What the circles on a subject's term rows mean — "Ř Řádný · 1 1. opravný" —
 * said once, under the list.
 *
 * The badges carry their name only as `title`/`aria-label`, which a touch
 * screen never shows; this line is what a thumb gets (the same move as
 * `FailRateLegend`). It reuses `AttemptBadge` itself, so the key cannot drift
 * from the marks it explains, and names only the types these terms carry.
 * The extension's tiles get the same line from `AttemptPillLegend`.
 */
export function AttemptBadgeLegend({ terms }: { terms: readonly ExamTerm[] }) {
  const { t } = useTranslation();
  const types = attemptTypesIn(terms);
  if (types.length === 0) return null;
  return (
    // role="list": WebKit drops the list role from a `list-style: none` <ul>,
    // and VoiceOver would never announce the label.
    <ul
      role="list"
      aria-label={t('exams.attemptLegend')}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-xs text-base-content/70"
    >
      {types.map((type) => (
        <li key={type} className="flex items-center gap-1">
          <AttemptBadge type={type} decorative />
          <span>{t(`successRate.${type}`)}</span>
        </li>
      ))}
    </ul>
  );
}
