import { HardDrive, ExternalLink, AlertTriangle } from 'lucide-react';
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

export function GoogleDriveSection() {
    const { connected, rootLink, lastSync, failingSince, busy, connect, disconnect } = useDriveBackup();
    const { t, language } = useTranslation();
    const locale = language === 'cz' ? 'cs' : 'en';

    if (connected === null) return null;

    if (!connected) {
        return (
            <div className="flex items-center justify-between gap-3 px-1 py-2 rounded-lg hover:bg-base-200">
                <div className="flex items-center gap-2 flex-1">
                    <HardDrive size={16} className="text-base-content/50" />
                    <span className="text-xs opacity-70">{t('drive.title')}</span>
                </div>
                <button onClick={connect} disabled={busy} className="btn btn-xs btn-primary">
                    {busy ? <span className="loading loading-spinner loading-xs" /> : t('drive.connect')}
                </button>
            </div>
        );
    }

    const status = failingSince
        ? t('drive.failingSince', { time: relativeTime(Date.now() - failingSince, locale) })
        : lastSync
            ? t('drive.lastBackup', { time: relativeTime(Date.now() - lastSync, locale) })
            : t('drive.pending');

    return (
        <div className="px-1 py-2 rounded-lg hover:bg-base-200">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <HardDrive size={16} className="text-base-content/50 shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs opacity-70">{t('drive.title')}</span>
                        <span className={`text-[10px] flex items-center gap-1 truncate ${failingSince ? 'text-warning' : 'opacity-50'}`}>
                            {failingSince && <AlertTriangle size={10} className="shrink-0" />}
                            {status}
                        </span>
                    </div>
                </div>
                <button onClick={disconnect} disabled={busy} className="btn btn-xs btn-ghost shrink-0">
                    {busy ? <span className="loading loading-spinner loading-xs" /> : t('drive.disconnect')}
                </button>
            </div>
            {rootLink && (
                <a
                    href={rootLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-xs btn-ghost gap-1 mt-1 text-[11px] opacity-70 hover:opacity-100"
                >
                    {t('drive.openFolder')}
                    <ExternalLink size={12} />
                </a>
            )}
        </div>
    );
}
