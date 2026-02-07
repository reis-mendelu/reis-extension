import { useRef, useEffect } from 'react';
import { Bell, Users } from 'lucide-react';
import type { SpolekNotification } from '../../services/spolky';
import { useTranslation } from '../../hooks/useTranslation';

export function NotificationItem({ notification, onClick, onVisible }: { notification: SpolekNotification; onClick: () => void; onVisible?: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!onVisible || !ref.current) return;
    const obs = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { onVisible(); obs.unobserve(ref.current!); } }), { threshold: 0.5 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [onVisible]);

  const assocId = notification.associationId || 'admin';
  const iconUrl = (!assocId.startsWith('academic_') && assocId !== 'admin') ? `/spolky/${assocId}.jpg` : null;

  const formatDate = (iso: string) => {
    const d = new Date(iso), n = new Date(), h = (n.getTime() - d.getTime()) / 3600000;
    return h < 24 ? t('common.today') : h < 48 ? t('notifications.yesterday') : `${d.getDate()}.${d.getMonth() + 1}.`;
  };

  return (
    <button ref={ref} onClick={onClick} className="w-full p-4 hover:bg-base-200 transition-colors text-left flex items-center gap-3">
      <div className="flex-shrink-0">
        {iconUrl ? <img src={iconUrl} alt={assocId} className="w-10 h-10 rounded-full object-cover" onError={(e: any) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} /> : null}
        <div className={iconUrl ? 'hidden' : ''}>{assocId === 'admin' ? <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Bell size={20} /></div> : <Users size={24} className="text-primary" />}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-sm text-base-content line-clamp-1 flex-1">{notification.title}</div>
          <div className="text-sm text-base-content flex-shrink-0">{formatDate(notification.createdAt)}</div>
        </div>
      </div>
    </button>
  );
}
