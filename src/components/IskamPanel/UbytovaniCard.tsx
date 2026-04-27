import { ISKAM_BASE } from '../../api/iskam/client';
import type { UbytovaniRow } from '../../types/iskam';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';
import { parseCzechDate, daysUntil } from './freshness';

type ContractVariant = 'active' | 'future' | 'past';

function classifyContract(row: UbytovaniRow): ContractVariant {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const start = parseCzechDate(row.startDate);
    const end = parseCzechDate(row.endDate);
    if (!start || !end) return 'past';
    if (end < todayMidnight) return 'past';
    if (start > todayMidnight) return 'future';
    return 'active';
}


interface Props {
    row: UbytovaniRow;
    language: IskamLanguage;
    dimmed?: boolean;
    price?: string;
}

export function UbytovaniCard({ row, language, dimmed, price }: Props) {
    const t = createIskamT(language);
    const variant = classifyContract(row);
    if (variant === 'past') return null;

    const isFuture = variant === 'future';
    const endDate = parseCzechDate(row.endDate);
    const daysLeft = !isFuture && endDate ? daysUntil(endDate) : null;

    return (
        <div className={`card bg-base-100 shadow-sm border border-base-200 transition-opacity ${dimmed || isFuture ? 'opacity-60' : ''}`}>
            <div className="card-body p-4 gap-2">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs text-base-content/50">{row.dorm}</span>
                        <span className={`font-medium text-base-content ${isFuture ? 'text-sm' : 'text-base'}`}>
                            {row.block} · {row.room}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {row.contractHref && (
                            <a
                                href={`${ISKAM_BASE}${row.contractHref}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-xs"
                            >
                                {t('iskam.openContractLabel')} →
                            </a>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-base-content/50">{row.startDate} – {row.endDate}</span>
                    {daysLeft !== null && (
                        <span className={`text-xs ${daysLeft <= 30 ? 'text-error/70' : daysLeft <= 60 ? 'text-warning/70' : 'text-base-content/40'}`}>
                            · {daysLeft === 0
                                ? t('iskam.daysRemainingToday')
                                : t('iskam.daysRemaining', { days: daysLeft })}
                        </span>
                    )}
                </div>

                {!isFuture && price && (
                    <span className="text-xs text-base-content/40">{price}</span>
                )}
            </div>
        </div>
    );
}
