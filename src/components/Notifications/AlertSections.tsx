import type { ReactNode } from 'react';
import type { DeadlineAlert } from '../../hooks/useDeadlineAlerts';
import { useTranslation } from '../../hooks/useTranslation';
import { DeadlineAlertItem } from './DeadlineAlertItem';

/**
 * The app's own section label — `ProfileScreen`, `ExamGroup` and the search
 * results all use exactly this.
 */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-base-content/60 first:pt-1">
      {children}
    </div>
  );
}

/** New points and new boxes already happened; everything else is still ahead. */
const isNews = (a: DeadlineAlert) => a.type === 'zaznamnik-points' || a.type === 'assignment-new';

/**
 * Novinky's alert rows in two labelled groups, on both trees: the phone's
 * Novinky sheet and the extension's bell dropdown render this one component,
 * so the grouping cannot drift apart again (the bell used to be one
 * unlabelled stack).
 *
 * `onOpenNews` opens a záznamník row's subject; the deadlines open their own
 * link or nothing.
 */
export function AlertSections({
  alerts,
  onOpenNews,
}: {
  alerts: DeadlineAlert[];
  onOpenNews?: (alert: DeadlineAlert) => void;
}) {
  const { t } = useTranslation();
  const news = alerts.filter(isNews);
  const deadlines = alerts.filter((a) => !isNews(a));
  return (
    <>
      {news.length > 0 && (
        <div>
          <SectionLabel>{t('course.tabs.zaznamnik')}</SectionLabel>
          <div className="flex flex-col gap-2">
            {news.map((alert) => (
              <DeadlineAlertItem key={alert.id} alert={alert} onOpenSubject={onOpenNews} />
            ))}
          </div>
        </div>
      )}
      {deadlines.length > 0 && (
        <div>
          <SectionLabel>{t('notifications.sectionDeadlines')}</SectionLabel>
          <div className="flex flex-col gap-2">
            {deadlines.map((alert) => (
              <DeadlineAlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
