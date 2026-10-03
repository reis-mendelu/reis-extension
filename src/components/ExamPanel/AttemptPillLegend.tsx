import { useTranslation } from '../../hooks/useTranslation';
import type { ExamTerm } from '../../types/exams';
import { attemptTypesIn } from '../../utils/exams/attemptTypesIn';
import { AttemptPill } from './AttemptPill';

/**
 * What the pills on a section's term tiles mean, said once under the expanded
 * list. Their names were a hover tooltip, which nothing on the tile announces.
 *
 * Reuses `AttemptPill`, so the key matches the tiles exactly, and names only
 * the types these terms carry. The phone's term rows get the same line from
 * `AttemptBadgeLegend`.
 *
 * The collapsed card's date chips (`TermsSummary`) are left out on purpose:
 * they mark only "retake or not", with no digit, so this key would not match
 * them — the legend appears where the pills do.
 */
export function AttemptPillLegend({ terms }: { terms: readonly ExamTerm[] }) {
  const { t } = useTranslation();
  const types = attemptTypesIn(terms);
  if (types.length === 0) return null;
  return (
    // role="list": WebKit drops the list role from a `list-style: none` <ul>,
    // and VoiceOver would never announce the label.
    <ul
      role="list"
      aria-label={t('exams.attemptLegend')}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-[10px] text-base-content/70"
    >
      {types.map((type) => (
        <li key={type} className="flex items-center gap-1">
          <AttemptPill type={type} decorative />
          <span>{t(`successRate.${type}`)}</span>
        </li>
      ))}
    </ul>
  );
}
