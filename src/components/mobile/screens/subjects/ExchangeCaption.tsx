import { Info } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

/**
 * Why an exchange student sees a plain list and no credits: they have no study
 * plan, and the list comes from their subject folders instead. The same
 * sentence the extension's SubjectsPanel shows over its fallback.
 */
export function ExchangeCaption() {
  const { t } = useTranslation();
  return (
    <div
      data-testid="subjects-exchange-caption"
      className="flex flex-shrink-0 items-start gap-2 px-1 text-xs text-base-content/70"
    >
      <Info size={14} className="mt-0.5 flex-shrink-0" />
      <span>{t('subjects.noPlanExchange')}</span>
    </div>
  );
}
