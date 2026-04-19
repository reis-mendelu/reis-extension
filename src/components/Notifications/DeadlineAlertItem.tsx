import { Clock, ExternalLink, BookOpen } from 'lucide-react';
import type { DeadlineAlert } from '../../hooks/useDeadlineAlerts';
import { useTranslation } from '../../hooks/useTranslation';

const TYPE_KEY: Record<DeadlineAlert['type'], string> = {
  'exam-reg-opens': 'deadlines.examRegOpens',
  'exam-reg': 'deadlines.examReg',
  'assignment': 'deadlines.assignment',
  'cvicny-test': 'deadlines.cvicnyTest',
};

export function DeadlineAlertItem({ alert }: { alert: DeadlineAlert }) {
  const { t } = useTranslation();

  const isCvicny = alert.type === 'cvicny-test';
  const h = alert.hoursUntil !== undefined ? Math.floor(alert.hoursUntil) : null;
  const timeLabel = h !== null ? (h < 1 ? t('deadlines.lessThanHour') : t('deadlines.hoursLeft', { h })) : null;

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-base-200 transition-colors">
      {isCvicny
        ? <BookOpen size={16} className="text-success mt-0.5 shrink-0" />
        : <Clock size={16} className="text-warning mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-base-content truncate">{alert.title}</p>
        <p className="text-xs text-base-content/60 truncate">{alert.body}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`badge badge-outline badge-xs ${isCvicny ? 'badge-success' : 'badge-warning'}`}>{t(TYPE_KEY[alert.type])}</span>
          {timeLabel && <span className="text-xs text-warning font-medium">{timeLabel}</span>}
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
