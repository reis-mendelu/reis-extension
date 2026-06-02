import { requestData } from '../../api/proxyClient';
import { useTranslation } from '../../hooks/useTranslation';

interface BuildingWeekProps {
    /** True once the 10s handshake backstop fired with still no schedule. */
    timedOut: boolean;
}

export function BuildingWeek({ timedOut }: BuildingWeekProps) {
    const { t } = useTranslation();

    if (timedOut) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <p className="text-sm font-semibold text-base-content/70">{t('calendar.buildingWeekFailed')}</p>
                <button className="btn btn-primary btn-sm rounded-field" onClick={() => requestData('all')}>
                    {t('calendar.retry')}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4" aria-busy="true" aria-live="polite">
            <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                <div>
                    <p className="text-sm font-bold leading-none">{t('calendar.buildingWeek')}</p>
                    <p className="mt-1 text-xs text-base-content/50">{t('calendar.buildingWeekSub')}</p>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <div className="skeleton h-14 rounded-field" />
                <div className="skeleton h-10 rounded-field" />
                <div className="skeleton h-16 rounded-field" />
                <div className="skeleton h-10 rounded-field" />
            </div>
        </div>
    );
}
