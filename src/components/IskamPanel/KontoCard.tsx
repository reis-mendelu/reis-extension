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
        return (
            <div className={`card bg-base-100 shadow-sm border border-primary/20 ${dimmed ? 'opacity-60' : ''}`}>
                <div className="card-body p-4 gap-1">
                    <div className="flex items-center gap-2 text-base-content/70">
                        <Wallet size={16} className="text-primary" />
                        <span className="text-sm font-medium uppercase tracking-wide">{displayName}</span>
                    </div>
                    <div className="text-3xl font-bold text-base-content">{row.balanceText}</div>
                    {row.topUpHref && (
                        <a
                            href={`${ISKAM_BASE}${row.topUpHref}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm mt-3 no-animation border-none"
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
