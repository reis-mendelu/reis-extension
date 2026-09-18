import { useTranslation } from '@/hooks/useTranslation';
import { failRateTone, failRateToneHover } from './failRateTone';

export interface FailRatePillProps {
  /** The pooled average, already computed — see computeFailRate. */
  rate: number;
  /** Opens the subject on its stats tab, where the number comes from. */
  onOpen: () => void;
}

/**
 * A subject's average fail rate, as the number and nothing else.
 *
 * Lives beside `FailRateLegend` because the two are halves of one idea: the
 * pill dropped the words "prům. neúspěšnost" so they could be said once per
 * list instead of on every unfulfilled row, where at 320px they were most of
 * the row's width. Changing one without the other leaves either an unexplained
 * number or a caption over nothing.
 *
 * `title`/`aria-label` name it for a mouse and a screen reader. That is an
 * extra, never the only route: the hover-only label this replaced was
 * `max-w-0 opacity-0` until `:hover`, which on a touch screen means never — the
 * iPad showed a bare colour-coded number with nothing to say what it measured.
 *
 * It hugs its number. `w-10` was tried, to line the pills into a column, and a
 * one-digit rate then floated in a pill with an empty half: "there's a large
 * left padding for some reason". The rows are ragged anyway — the pill follows
 * a flexible name — so the fixed width bought nothing.
 */
export function FailRatePill({ rate, onOpen }: FailRatePillProps) {
  const { t } = useTranslation();
  const label = `${t('subjects.failRateLabel')} ${rate} %`;
  return (
    <span
      title={label}
      aria-label={label}
      className={`group/fail flex items-center justify-center h-5 rounded text-[10px] font-medium tabular-nums tracking-wide shrink-0 cursor-pointer transition-colors px-1.5 ${failRateTone(
        rate
      )} ${failRateToneHover(rate)}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      {rate}%
    </span>
  );
}
