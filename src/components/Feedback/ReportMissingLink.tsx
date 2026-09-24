import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { ReportPrefillKey } from './reportPrefill';

/**
 * The quiet "something missing?" under an empty state fed by parsed IS data.
 * A broken parser renders a believable empty list rather than an error, so
 * this is where a student notices. Worded as a question because empty is
 * usually correct; never error-coloured.
 */
export function ReportMissingLink({
  prefill,
  className = '',
}: {
  prefill: ReportPrefillKey;
  className?: string;
}) {
  const { t } = useTranslation();
  const openReport = useAppStore((s) => s.openReport);
  return (
    <button
      type="button"
      onClick={() => openReport({ title: t(`feedback.prefill.${prefill}`) })}
      className={`btn btn-link btn-sm min-h-11 h-auto font-normal text-base-content/70 no-underline hover:underline ${className}`}
    >
      {t('feedback.reportLink')}
    </button>
  );
}
