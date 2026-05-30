import { useEffect, useRef, useState } from 'react';
import { HardDrive, AlertTriangle, CircleCheck } from 'lucide-react';
import { useDriveBackup } from '../../../hooks/data/useDriveBackup';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';
import { classifyDriveStatus, type DriveStatusTone } from './driveStatusView';

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

const TONE_CLASS: Record<DriveStatusTone, string> = {
    muted: 'text-base-content/50',
    warning: 'text-warning',
    error: 'text-error',
};

/**
 * Drive backup indicator for the file drawer header.
 *
 * Legibility over economy: the status renders as a visible label on wide
 * drawers (mirrors FilesFreshness, works on touch where there is no hover),
 * collapses to a single icon when narrow, and grades failures so a fresh blip
 * (calm) never looks like a dead token (loud, reconnect-worthy). A finished
 * pass flashes "Up to date" so a click that legitimately changed nothing still
 * gives the user a reward signal instead of feeling dead.
 */
export function DriveBackupStatus({ courseCode }: { courseCode?: string }) {
    const { connected, folderLink, lastSync, failingSince, syncing, busy, connect, backupNow } = useDriveBackup(courseCode);
    const { t, language } = useTranslation();
    const now = useAppStore(s => s.now).getTime();
    const locale = language === 'cz' ? 'cs' : 'en';

    // Reward signal: when an active pass settles healthy, flash a confirmation
    // briefly — even on icon-only widths where the label can't be read.
    const [justFinished, setJustFinished] = useState(false);
    const wasSyncing = useRef(false);
    useEffect(() => {
        const settled = wasSyncing.current && !syncing && failingSince === null;
        wasSyncing.current = syncing;
        if (!settled) return;
        // A timed flash reacting to a sync true→false transition genuinely needs
        // an effect — there is no pure derivation of "2.5s after the pass ended".
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setJustFinished(true);
        const id = setTimeout(() => setJustFinished(false), 2500);
        return () => clearTimeout(id);
    }, [syncing, failingSince]);

    if (connected === null) return null;

    const view = classifyDriveStatus({ connected, syncing, failingSince, lastSync, now });

    const label = justFinished
        ? t('drive.upToDate')
        : view.kind === 'syncing' ? t('drive.syncing')
            : view.kind === 'connect' ? t('drive.backUp')
                : view.kind === 'pending' ? t('drive.pending')
                    : view.kind === 'retrying' ? t('drive.retrying')
                        : view.kind === 'broken' ? t('drive.failingSince', { time: relativeTime(now - (failingSince ?? now), locale) })
                            : t('drive.lastBackup', { time: relativeTime(now - lastSync, locale) });

    const tone = justFinished ? 'text-success' : TONE_CLASS[view.tone];
    const icon = view.kind === 'syncing'
        ? <span className="loading loading-spinner loading-xs" />
        : justFinished ? <CircleCheck size={14} />
            : view.tone === 'muted' ? <HardDrive size={14} /> : <AlertTriangle size={14} />;

    // Minimalism: when the backup is healthy the label is pure reassurance and
    // duplicated the FilesFreshness timestamp beside it. Collapse the healthy
    // state to a quiet, unboxed icon (matches the refresh glyph); the timestamp
    // stays in the tooltip/aria. The non-healthy and actionable states keep their
    // visible label — that legibility is the whole point of the indicator. The
    // justFinished flash keeps its "Up to date" label as the transient reward.
    const isQuiet = view.kind === 'healthy' && !justFinished;
    const className = isQuiet
        ? `btn btn-ghost btn-xs btn-circle interactive ${tone}`
        : `btn btn-ghost btn-xs gap-1.5 px-2 ${tone}`;
    const content = (
        <>
            {!isQuiet && label && <span className="hidden @md:inline whitespace-nowrap text-xs font-normal">{label}</span>}
            {icon}
        </>
    );

    // Not linked, or failing for so long it needs a fresh consent/refresh:
    // the tap must DO the fixing thing (connect), not open a folder.
    if (view.kind === 'connect' || view.kind === 'broken') {
        return (
            <button
                type="button"
                onClick={connect}
                disabled={busy}
                title={view.kind === 'broken' ? t('drive.reconnect') : t('drive.connectHint')}
                aria-label={label}
                className={`${className} disabled:opacity-50`}
            >
                {busy ? <span className="loading loading-spinner loading-xs" /> : content}
            </button>
        );
    }

    // Folder exists → open it in Drive.
    if (folderLink) {
        return (
            <a href={folderLink} target="_blank" rel="noopener noreferrer" title={label} aria-label={label} className={className}>
                {content}
            </a>
        );
    }

    // No folder yet (just connected, or never backed up): tapping kicks a backup.
    return (
        <button
            type="button"
            onClick={backupNow}
            disabled={syncing}
            title={syncing ? label : t('drive.backUp')}
            aria-label={syncing ? label : t('drive.backUp')}
            className={className}
        >
            {content}
        </button>
    );
}
