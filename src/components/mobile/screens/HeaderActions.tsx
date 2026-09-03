import { Bell, Pin, Search, User } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useNotificationFeed } from '../../../hooks/useNotificationFeed';
import { useTranslation } from '../../../hooks/useTranslation';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The header's four buttons: vývěska, search, notifications, settings.
 *
 * Rendered by `ScreenHeader` itself rather than passed in, so a screen cannot
 * render a header without them. That is deliberate: these are the only way
 * into four of the app's destinations, and they have now gone missing twice —
 * once from the calendar's loading and error states, and once from every tab
 * that was not the calendar.
 *
 * Search sits beside the pin rather than after the avatar: it replaced a whole
 * bottom-nav tab, so it is a primary destination, not an afterthought.
 *
 * It owns its own data (the unread count) rather than being handed it, so a
 * caller cannot render it half-configured.
 */
export function HeaderActions() {
  const { t } = useTranslation();
  const fullName = useAppStore((s) => s.fullName);
  const pushSheet = useAppStore((s) => s.pushSheet);
  const bulletinHydrated = useAppStore((s) => s.bulletinHydrated);
  const setBulletinExpanded = useAppStore((s) => s.setBulletinExpanded);
  const loadBulletinIfStale = useAppStore((s) => s.loadBulletinIfStale);
  const { notifications, readIds } = useNotificationFeed();

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const openBulletin = () => {
    void setBulletinExpanded(true);
    if (bulletinHydrated) void loadBulletinIfStale();
  };

  // Four 40px targets plus three gaps spend 184px of a 320px viewport, and with
  // the screen's own 40px of padding that left the title 96px — "Zkoušky"
  // rendered as "Zkou…". The cluster tightens below 360px, the same breakpoint
  // and for the same reason as BottomNav's. verify:ui does not catch this:
  // a truncated title is `truncate` working as designed, not an overflow.
  return (
    <div className="flex flex-shrink-0 items-center gap-2 max-[359px]:gap-1">
      {/* Vývěska joins the other two header actions. As a lone pill between
          the alerts and the day chips it read as misplaced and cost a row
          of vertical space for one tap target. */}
      <button
        type="button"
        onClick={openBulletin}
        aria-label={t('bulletin.expand')}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-base-300 bg-base-100 max-[359px]:h-9 max-[359px]:w-9"
      >
        <Pin size={18} className="text-primary" />
      </button>
      {/* The Student tab was a fifth of the primary navigation spent on a
          text field. As a header action, search is on every tab at once and
          the slot goes back to the four real destinations. */}
      <button
        type="button"
        onClick={() => pushSheet({ kind: 'search' })}
        aria-label={t('mobile.header.search')}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-base-300 bg-base-100 max-[359px]:h-9 max-[359px]:w-9"
      >
        <Search size={18} />
      </button>
      <button
        type="button"
        onClick={() => pushSheet({ kind: 'notifications' })}
        aria-label={t('mobile.calendar.notifications')}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-base-300 bg-base-100 max-[359px]:h-9 max-[359px]:w-9"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-content">
            {unreadCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => pushSheet({ kind: 'profile' })}
        aria-label={t('sidebar.profile')}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-base-300 bg-base-100 font-display text-base font-bold text-primary max-[359px]:h-9 max-[359px]:w-9"
      >
        {fullName ? initials(fullName) : <User size={18} />}
      </button>
    </div>
  );
}
