import { useEffect } from 'react';
import { useIskamStore } from '../../store/iskamStore';
import { detectIskamLanguage, createIskamT } from '../../i18n/iskamTranslate';
import { KontoCard } from './KontoCard';
import { UbytovaniCard } from './UbytovaniCard';
import { IskamPanelSkeleton } from './IskamPanelSkeleton';
import { EmptyIskamState } from './EmptyIskamState';
import { formatTime, isStale } from './freshness';

export function IskamPanel() {
    const data = useIskamStore(s => s.data);
    const status = useIskamStore(s => s.status);
    const error = useIskamStore(s => s.error);
    const refresh = useIskamStore(s => s.refresh);
    const loadFromCache = useIskamStore(s => s.loadFromCache);

    const language = detectIskamLanguage();
    const t = createIskamT(language);

    useEffect(() => {
        loadFromCache().then(() => refresh());
    }, [loadFromCache, refresh]);

    if (!data && status === 'loading') return <IskamPanelSkeleton />;
    if (!data && status === 'error' && error === 'auth') return <EmptyIskamState language={language} variant="auth" />;
    if (!data && status === 'error') return <EmptyIskamState language={language} variant="error" onRetry={refresh} />;
    if (!data) return <EmptyIskamState language={language} variant="empty" />;

    const dimmed = isStale(data.syncedAt);
    const showAuthBanner = status === 'error' && error === 'auth';

    return (
        <div className="flex flex-col gap-4 p-4">
            <header className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-base-content">{t('iskam.title')}</h2>
                <div className="flex items-center gap-2 text-xs text-base-content/60">
                    <span>{t('iskam.freshnessLabel')} {formatTime(data.syncedAt)}</span>
                    <button onClick={refresh} className="btn btn-ghost btn-xs" disabled={status === 'loading'}>
                        {status === 'loading' ? <span className="loading loading-spinner loading-xs" /> : t('iskam.refreshLabel')}
                    </button>
                </div>
            </header>

            {showAuthBanner && (
                <div className="alert alert-warning text-sm">
                    <span>{t('iskam.authDescription')}</span>
                    <a href="https://webiskam.mendelu.cz/" target="_top" className="btn btn-sm btn-primary">
                        {t('iskam.reconnectLabel')}
                    </a>
                </div>
            )}

            {data.konta.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">{t('iskam.accountsLabel')}</h3>
                    {data.konta.map(row => (
                        <KontoCard key={row.name} row={row} language={language} dimmed={dimmed} />
                    ))}
                </section>
            )}

            {data.ubytovani.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">{t('iskam.accommodationLabel')}</h3>
                    {data.ubytovani.map((row, i) => (
                        <UbytovaniCard key={`${row.dorm}-${row.room}-${i}`} row={row} language={language} dimmed={dimmed} />
                    ))}
                </section>
            )}
        </div>
    );
}
