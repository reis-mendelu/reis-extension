import { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';
import { IndexedDBService } from '../../services/storage';
import { useTranslation } from '../../hooks/useTranslation';
import { useOutlookSync } from '../../hooks/data/useOutlookSync';
import { logError } from '../../utils/reportError';

export function OutlookNudge() {
    const { t } = useTranslation();
    const { isEnabled, toggle, isLoading } = useOutlookSync();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        IndexedDBService.get('meta', 'outlook_nudge_dismissed')
            .then(dismissed => { if (!dismissed) setVisible(true); })
            .catch(e => logError('OutlookNudge.check', e));
    }, []);

    const dismiss = () => {
        setVisible(false);
        IndexedDBService.set('meta', 'outlook_nudge_dismissed', true).catch(e => logError('OutlookNudge.dismiss', e));
    };

    if (!visible || isEnabled) return null;

    return (
        <div className="relative mb-2 rounded-field border border-accent/25 bg-accent/10 px-3 py-2.5 pr-9">
            <button
                aria-label={t('common.close')}
                className="btn btn-ghost btn-xs btn-circle absolute right-1.5 top-1.5"
                onClick={dismiss}
            >
                <X className="h-3.5 w-3.5" />
            </button>
            <p className="flex items-center gap-1.5 text-xs font-bold">
                <Smartphone className="h-3.5 w-3.5" /> {t('calendar.outlookNudgeTitle')}
            </p>
            <p className="mt-0.5 text-[11px] text-base-content/60">{t('calendar.outlookNudgeBody')}</p>
            <button
                className="btn btn-accent btn-xs mt-2 rounded-field"
                disabled={isLoading}
                onClick={toggle}
            >
                {t('calendar.outlookNudgeCta')}
            </button>
        </div>
    );
}
