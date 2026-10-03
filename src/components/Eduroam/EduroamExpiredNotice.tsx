import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDate } from '../../utils/date';

export interface EduroamExpiredNoticeProps {
  expiredAt: Date;
  onRenew: () => void;
  /** The surface's own body size: `text-sm` in the drawer, `text-base` on the phone. */
  className?: string;
}

/**
 * IS's eduroam certificate has expired, and IS never replaces it by itself.
 * Shared by the extension's drawer and the phone's sheet, so both offer the
 * same way out: the student's own tap generates a new one (`renew`). A
 * warning, not an error — nothing failed, and an expired certificate is dead on
 * every device, so replacing it costs the student nothing.
 */
export function EduroamExpiredNotice({
  expiredAt,
  onRenew,
  className = '',
}: EduroamExpiredNoticeProps) {
  const { t } = useTranslation();
  return (
    <div className={`alert alert-warning flex flex-col items-stretch gap-3 ${className}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t('eduroam.expired.text', { date: formatDate(expiredAt) })}</span>
      </div>
      <button type="button" onClick={onRenew} className="btn btn-sm btn-neutral gap-2 self-start">
        <RefreshCw className="h-4 w-4" />
        {t('eduroam.expired.renew')}
      </button>
    </div>
  );
}
