import { Wallet } from 'lucide-react';
import { ISKAM_BASE } from '../../api/iskam/client';
import type { KontoRow } from '../../types/iskam';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';

interface KontoCardProps {
    row: KontoRow;
    language: IskamLanguage;
    dimmed?: boolean;
    variant?: 'hero' | 'minimal' | 'default';
}

export function KontoCard({ row, language, dimmed, variant = 'default' }: KontoCardProps) {
    const t = createIskamT(language);
    const displayName = (language === 'en' ? row.nameEn : row.nameCs) || row.name;

    if (variant === 'minimal') {
        return (
            <div className={`flex items-center justify-between py-2 border-b border-base-200/50 last:border-0 ${dimmed ? 'opacity-60' : ''}`}>
                <span className="text-sm opacity-80">{displayName}</span>
                <span className="text-sm font-semibold">{row.balanceText}</span>
            </div>
        );
    }

    if (variant === 'hero') {
        const topUpUrl = row.topUpHref ? `${ISKAM_BASE}${row.topUpHref}` : null;

        return (
            <div className={`card bg-base-100 shadow-sm border border-primary/20 ${dimmed ? 'opacity-60' : ''}`}>
                <div className="card-body p-4 flex flex-row items-center gap-3">
                    <Wallet size={18} className="text-primary shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium uppercase tracking-wide text-base-content/50">{displayName}</span>
                        <span className="text-2xl font-bold text-base-content leading-tight">{row.balanceText}</span>
                    </div>
                    {topUpUrl && (
                        <a
                            href={topUpUrl}
                            target="_top"
                            className="btn btn-primary btn-sm no-animation border-none shrink-0 ml-auto"
                        >
                            {t('iskam.topUpLabel')} →
                        </a>
                    )}
                </div>
            </div>
        );
    }

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
                        className="btn btn-primary btn-sm no-animation"
                    >
                        {t('iskam.topUpLabel')} →
                    </a>
                )}
            </div>
        </div>
    );
}
