import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * "Nové body": the teacher added points to this subject's záznamník since the
 * student last opened it. Shared by the desktop subject row and the phone's
 * semester card; the size comes from the caller, the look stays one.
 */
export function NewPointsBadge({
  courseCode,
  className = 'text-[10px] px-1.5 py-0.5',
}: {
  courseCode: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const isNew = useAppStore((s) => (s.zaznamnikNewPoints[courseCode]?.length ?? 0) > 0);
  if (!isNew) return null;
  return (
    <span
      data-testid="new-points-badge"
      className={`shrink-0 whitespace-nowrap rounded border border-success/40 font-semibold text-[var(--tone-success)] ${className}`}
    >
      {t('zaznamnik.newPoints')}
    </span>
  );
}
