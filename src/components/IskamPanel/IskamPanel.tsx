import { Wallet } from 'lucide-react';
import { useIskamStore } from '../../store/iskamStore';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';
import { useAppStore } from '../../store/useAppStore';
import { KontoCard } from './KontoCard';
import { UbytovaniCard } from './UbytovaniCard';
import { IskamPanelSkeleton } from './IskamPanelSkeleton';
import { EmptyIskamState } from './EmptyIskamState';
import { isStale, parseCzechDate, daysUntil } from './freshness';
import { ISKAM_BASE } from '../../api/iskam/client';
import { VolneKapacitySection } from './VolneKapacitySection';
import { PendingPaymentsSection } from './PendingPaymentsSection';
import { MenzaSpendingSection } from './MenzaSpendingSection';
import { SkmDocumentsSection } from './SkmDocumentsSection';
import type { UbytovaniRow } from '../../types/iskam';

function contractOrder(row: UbytovaniRow): number {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const start = parseCzechDate(row.startDate);
    const end = parseCzechDate(row.endDate);
    if (!start || !end) return 2;
    if (end < todayMidnight) return 2;
    if (start > todayMidnight) return 1;
    return 0;
}

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

    const mainAccount = data.konta.find(k =>
        k.name.toLowerCase().includes('hlavní') ||
        k.name.toLowerCase().includes('main')
    );

    // contractOrder returns 2 for expired or date-unparseable contracts — hide them.
    const sortedContracts = [...data.ubytovani]
        .filter(row => contractOrder(row) !== 2)
        .sort((a, b) => contractOrder(a) - contractOrder(b));

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const activeContract = sortedContracts.find(r => contractOrder(r) === 0);
    const hasNextContract = sortedContracts.some(r => contractOrder(r) === 1);
    const activeEnd = activeContract ? parseCzechDate(activeContract.endDate) : null;
    const daysLeft = activeEnd ? daysUntil(activeEnd) : null;
    const showNoNextWarning = activeContract && !hasNextContract && daysLeft !== null && daysLeft <= 90;

    const getPriceFor = (row: UbytovaniRow): string | undefined =>
        data.reservations.find(r => r.room === row.room && r.startDate === row.startDate)?.price;

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

            {/* 2. MENZA SPENDING */}
            {data.konta.some(k => /stravov/i.test(k.name)) && (
                <MenzaSpendingSection transactions={data.foodTransactions} language={language} />
            )}

            {/* 3. PENDING PAYMENTS */}
            <PendingPaymentsSection payments={data.pendingPayments ?? []} language={language} />

            {/* 4. CONTRACTS */}
            {sortedContracts.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest px-1">
                        {t('iskam.accommodationLabel')}
                    </h3>
                    {sortedContracts.map((row, i) => (
                        <UbytovaniCard
                            key={`${row.dorm}-${row.room}-${i}`}
                            row={row}
                            language={language}
                            dimmed={dimmed}
                            price={getPriceFor(row)}
                        />
                    ))}
                    {showNoNextWarning && (
                        <div className="alert alert-warning text-xs py-2 px-3">
                            <span>{t('iskam.noNextContract')}</span>
                            <a href={`${ISKAM_BASE}`} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-warning btn-outline shrink-0">
                                {t('iskam.bookRoom')}
                            </a>
                        </div>
                    )}
                </section>
            )}

            {/* 5. SKM DOCUMENTS */}
            {data.skmDocuments.length > 0 && (
                <SkmDocumentsSection documents={data.skmDocuments} language={language} />
            )}

            {/* 6. FREE ROOMS */}
            <VolneKapacitySection language={language} />
        </div>
    );
}
