import { Clock, ExternalLink } from 'lucide-react';
import type { DeadlineAlert } from '../../hooks/useDeadlineAlerts';
import { useTranslation } from '../../hooks/useTranslation';

const TYPE_KEY: Record<DeadlineAlert['type'], string> = {
  'exam-reg-opens': 'deadlines.examRegOpens',
  'exam-reg': 'deadlines.examReg',
  'assignment': 'deadlines.assignment',
};

export function DeadlineAlertItem({ alert }: { alert: DeadlineAlert }) {
  const { t } = useTranslation();

  const h = Math.floor(alert.hoursUntil);
  const timeLabel = h < 1 ? t('deadlines.lessThanHour') : t('deadlines.hoursLeft', { h });

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-base-200 transition-colors">
      <Clock size={16} className="text-warning mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-base-content truncate">{alert.title}</p>
        <p className="text-xs text-base-content/60 truncate">{alert.body}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="badge badge-warning badge-xs">{t(TYPE_KEY[alert.type])}</span>
          <span className="text-xs text-warning font-medium">{timeLabel}</span>
        </div>
      </div>
      {alert.link && (
        <a href={alert.link} target="_blank" rel="noreferrer" className="p-1 hover:bg-base-300 rounded shrink-0">
          <ExternalLink size={14} className="text-base-content/50" />
        </a>
      )}
    </div>
  );
}
