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
export function DriveBackupStatus({ courseCode }: { courseCode?: string }) {
    const { connected, folderLink, lastSync, failingSince, syncing, busy, connect, backupNow } = useDriveBackup(courseCode);
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
    const status = syncing
        ? t('drive.syncing')
        : failing
            ? t('drive.failingSince', { time: relativeTime(Date.now() - failingSince, locale) })
            : lastSync
                ? t('drive.lastBackup', { time: relativeTime(Date.now() - lastSync, locale) })
                : t('drive.pending');

    const tone = !syncing && failing ? 'text-warning' : 'text-base-content/50';
    const icon = syncing
        ? <span className="loading loading-spinner loading-xs" />
        : failing
            ? <AlertTriangle size={14} />
            : <HardDrive size={14} />;

    // Folder exists → open it in Drive.
    if (folderLink) {
        return (
            <a
                href={folderLink}
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
    // No folder yet (just connected, or never backed up): tapping must DO
    // something — kick a backup — rather than be a dead icon.
    return (
        <button
            type="button"
            onClick={backupNow}
            disabled={syncing}
            title={syncing ? status : t('drive.backUp')}
            aria-label={syncing ? status : t('drive.backUp')}
            className={`btn btn-ghost btn-xs btn-circle ${tone}`}
        >
            {icon}
        </button>
    );
}
