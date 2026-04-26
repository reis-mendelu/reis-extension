import { Wallet, CalendarRange, Utensils, Settings, ExternalLink } from 'lucide-react';
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
                    <a href={`${ISKAM_BASE}/`} target="_top" className="btn btn-sm btn-primary no-animation shrink-0">
                        {t('iskam.reconnectLabel')}
                    </a>
                </div>
            )}

            {/* 1. HERO: MAIN ACCOUNT */}
            {mainAccount ? (
                <KontoCard row={mainAccount} language={language} variant="hero" dimmed={dimmed} />
            ) : (
                <div className="alert alert-info text-sm py-3">
                    <Wallet size={16} />
                    <span>No main account balance found.</span>
                </div>
            )}

            {/* 2. CONTEXT: ACTIVE HOUSING */}
            {data.ubytovani.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest flex items-center gap-2 px-1">
                        {t('iskam.accommodationLabel')}
                    </h3>
                    {data.ubytovani.map((row, i) => (
                        <UbytovaniCard key={`${row.dorm}-${row.room}-${i}`} row={row} language={language} dimmed={dimmed} />
                    ))}
                </section>
            )}

            {/* 2b. CONTEXT: ACTIVE RESERVATIONS */}
            {data.reservations && data.reservations.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest flex items-center gap-2 px-1">
                        {t('iskam.reservationsLabel')}
                    </h3>
                    {data.reservations.map((res, i) => (
                        <ReservationCard key={`${res.facility}-${i}`} reservation={res} dimmed={dimmed} />
                    ))}
                </section>
            )}

            {/* 3. QUICK ACTIONS GRID */}
            <div className="grid grid-cols-2 gap-3 mt-1">
                <a 
                    href={`${ISKAM_BASE}/Rezervace`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-4 bg-base-100 border border-base-200 rounded-2xl hover:border-primary/40 hover:bg-primary/5 transition-all group shadow-sm"
                >
                    <CalendarRange size={24} className="text-base-content/40 group-hover:text-primary transition-colors" />
                    <span className="text-xs font-semibold mt-2 text-center leading-tight">{t('iskam.laundryLabel')}</span>
                </a>
                <a 
                    href={`${ISKAM_BASE}/ObjednavkyStravovani`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-4 bg-base-100 border border-base-200 rounded-2xl hover:border-primary/40 hover:bg-primary/5 transition-all group shadow-sm"
                >
                    <Utensils size={24} className="text-base-content/40 group-hover:text-primary transition-colors" />
                    <span className="text-xs font-semibold mt-2 text-center leading-tight">{t('iskam.mealsLabel')}</span>
                </a>
            </div>

            {/* 4. JUNK DRAWER: SETTINGS & DEPOSITS */}
            <div className="collapse collapse-arrow bg-base-100 border border-base-200 shadow-sm rounded-2xl mt-1">
                <input type="checkbox" className="min-h-0" /> 
                <div className="collapse-title text-sm font-medium flex items-center gap-3 min-h-0 py-4 px-4">
                    <Settings size={16} className="text-base-content/40" />
                    <span className="opacity-70">{t('iskam.otherServicesLabel')}</span>
                </div>
                <div className="collapse-content flex flex-col gap-1 px-4 pb-4">
                    {otherAccounts.length > 0 && (
                        <div className="mb-2">
                            {otherAccounts.map(row => (
                                <KontoCard key={row.name} row={row} language={language} variant="minimal" dimmed={dimmed} />
                            ))}
                        </div>
                    )}
                    <a 
                        href={`${ISKAM_BASE}/KrSystem`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center justify-between py-2 text-sm border-b border-base-200/50 hover:bg-base-200/30 transition-colors px-1"
                    >
                        <span className="opacity-80">{t('iskam.inkasoLabel')}</span>
                        <ExternalLink size={14} className="opacity-30" />
                    </a>
                    <a 
                        href={`${ISKAM_BASE}/InformaceOKlientovi`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center justify-between py-2 text-sm hover:bg-base-200/30 transition-colors px-1"
                    >
                        <span className="opacity-80">{t('iskam.profileLabel')}</span>
                        <ExternalLink size={14} className="opacity-30" />
                    </a>
                </div>
            </div>
        </div>
    );
}
