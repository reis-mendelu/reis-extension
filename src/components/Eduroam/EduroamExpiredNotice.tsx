import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDate } from '../../utils/date';
import type { EduroamStatus } from '../../hooks/data/useEduroamSetup';

export interface EduroamExpiredNoticeProps {
  /** The certificate's notAfter. */
  at: Date;
  /** `expired`: setup stopped. `soon`: setup ran; this is an early offer. */
  kind: 'expired' | 'soon';
  onRenew: () => void;
  /** The surface's own body size: `text-sm` in the drawer, `text-base` on the phone. */
  className?: string;
}

/**
 * IS's eduroam certificate has expired, or will within RENEW_WITHIN_DAYS. IS
 * never replaces it by itself. Shared by the extension's drawer and the
 * phone's sheet, so both offer the same way out: the student's own tap
 * generates a new one (`renew`). IS does not revoke the current certificate
 * on regeneration, so the offer is safe at either point.
 *
 * `expired` is a warning (nothing was installed); `soon` is information
 * (setup went through, this is only ahead of time) — a neutral alert with
 * only the glyph tinted, because body text on `alert-info` measured 3.68:1.
 */
export function EduroamExpiredNotice({
  at,
  kind,
  onRenew,
  className = '',
}: EduroamExpiredNoticeProps) {
  const { t } = useTranslation();
  const Icon = kind === 'expired' ? AlertTriangle : Clock;
  return (
    <div
      className={`alert ${kind === 'expired' ? 'alert-warning' : 'border-base-content/10'} flex flex-col items-stretch gap-3 ${className}`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${kind === 'soon' ? 'text-info' : ''}`} />
        <span>
          {t(kind === 'expired' ? 'eduroam.expired.text' : 'eduroam.expired.soon', {
            date: formatDate(at),
          })}
        </span>
      </div>
      <button type="button" onClick={onRenew} className="btn btn-sm btn-neutral gap-2 self-start">
        <RefreshCw className="h-4 w-4" />
        {t('eduroam.expired.renew')}
      </button>
    </div>
  );
}

export interface EduroamCertNoticesProps {
  status: EduroamStatus;
  expiredAt: Date | null;
  expiresSoonAt: Date | null;
  onRenew: () => void;
  className?: string;
}

/** Whichever certificate notice `useEduroamSetup`'s state calls for, if any. */
export function EduroamCertNotices({
  status,
  expiredAt,
  expiresSoonAt,
  onRenew,
  className,
}: EduroamCertNoticesProps) {
  if (status === 'expired' && expiredAt) {
    return (
      <EduroamExpiredNotice at={expiredAt} kind="expired" onRenew={onRenew} className={className} />
    );
  }
  if (status !== 'working' && expiresSoonAt) {
    return (
      <EduroamExpiredNotice
        at={expiresSoonAt}
        kind="soon"
        onRenew={onRenew}
        className={className}
      />
    );
  }
  return null;
}
