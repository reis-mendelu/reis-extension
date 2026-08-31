import { useRef, useEffect } from 'react';
import { Bell, Users } from 'lucide-react';
import type { SpolekNotification } from '../../services/spolky';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * `clickable` is the affordance, not the link. A notification IS a
 * `spolky_events` row, so the phone's Novinky sheet can open one on the map
 * whether or not the author set a `url` — a control that acts has to look like
 * it does. It defaults to the link, which is exactly what the desktop dropdown
 * (where a linkless notification is still inert) relied on before this prop.
 */
export function NotificationItem({
  notification,
  onClick,
  onVisible,
  clickable,
}: {
  notification: SpolekNotification;
  onClick: () => void;
  onVisible?: () => void;
  clickable?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!onVisible || !ref.current) return;
    const obs = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            onVisible();
            obs.unobserve(ref.current!);
          }
        }),
      { threshold: 0.5 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [onVisible]);

  const assocId = notification.associationId || 'admin';
  const iconUrl =
    !assocId.startsWith('academic_') && assocId !== 'admin' ? `/spolky/${assocId}.jpg` : null;

  const formatEventDate = (expiresAt: string) => {
    const d = new Date(expiresAt);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0) return t('common.today');
    if (diffDays === 1) return t('notifications.tomorrow');
    return `${d.getDate()}.${d.getMonth() + 1}.`;
  };

  const isClickable = clickable ?? !!notification.link;

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`w-full p-4 transition-colors text-left flex items-center gap-3 ${isClickable ? 'hover:bg-base-200 cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex-shrink-0">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={assocId}
            className="w-10 h-10 rounded-full object-cover"
            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={iconUrl ? 'hidden' : ''}>
          {assocId === 'admin' ? (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Bell size={20} />
            </div>
          ) : (
            <Users size={24} className="text-primary" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-sm text-base-content line-clamp-1 flex-1">
            {notification.title}
          </div>
          <div className="text-sm text-base-content flex-shrink-0">
            {formatEventDate(notification.expiresAt)}
          </div>
        </div>
      </div>
    </button>
  );
}
