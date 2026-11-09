import { useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { SpolekNotification } from '../../services/spolky/types';
import { useTranslation } from '../../hooks/useTranslation';
import { NotificationItem } from './NotificationItem';

/**
 * A notice from the student's own IS home page, in Novinky under MENDELU
 * (utils/isNoticeRows). Unlike a society row, the tap unfolds the notice's
 * text in place: the text IS the notice ("Nový design UIS" is OIT's
 * announcement; its link is only the test site it mentions). The link is a
 * button under the text, and only that button leaves the app.
 *
 * Same row as every other one, so the list keeps one left edge; the card
 * around it grows instead of a second card appearing.
 */
export function IsNoticeItem({
  notification,
  onOpen,
  onVisible,
}: {
  notification: SpolekNotification;
  onOpen: () => void;
  onVisible?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    // The extension's bell is a 320px dropdown that scrolls: unfolded near its
    // bottom edge, the text and its button would open out of sight.
    if (next) requestAnimationFrame(() => cardRef.current?.scrollIntoView?.({ block: 'nearest' }));
  };
  const toIs = isIsLink(notification.link);

  return (
    <div ref={cardRef} className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
      <NotificationItem
        notification={notification}
        onClick={toggle}
        onVisible={onVisible}
        clickable
        expanded={open}
        bare
      />
      {open && (
        // Indented to the title (32px mark + 10px gap + 14px padding).
        <div className="flex flex-col items-start gap-2.5 pb-3 pl-14 pr-3.5">
          <p className="whitespace-pre-line text-sm text-base-content/80">{notification.body}</p>
          {notification.link && (
            <button type="button" className="btn btn-outline btn-sm" onClick={onOpen}>
              <ExternalLink size={14} aria-hidden />
              {toIs ? t('notifications.openInIs') : t('notifications.openLink')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function isIsLink(link: string | undefined): boolean {
  try {
    return !!link && new URL(link).host === 'is.mendelu.cz';
  } catch {
    return false;
  }
}
