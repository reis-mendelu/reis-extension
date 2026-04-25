import { ISKAM_BASE } from '../../api/iskam/client';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';

interface EmptyIskamStateProps {
    language: IskamLanguage;
    variant: 'empty' | 'auth' | 'error';
    onRetry?: () => void;
}

export function EmptyIskamState({ language, variant, onRetry }: EmptyIskamStateProps) {
    const t = createIskamT(language);
    const titleKey = variant === 'auth' ? 'iskam.authTitle' : variant === 'error' ? 'iskam.errorTitle' : 'iskam.emptyTitle';
    const descKey = variant === 'auth' ? 'iskam.authDescription' : variant === 'error' ? 'iskam.errorDescription' : 'iskam.emptyDescription';

    return (
        <div className="flex flex-col items-center justify-center min-h-[260px] text-center px-4 py-8">
            <h3 className="text-lg font-semibold text-base-content/80 mb-1">{t(titleKey)}</h3>
            <p className="text-sm text-base-content/60 max-w-sm mb-4">{t(descKey)}</p>
            {variant === 'auth' && (
                <a href={`${ISKAM_BASE}/`} target="_top" className="btn btn-primary btn-sm">
                    {t('iskam.reconnectLabel')} →
                </a>
            )}
            {variant === 'error' && onRetry && (
                <button onClick={onRetry} className="btn btn-primary btn-sm">
                    {t('iskam.refreshLabel')}
                </button>
            )}
        </div>
    );
}
