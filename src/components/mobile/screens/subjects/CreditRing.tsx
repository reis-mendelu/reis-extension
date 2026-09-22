import { useTranslation } from '../../../../hooks/useTranslation';

interface CreditRingProps {
  earned: number;
  total: number;
  /** Credits earned over the last two periods (`studyStats.creditsLastTwoPeriods`). */
  lastTwoPeriods?: number | null;
}

/**
 * The credits a student must earn over any two consecutive semesters to stay
 * enrolled at MENDELU. IS reports the count but not the requirement — the
 * desktop panel prints the bare number for that reason — so the bar lives here,
 * as the one policy fact the phone needs to say whether 47 is safe.
 */
export const MIN_CREDITS_LAST_TWO_PERIODS = 40;

/**
 * Credit-progress ring: a conic-gradient sized from earned/total credits, with
 * the percentage centred inside and the credit line beside it. The gradient
 * stop is the one place an inline style is legitimate here — it's data-driven,
 * not a fixed look.
 */
export function CreditRing({ earned, total, lastTwoPeriods }: CreditRingProps) {
  const { t } = useTranslation();
  const pct = total > 0 ? Math.min(100, Math.round((earned / total) * 100)) : 0;

  return (
    <div className="flex flex-shrink-0 items-center gap-4 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-card">
      <div
        role="img"
        aria-label={t('mobile.subjects.creditProgress', { pct })}
        className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--color-primary) 0% ${pct}%, var(--color-base-300) ${pct}% 100%)`,
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-base-100 font-display text-base font-bold text-base-content">
          {pct} %
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-semibold text-base-content">
          {t('mobile.subjects.creditsOf', { earned, total })}
        </span>
        {/* Under the total because it is the same kind of number with a
            sharper edge: short of 40 over two semesters and a student can be
            excluded. 0 is the parser's fallback for a missing row and what a
            first-semester student has — neither is a warning, so it stays away. */}
        {lastTwoPeriods != null && lastTwoPeriods > 0 && (
          <span
            className={`text-xs ${
              lastTwoPeriods >= MIN_CREDITS_LAST_TWO_PERIODS ? 'text-success' : 'text-warning'
            }`}
          >
            {`${t('subjects.creditsLastTwo')}: ${lastTwoPeriods}/${MIN_CREDITS_LAST_TWO_PERIODS}`}
          </span>
        )}
      </div>
    </div>
  );
}
