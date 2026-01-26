import { Bell, X } from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import { trackNotificationClick } from '../../services/spolky';

export function NotificationDropdown({ notifications, loading, onClose, onVisible, dropdownRef }: any) {
  return (
    <div ref={dropdownRef} className="absolute right-0 top-12 z-50 w-96 bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-[320px] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
        <h3 className="font-semibold text-lg text-base-content">Novinky</h3>
        <button onClick={onClose} className="p-1 hover:bg-base-300 rounded"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {(loading && !notifications.length) ? <div className="p-4 text-center text-base-content/60">Načítá se...</div> :
         !notifications.length ? <div className="p-8 text-center text-base-content/60"><Bell size={48} className="mx-auto mb-2 opacity-40" /><p>Žádné nové novinky</p></div> :
          <div className="divide-y divide-base-300">
            {notifications.map((n: any) => (
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
