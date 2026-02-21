import { Bell, X } from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import { trackNotificationClick } from '../../services/spolky';
import { useTranslation } from '../../hooks/useTranslation';
import type { SpolekNotification } from '../../services/spolky';
import { StudyJamSuggestions } from '../StudyJams/StudyJamSuggestions';
import { useAppStore } from '../../store/useAppStore';

interface NotificationDropdownProps {
  notifications: SpolekNotification[];
  loading: boolean;
  onClose: () => void;
  onVisible: (id: string) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
}

export function NotificationDropdown({ notifications, loading, onClose, onVisible, dropdownRef }: NotificationDropdownProps) {
  const { t } = useTranslation();
  const hasStudyJamContent = useAppStore(s => s.studyJamSuggestions.length > 0 || Object.keys(s.studyJamOptIns).length > 0 || s.studyJamMatch !== null);
  return (
    <div ref={dropdownRef} className="absolute right-0 top-12 z-50 w-96 bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-[320px] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
        <h3 className="font-semibold text-lg text-base-content">{t('notifications.title')}</h3>
        <button onClick={onClose} className="p-1 hover:bg-base-300 rounded"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <StudyJamSuggestions onClose={onClose} />
        {(loading && !notifications.length) ? <div className="p-4 text-center text-base-content/60">{t('notifications.loading')}</div> :
         (!notifications.length && !hasStudyJamContent) ? <div className="p-8 text-center text-base-content/60"><Bell size={48} className="mx-auto mb-2 opacity-40" /><p>{t('notifications.empty')}</p></div> :
          <div className="divide-y divide-base-300">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onVisible={() => onVisible(n.id)}
                onClick={() => {
                  if (!n.associationId?.startsWith('academic_')) trackNotificationClick(n.id);
                  if (n.link) window.open(n.link, '_blank');
                  onClose();
                }} />
            ))}
          </div>
        }
      </div>
    </div>
  );
}
