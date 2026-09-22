import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { relativeTime } from '../../../../utils/relativeTime';

/**
 * How old the exam terms on screen are, and the way to get fresh ones.
 *
 * The phone had neither. A term that opened or filled since the last sync
 * stayed wrong until the app was closed and reopened, which during
 * registration is the difference between a seat and none. The action is the
 * store's `triggerExamsRefresh` — the same one the desktop's `ExamsFreshness`
 * button and every register/unregister already call — so this adds a control,
 * not a second way of fetching.
 *
 * The age is spelled out rather than hidden behind the icon: "is this current?"
 * is the question the button answers, and a bare ⟳ does not say it needs
 * asking.
 */
export function ExamsRefresh() {
  const { t, language } = useTranslation();
  const fetchedAt = useAppStore((s) => s.lastExamsFetchedAt);
  const now = useAppStore((s) => s.now);
  const refreshing = useAppStore((s) => s.examsRefreshing);
  const trigger = useAppStore((s) => s.triggerExamsRefresh);

  const locale = language === 'cz' ? 'cs' : 'en';
  const rel = fetchedAt ? relativeTime(now.getTime() - fetchedAt, locale) : '';
  const label = refreshing
    ? t('mobile.exams.refreshing')
    : fetchedAt
      ? rel
        ? `${t('course.freshness.updated')} ${rel}`
        : t('course.freshness.updatedJustNow')
      : null;

  return (
    <button
      type="button"
      onClick={() => trigger()}
      disabled={refreshing}
      aria-label={t('mobile.exams.refresh')}
      className="flex min-h-11 items-center gap-1.5 rounded-full px-2 text-xs text-base-content/60 active:bg-base-200 disabled:opacity-70"
    >
      {label && <span aria-hidden="true">{label}</span>}
      <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
    </button>
  );
}
