import { Wallet, ChevronDown } from 'lucide-react';
import { useIskamStore } from '../../store/iskamStore';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';
import { useAppStore } from '../../store/useAppStore';
import { KontoCard } from './KontoCard';
import { UbytovaniCard } from './UbytovaniCard';
import { ReservationCard } from './ReservationCard';
import { IskamPanelSkeleton } from './IskamPanelSkeleton';
import { EmptyIskamState } from './EmptyIskamState';
import { isStale } from './freshness';
import { ISKAM_BASE } from '../../api/iskam/client';

export function IskamPanel() {
    const data = useIskamStore(s => s.data);
    const status = useIskamStore(s => s.status);
    const error = useIskamStore(s => s.error);
    const handshakeDone = useIskamStore(s => s.handshakeDone);
    const handshakeTimedOut = useIskamStore(s => s.handshakeTimedOut);

    const language = useAppStore(s => s.language) as IskamLanguage;
    const t = createIskamT(language);

    if (!data && !handshakeDone && !handshakeTimedOut) return <IskamPanelSkeleton />;
    if (!data && status === 'error' && error === 'auth') return <EmptyIskamState language={language} variant="auth" />;
    if (!data && status === 'error') return <EmptyIskamState language={language} variant="error" />;
    if (!data) return <EmptyIskamState language={language} variant="empty" />;

    const dimmed = isStale(data.syncedAt);
    const showAuthBanner = status === 'error' && error === 'auth';

    // Partition accounts: Main account vs Others (deposits, etc.)
    const mainAccount = data.konta.find(k => 
        k.name.toLowerCase().includes('hlavní') || 
        k.name.toLowerCase().includes('main')
    );
    const otherAccounts = data.konta.filter(k => k !== mainAccount);

    return (
        <div className="flex flex-col gap-4 p-4 pt-2 overflow-y-auto max-h-full pb-20">
            {showAuthBanner && (
                <div className="alert alert-warning text-sm shadow-sm border-warning/20">
                    <span className="leading-snug">{t('iskam.authDescription')}</span>
                    <a href={`${ISKAM_BASE}/ObjednavkyStravovani`} target="_top" className="btn btn-sm btn-primary no-animation shrink-0">
                        {t('iskam.reconnectLabel')}
                    </a>
                </div>
            )}

            {/* 1. MAIN ACCOUNT */}
            {mainAccount ? (
                <KontoCard row={mainAccount} language={language} variant="hero" dimmed={dimmed} />
            ) : (
                <div className="alert alert-info text-sm py-3">
                    <Wallet size={16} />
                    <span>{t('iskam.noMainAccount')}</span>
                </div>
            )}

            {/* 2. OTHER ACCOUNTS (deposits etc.) — inline, never hidden */}
            {otherAccounts.length > 0 && (
                <div className="card bg-base-100 border border-base-200 shadow-sm">
                    <div className="card-body p-0">
                        {otherAccounts.map(row => (
                            <KontoCard key={row.name} row={row} language={language} variant="minimal" dimmed={dimmed} />
                        ))}
                    </div>
                </div>
            )}

            {/* 3. ACTIVE RESERVATIONS */}
            {data.reservations && data.reservations.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest px-1">
                        {t('iskam.reservationsLabel')}
                    </h3>
                    {data.reservations.map((res, i) => (
                        <ReservationCard key={`${res.facility}-${i}`} reservation={res} dimmed={dimmed} />
                    ))}
                </section>
            )}

            {/* 4. HOUSING CONTRACTS — expandable, collapsed by default */}
            {data.ubytovani.length > 0 && (
                <div className="collapse bg-base-100 border border-base-200 shadow-sm rounded-2xl">
                    <input type="checkbox" className="min-h-0" />
                    <div className="collapse-title text-xs font-semibold text-base-content/50 uppercase tracking-widest flex items-center gap-2 min-h-0 py-3 px-4">
                        <span>{t('iskam.accommodationLabel')}</span>
                        <ChevronDown size={12} className="ml-auto opacity-40" />
                    </div>
                    <div className="collapse-content flex flex-col gap-2 px-4 pb-4">
                        {data.ubytovani.map((row, i) => (
                            <UbytovaniCard key={`${row.dorm}-${row.room}-${i}`} row={row} language={language} dimmed={dimmed} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
