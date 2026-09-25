import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { relativeTime } from '../../../utils/relativeTime';

interface Props {
  courseCode: string;
}

export function FilesFreshness({ courseCode }: Props) {
  const { t, language } = useTranslation();
  const fetchedAt = useAppStore((s) => s.lastFilesFetchedAt[courseCode]);
  const isLoading = useAppStore((s) => !!s.filesLoading[courseCode]);
  const refresh = useAppStore((s) => s.refreshFilesForSubject);
  const now = useAppStore((s) => s.now);

  const locale = language === 'cz' ? 'cs' : 'en';
  const label = useMemo(() => {
    if (!fetchedAt) return null;
    const delta = now.getTime() - fetchedAt;
    const rel = relativeTime(delta, locale);
    return rel ? `${t('course.freshness.updated')} ${rel}` : t('course.freshness.updatedJustNow');
  }, [fetchedAt, now, locale, t]);

  // Minimalism: the "updated N ago" prose is low-stakes reassurance that ate a
  // full sentence of header width next to the Drive status. Collapse to the
  // refresh glyph alone; the timestamp survives in the tooltip on hover.
  return (
    <button
      type="button"
      onClick={() => refresh(courseCode)}
      disabled={isLoading}
      title={label ? `${label} · ${t('course.freshness.refresh')}` : t('course.freshness.refresh')}
      aria-label={t('course.freshness.refresh')}
      className="btn btn-ghost btn-xs btn-circle interactive text-base-content/50 disabled:opacity-50"
    >
      <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
    </button>
  );
}
