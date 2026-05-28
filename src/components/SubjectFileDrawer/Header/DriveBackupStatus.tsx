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

/**
 * Compact, icon-only Drive backup indicator for the file drawer header.
 * Detail lives in the tooltip so it costs the crowded header just one icon.
 */
export function DriveBackupStatus() {
    const { connected, rootLink, lastSync, failingSince, busy, connect } = useDriveBackup();
    const { t, language } = useTranslation();
    const locale = language === 'cz' ? 'cs' : 'en';

    if (connected === null) return null;

    // Not linked — one-tap connect, right where the files live.
    if (!connected) {
        return (
            <button
                type="button"
                onClick={connect}
                disabled={busy}
                title={t('drive.connectHint')}
                aria-label={t('drive.backUp')}
                className="btn btn-ghost btn-xs btn-circle text-base-content/50 disabled:opacity-50"
            >
                {busy ? <span className="loading loading-spinner loading-xs" /> : <HardDrive size={14} />}
            </button>
        );
    }

    const failing = failingSince !== null;
    const status = failing
        ? t('drive.failingSince', { time: relativeTime(Date.now() - failingSince, locale) })
        : lastSync
            ? t('drive.lastBackup', { time: relativeTime(Date.now() - lastSync, locale) })
            : t('drive.pending');

    const tone = failing ? 'text-warning' : 'text-base-content/50';
    const icon = failing ? <AlertTriangle size={14} /> : <HardDrive size={14} />;

    if (rootLink) {
        return (
            <a
                href={rootLink}
                target="_blank"
                rel="noopener noreferrer"
                title={status}
                aria-label={status}
                className={`btn btn-ghost btn-xs btn-circle ${tone}`}
            >
                {icon}
            </a>
        );
    }
    return (
        <span title={status} aria-label={status} className={`btn btn-ghost btn-xs btn-circle no-animation ${tone}`}>
            {icon}
        </span>
    );
}
