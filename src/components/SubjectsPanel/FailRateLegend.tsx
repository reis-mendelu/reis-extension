import { useTranslation } from '@/hooks/useTranslation';

/**
 * What the bare percentage on a subject row means, said once for a whole list.
 *
 * The rows used to carry the words themselves — "prům. neúspěšnost 23 %" on
 * every unfulfilled subject. On a phone that is most of the row: "Prům
 * neúspěšnost zabírá strašně prostoru". Repeating a column's name on every
 * cell is what a header is for, so the label moved here and the row kept the
 * number.
 *
 * It is NOT a hover tooltip, which is the arrangement this replaced and which
 * a touch screen can never reveal (see SubjectRow.failRateLabel.test). The
 * pills keep `title`/`aria-label` for a mouse and a screen reader; this line is
 * what a thumb gets.
 */
export function FailRateLegend() {
  const { t } = useTranslation();
  return (
    <div
      data-testid="fail-rate-legend"
      className="flex items-center justify-end gap-1.5 text-[10px] text-base-content/70"
    >
      <span className="inline-block h-2 w-2 rounded-sm bg-base-content/20" aria-hidden="true" />
      <span>{t('subjects.failRateLegend')}</span>
    </div>
  );
}
