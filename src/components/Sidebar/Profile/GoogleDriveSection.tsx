import { HardDrive, ExternalLink } from 'lucide-react';
import { useDriveBackup } from '../../../hooks/data/useDriveBackup';
import { useTranslation } from '../../../hooks/useTranslation';

export function GoogleDriveSection() {
    const { connected, rootLink } = useDriveBackup();
    const { t } = useTranslation();

    // (b) scope: only the "open my backup folder" affordance. The connect /
    // disconnect / status surface arrives with (a).
    if (!connected || !rootLink) return null;

    return (
        <div className="flex items-center justify-between gap-3 px-1 py-2 rounded-lg hover:bg-base-200">
            <div className="flex items-center gap-2 flex-1">
                <HardDrive size={16} className="text-base-content/50" />
                <span className="text-xs opacity-70">{t('drive.title')}</span>
            </div>
            <a
                href={rootLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-xs btn-ghost gap-1 text-xs opacity-70 hover:opacity-100"
            >
                {t('drive.openFolder')}
                <ExternalLink size={12} />
            </a>
        </div>
    );
}
