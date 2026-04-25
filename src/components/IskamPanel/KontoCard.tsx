import { ISKAM_BASE } from '../../api/iskam/client';
import type { KontoRow } from '../../types/iskam';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';

interface KontoCardProps {
    row: KontoRow;
    language: IskamLanguage;
    dimmed?: boolean;
}

export function KontoCard({ row, language, dimmed }: KontoCardProps) {
    const t = createIskamT(language);
    const displayName = (language === 'en' ? row.nameEn : row.nameCs) || row.name;

    return (
        <div className={`card bg-base-100 shadow-sm border border-base-200 ${dimmed ? 'opacity-60' : ''}`}>
            <div className="card-body p-4 flex flex-row items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                    <span className="text-sm text-base-content/70 truncate">{displayName}</span>
                    <span className="text-xl font-semibold text-base-content">{row.balanceText}</span>
                </div>
                {row.topUpHref && (
                    <a
                        href={`${ISKAM_BASE}${row.topUpHref}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                    >
                        {t('iskam.topUpLabel')} →
                    </a>
                )}
            </div>
        </div>
    );
}
