import { Bell, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { NotificationItem } from './NotificationItem';
import { DeadlineAlertItem } from './DeadlineAlertItem';
import { trackNotificationClick } from '../../services/spolky';
import { useTranslation } from '../../hooks/useTranslation';
import type { SpolekNotification } from '../../services/spolky';
import type { DeadlineAlert } from '../../hooks/useDeadlineAlerts';
import { StudyJamSuggestions } from '../StudyJams/StudyJamSuggestions';
import { useAppStore } from '../../store/useAppStore';
import { useIsMobile } from '../../hooks/ui/useIsMobile';

interface NotificationDropdownProps {
  notifications: SpolekNotification[];
  loading: boolean;
  onClose: () => void;
  onVisible: (id: string) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  deadlineAlerts: DeadlineAlert[];
}

export function NotificationDropdown({ notifications, loading, onClose, onVisible, dropdownRef, deadlineAlerts }: NotificationDropdownProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const hasStudyJamContent = useAppStore(s => s.studyJamSuggestions.length > 0 || s.studyJamMatch !== null);
  const hasContent = notifications.length > 0 || hasStudyJamContent || deadlineAlerts.length > 0;

  const notificationList = (
    <>
      {deadlineAlerts.length > 0 && (
        <div>
          <p className="px-4 py-2 text-xs font-semibold text-base-content/50 uppercase tracking-wide bg-base-200">
            {t('deadlines.title')}
          </p>
          <div className="divide-y divide-base-300">
            {deadlineAlerts.map(alert => (
              <DeadlineAlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}
      <StudyJamSuggestions onClose={onClose} />
      {(loading && !notifications.length) ? <div className="p-4 text-center text-base-content/60">{t('notifications.loading')}</div> :
       (!hasContent) ? <div className="p-8 text-center text-base-content/60"><Bell size={48} className="mx-auto mb-2 opacity-40" /><p>{t('notifications.empty')}</p></div> :
        <div className="divide-y divide-base-300">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onVisible={() => onVisible(n.id)}
              onClick={() => {
                if (n.link) {
                  if (!n.associationId?.startsWith('academic_')) trackNotificationClick(n.id);
                  window.open(n.link, '_blank');
                  onClose();
                }
              }} />
          ))}
        </div>
      }
    </>
  );

  if (isMobile) {
    return createPortal(
      <div ref={dropdownRef} className="fixed inset-0 z-50 bg-base-100 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <h3 className="font-semibold text-lg text-base-content">{t('notifications.title')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-base-300 rounded"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{notificationList}</div>
      </div>,
      document.body
    );
  }

  return (
    <div ref={dropdownRef} className="absolute right-0 top-12 z-50 w-96 bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-[320px] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
        <h3 className="font-semibold text-lg text-base-content">{t('notifications.title')}</h3>
        <button onClick={onClose} className="p-1 hover:bg-base-300 rounded"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto">{notificationList}</div>
    </div>
  );
}
