import { Bell, Pin, Search } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useNotificationFeed } from '../../../hooks/useNotificationFeed';
import { useDeadlineAlerts } from '../../../hooks/useDeadlineAlerts';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * The header's three buttons: vývěska, search, notifications.
 *
 * Rendered by `ScreenHeader` itself rather than passed in, so a screen cannot
 * render a header without them. That is deliberate: these are the only way
 * into four of the app's destinations, and they have now gone missing twice —
 * once from the calendar's loading and error states, and once from every tab
 * that was not the calendar.
 *
 * No avatar: the profile is a bottom-nav TAB now, and a tab plus an icon that
 * open the same screen is two doors to one room. It also gives the title back
 * the 40px that had squeezed "Zkoušky" to "Zkou…" at 320px.
 *
 * It owns its own data (the unread count) rather than being handed it, so a
 * caller cannot render it half-configured.
 */
export function HeaderActions() {
  const { t } = useTranslation();
  const pushSheet = useAppStore((s) => s.pushSheet);
  const bulletinHydrated = useAppStore((s) => s.bulletinHydrated);
  const loadBulletinIfStale = useAppStore((s) => s.loadBulletinIfStale);
  const { notifications, readIds } = useNotificationFeed();
  const { unseenCount } = useDeadlineAlerts();

  // Deadlines count too, exactly as they do on desktop's NotificationFeed. The
  // calendar used to carry them in a strip above the day chips; that strip is
  // gone — Novinky is the one place for a deadline now — so without this a
  // closing registration or an assignment due in four hours would arrive with
  // no signal anywhere in the app.
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length + unseenCount;

  const openBulletin = () => {
    // pushSheet, not the old `bulletinExpanded` flag: that flag was only read
    // by a portal mounted inside CalendarScreen, so on the other four tabs this
    // button set it and nothing appeared. The stack is rendered once for the
    // whole app by SheetHost.
    pushSheet({ kind: 'bulletin' });
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
    </div>
  );
}
