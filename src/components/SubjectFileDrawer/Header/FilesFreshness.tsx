import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';

interface Props {
    courseCode: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function relativeTime(deltaMs: number, locale: string): string {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (deltaMs < MINUTE) return '';
    if (deltaMs < HOUR) return rtf.format(-Math.round(deltaMs / MINUTE), 'minute');
    if (deltaMs < DAY) return rtf.format(-Math.round(deltaMs / HOUR), 'hour');
    return rtf.format(-Math.round(deltaMs / DAY), 'day');
}

export function FilesFreshness({ courseCode }: Props) {
    const { t, language } = useTranslation();
    const fetchedAt = useAppStore(s => s.lastFilesFetchedAt[courseCode]);
    const isLoading = useAppStore(s => !!s.filesLoading[courseCode]);
    const refresh = useAppStore(s => s.refreshFilesForSubject);
    const now = useAppStore(s => s.now);

    const locale = language === 'cz' ? 'cs' : 'en';
    const label = useMemo(() => {
        if (!fetchedAt) return null;
        const delta = now.getTime() - fetchedAt;
        const rel = relativeTime(delta, locale);
        return rel ? `${t('course.freshness.updated')} ${rel}` : t('course.freshness.updatedJustNow');
    }, [fetchedAt, now, locale, t]);

    if (!fetchedAt && !isLoading) return null;

    return (
        <div className="flex items-center gap-1.5 text-xs text-base-content/50">
            {label && <span>{label}</span>}
            <button
                type="button"
                onClick={() => refresh(courseCode)}
                disabled={isLoading}
                title={t('course.freshness.refresh')}
                aria-label={t('course.freshness.refresh')}
                className="btn btn-ghost btn-xs btn-circle interactive disabled:opacity-50"
            >
                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            </button>
        </div>
    );
}
