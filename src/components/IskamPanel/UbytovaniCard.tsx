import { ISKAM_BASE } from '../../api/iskam/client';
import type { UbytovaniRow } from '../../types/iskam';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';
import { parseCzechDate, daysUntil } from './freshness';

interface UbytovaniCardProps {
    row: UbytovaniRow;
    language: IskamLanguage;
    dimmed?: boolean;
}

function CountdownBadge({ endDate, language }: { endDate: string; language: IskamLanguage }) {
    const t = createIskamT(language);
    const date = parseCzechDate(endDate);
    if (!date) return null;
    const days = daysUntil(date);
    if (days < 0) return <span className="badge badge-ghost">{t('iskam.daysRemainingExpired')}</span>;
    if (days === 0) return <span className="badge badge-warning">{t('iskam.daysRemainingToday')}</span>;
    const tone = days <= 30 ? 'badge-warning' : 'badge-ghost';
    return <span className={`badge ${tone}`}>{t('iskam.daysRemaining', { days })}</span>;
}

export function UbytovaniCard({ row, language, dimmed }: UbytovaniCardProps) {
    const t = createIskamT(language);

    return (
        <div className={`card bg-base-100 shadow-sm border border-base-200 ${dimmed ? 'opacity-60' : ''}`}>
            <div className="card-body p-4 gap-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm text-base-content/70">{row.dorm}</span>
                        <span className="text-base font-medium text-base-content">
                            {row.block} · {row.room}
                        </span>
                    </div>
                    {row.contractHref && (
                        <a
                            href={`${ISKAM_BASE}${row.contractHref}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm"
                        >
                            {t('iskam.openContractLabel')} →
                        </a>
                    )}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-base-content/60">
                    <span>{row.startDate} – {row.endDate}</span>
                    <CountdownBadge endDate={row.endDate} language={language} />
                </div>
            </div>
        </div>
    );
}
