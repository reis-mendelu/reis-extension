import { Bell } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useNotificationFeed } from '../../../hooks/useNotificationFeed';
import { useDeadlineAlerts } from '../../../hooks/useDeadlineAlerts';
import { NotificationItem } from '../../Notifications/NotificationItem';
import { DeadlineAlertItem } from '../../Notifications/DeadlineAlertItem';
import { trackNotificationClick } from '../../../services/spolky';
import { useTranslation } from '../../../hooks/useTranslation';

export interface NotificationsSheetProps {
    onClose: () => void;
}

/**
 * Full-size feed of deadline alerts + spolky notifications, reusing the
 * exact same `useNotificationFeed`/`useDeadlineAlerts` hooks and
 * `NotificationItem`/`DeadlineAlertItem` renderers as desktop's
 * `NotificationDropdown` — this is the phone's whole "novinky" surface, not
 * a second implementation of it.
 */
export function NotificationsSheet({ onClose }: NotificationsSheetProps) {
    const { t } = useTranslation();
    const { notifications, loading, markVisible } = useNotificationFeed();
    const { alerts } = useDeadlineAlerts();
    const hasContent = notifications.length > 0 || alerts.length > 0;

    return (
        <Sheet size="full" onClose={onClose}>
            <SheetHeader title={t('notifications.title')} onClose={onClose} />
            <div className="flex-1 overflow-y-auto pb-6">
                {alerts.length > 0 && (
                    <div className="divide-y divide-base-300">
                        {alerts.map((alert) => (
                            <DeadlineAlertItem key={alert.id} alert={alert} />
                        ))}
                    </div>
                )}
                {loading && !notifications.length ? (
                    <div className="p-6 text-center text-base text-base-content/60">{t('notifications.loading')}</div>
                ) : !hasContent ? (
                    <div className="flex flex-col items-center gap-2 p-10 text-center text-base-content/60">
                        <Bell size={40} className="opacity-40" />
                        <p>{t('notifications.empty')}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-base-300">
                        {notifications.map((n) => (
                            <NotificationItem
                                key={n.id}
                                notification={n}
                                onVisible={() => markVisible(n.id)}
                                onClick={() => {
                                    if (n.link) {
                                        if (!n.associationId?.startsWith('academic_')) trackNotificationClick(n.id);
                                        window.open(n.link, '_blank');
                                        onClose();
                                    }
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </Sheet>
    );
}
