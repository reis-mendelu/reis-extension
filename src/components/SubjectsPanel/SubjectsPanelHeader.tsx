import { useTranslation } from '@/hooks/useTranslation';

interface SubjectsPanelHeaderProps {
  creditsAcquired: number;
  creditsRequired: number;
}

export function SubjectsPanelHeader({ creditsAcquired, creditsRequired }: SubjectsPanelHeaderProps) {
  const { t } = useTranslation();
  const pct = creditsRequired > 0 ? Math.min(100, Math.round((creditsAcquired / creditsRequired) * 100)) : 0;

  return (
    <div className="px-4 py-3 border-b border-base-300">
      <h2 className="text-lg font-semibold">{t('subjects.title')}</h2>
      <div className="flex items-center gap-3 mt-2">
        <div className="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-base-content/60 whitespace-nowrap">
          {creditsAcquired} / {creditsRequired} {t('subjects.credits')}
        </span>
      </div>
    </div>
  );
}
