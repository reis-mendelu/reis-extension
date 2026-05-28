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
 * Account-level Google Drive control in the profile menu: shows connection
 * state + last-backup, and is the canonical place to disconnect. Per-subject
 * status and "open folder" live in the file drawer instead.
 */
export function GoogleDriveToggle() {
    const { connected, lastSync, failingSince, syncing, busy, connect, disconnect } = useDriveBackup();
    const { t, language } = useTranslation();
    const locale = language === 'cz' ? 'cs' : 'en';

    if (connected === null) return null;

    const failing = !syncing && failingSince !== null;
    const status = syncing
        ? t('drive.syncing')
        : failingSince !== null
            ? t('drive.failingSince', { time: relativeTime(Date.now() - failingSince, locale) })
            : lastSync
                ? t('drive.lastBackup', { time: relativeTime(Date.now() - lastSync, locale) })
                : t('drive.pending');

    return (
        <div className="flex items-center justify-between gap-3 px-1 py-2 rounded-lg hover:bg-base-200">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <HardDrive size={16} className="text-base-content/50 shrink-0" />
                <div className="flex flex-col min-w-0">
                    <span className="text-xs opacity-70">{t('drive.title')}</span>
                    {connected && (
                        <span className={`text-[10px] flex items-center gap-1 truncate ${failing ? 'text-warning' : 'opacity-50'}`}>
                            {failing && <AlertTriangle size={10} className="shrink-0" />}
                            {status}
                        </span>
                    )}
                </div>
            </div>
            {connected ? (
                <button onClick={disconnect} disabled={busy} className="btn btn-xs btn-ghost shrink-0">
                    {busy ? <span className="loading loading-spinner loading-xs" /> : t('drive.disconnect')}
                </button>
            ) : (
                <button onClick={connect} disabled={busy} className="btn btn-xs btn-primary shrink-0">
                    {busy ? <span className="loading loading-spinner loading-xs" /> : t('drive.connect')}
                </button>
            )}
        </div>
    );
}
