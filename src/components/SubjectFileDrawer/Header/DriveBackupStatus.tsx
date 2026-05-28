import { HardDrive, AlertTriangle } from 'lucide-react';
import { useDriveBackup } from '../../../hooks/data/useDriveBackup';
import { useTranslation } from '../../../hooks/useTranslation';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function relativeTime(deltaMs: number, locale: string): string {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (deltaMs < MINUTE) return rtf.format(0, 'minute');
    if (deltaMs < HOUR) return rtf.format(-Math.round(deltaMs / MINUTE), 'minute');
    if (deltaMs < DAY) return rtf.format(-Math.round(deltaMs / HOUR), 'hour');
    return rtf.format(-Math.round(deltaMs / DAY), 'day');
}

/** Compact Drive backup indicator for the file drawer header (files tab). */
export function DriveBackupStatus() {
    const { connected, rootLink, lastSync, failingSince, busy, connect } = useDriveBackup();
    const { t, language } = useTranslation();
    const locale = language === 'cz' ? 'cs' : 'en';

    if (connected === null) return null;

    // Not linked yet — offer a one-tap connect right where the files live.
    if (!connected) {
        return (
            <button
                type="button"
                onClick={connect}
                disabled={busy}
                title={t('drive.connectHint')}
                className="btn btn-ghost btn-xs gap-1.5 text-xs text-base-content/50 disabled:opacity-50"
            >
                {busy ? <span className="loading loading-spinner loading-xs" /> : <HardDrive size={13} />}
                <span className="hidden md:inline">{t('drive.backUp')}</span>
            </button>
        );
    }

    const failing = failingSince !== null;
    const status = failing
        ? t('drive.failingSince', { time: relativeTime(Date.now() - failingSince, locale) })
        : lastSync
            ? t('drive.lastBackup', { time: relativeTime(Date.now() - lastSync, locale) })
            : t('drive.pending');

    const className = `flex items-center gap-1.5 text-xs ${failing ? 'text-warning' : 'text-base-content/50'}`;
    const icon = failing ? <AlertTriangle size={13} /> : <HardDrive size={13} />;

    // Connected: link straight to the Drive folder when we have it, else just show status.
    if (rootLink) {
        return (
            <a href={rootLink} target="_blank" rel="noopener noreferrer" title={status} className={`${className} hover:opacity-100`}>
                {icon}
                <span className="hidden md:inline">{status}</span>
            </a>
        );
    }
    return (
        <span title={status} className={className}>
            {icon}
            <span className="hidden md:inline">{status}</span>
        </span>
    );
}
