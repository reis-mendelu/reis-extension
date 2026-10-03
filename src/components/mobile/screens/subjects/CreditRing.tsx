import { useTranslation } from '../../../../hooks/useTranslation';

interface CreditRingProps {
  earned: number;
  total: number;
  /** Credits earned over the last two periods (`studyStats.creditsLastTwoPeriods`). */
  lastTwoPeriods?: number | null;
}

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
        {/* The count, with no denominator and no verdict: IS publishes how many
            credits the last two periods earned, not how many they had to, and
            the minimum differs by faculty. 0 is the parser's fallback for a
            missing row and what a first-semester student has, so it stays away. */}
        {lastTwoPeriods != null && lastTwoPeriods > 0 && (
          <span className="text-xs text-base-content/70">
            {`${t('subjects.creditsLastTwo')}: ${lastTwoPeriods}`}
          </span>
        )}
      </div>
    </div>
  );
}
