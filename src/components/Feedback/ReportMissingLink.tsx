import { MessageSquarePlus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { ReportPrefillKey } from './reportPrefill';

/**
 * The "something missing?" button under an empty state fed by parsed IS data.
 * A broken parser renders a believable empty list rather than an error, so
 * this is where a student notices. Worded as a question because empty is
 * usually correct: an outlined button in neutral ink, so it reads as tappable
 * without the error or primary colour that would say the list is wrong.
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
      className={`btn btn-outline btn-sm min-h-11 h-auto gap-2 font-medium border-base-content/20 text-base-content ${className}`}
    >
      <MessageSquarePlus size={16} aria-hidden="true" />
      {t('feedback.reportLink')}
    </button>
  );
}
