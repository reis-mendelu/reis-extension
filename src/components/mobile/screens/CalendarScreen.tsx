import { Bell, Calendar, AlertTriangle, Pin, User } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { ScreenSkeleton } from '../primitives/ScreenSkeleton';
import { ScreenError } from '../primitives/ScreenError';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSchedule } from '../../../hooks/data/useSchedule';
import { useDeadlineAlerts } from '../../../hooks/useDeadlineAlerts';
import { useNotificationFeed } from '../../../hooks/useNotificationFeed';
import { resolveNowNext } from '../../../utils/mobile/nowNext';
import { buildDayAgenda } from '../../../utils/mobile/dayAgenda';
import { isLessonHidden } from '../../../utils/hiddenLessons';
import { ScreenHeader } from './calendar/ScreenHeader';
import { NowNextCard } from './calendar/NowNextCard';
import { DayChips } from './calendar/DayChips';
import { DayAgenda } from './calendar/DayAgenda';
import { MobileBulletinOverlay } from '../../Bulletin/MobileBulletinOverlay';

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatHeaderDate(date: Date, locale: string): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function CalendarSkeleton() {
  const { t } = useTranslation();
  return (
    <ScreenSkeleton
      testId="calendar-skeleton"
      label={t('mobile.calendar.loading')}
      rows={['h-6 w-40', 'h-28', 'h-10', 'h-20', 'h-20']}
    />
  );
}

export function CalendarScreen() {
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const { schedule } = useSchedule();
  const fullName = useAppStore((s) => s.fullName);
  const mobileSelectedDayIso = useAppStore((s) => s.mobileSelectedDayIso);
  const setMobileSelectedDay = useAppStore((s) => s.setMobileSelectedDay);
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const pushSheet = useAppStore((s) => s.pushSheet);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);
  const handshakeDone = useAppStore((s) => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore((s) => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore((s) => s.syncStatus.isSyncing);
  const firstSyncSettled = useAppStore((s) => s.firstSyncSettled);
  const syncLoaded = useAppStore((s) => s.syncLoaded);
  const hiddenItems = useAppStore((s) => s.hiddenItems);

  const { notifications, readIds } = useNotificationFeed();
  const { alerts } = useDeadlineAlerts();

  const bulletinPosts = useAppStore((s) => s.bulletinPosts);
  const bulletinLoading = useAppStore((s) => s.bulletinLoading);
  const bulletinError = useAppStore((s) => s.bulletinError);
  const bulletinExpanded = useAppStore((s) => s.bulletinExpanded);
  const bulletinHydrated = useAppStore((s) => s.bulletinHydrated);
  const setBulletinExpanded = useAppStore((s) => s.setBulletinExpanded);
  const loadBulletinIfStale = useAppStore((s) => s.loadBulletinIfStale);

  // Two different questions, and only one of them is `handshakeDone`. That
  // flag flips on the first status message, which the sync posts as it STARTS,
  // so on a first run it says "connected", not "finished". Until a crawl has
  // actually completed (`firstSyncSettled`) and while one is in flight, an
  // absence of lessons means it has not arrived yet — show the skeleton rather than
  // an empty state that reads as a wrong answer.
  if (
    (!handshakeDone && !handshakeTimedOut) ||
    (isSyncing && !firstSyncSettled && !syncLoaded.schedule && schedule.length === 0)
  ) {
    return <CalendarSkeleton />;
  }

  // The third state. A finished sync that never delivered this domain, with
  // nothing cached to fall back on, means the fetch failed — and "Nic nemáš,
  // pohodička" over a failed fetch is the same lie as showing it mid-sync,
  // just later. (The first run in a process always fetches, so a missing
  // arrival here cannot be a TTL skip.)
  if (firstSyncSettled && !syncLoaded.schedule && schedule.length === 0) {
    return <ScreenError testId="calendar-error" />;
  }

  const now = new Date();
  const selectedIso = mobileSelectedDayIso ?? toIso(now);
  const nowNext = resolveNowNext(schedule, now);
  const visibleSchedule = schedule.filter((l) => !isLessonHidden(l, hiddenItems));
  const agenda = buildDayAgenda(visibleSchedule, selectedIso);
  // Which days the chip row may need to offer beyond Mon–Fri. Built from the
  // lessons the student can actually see, so a hidden Saturday lesson does not
  // conjure a chip for an empty day.
  const lessonDates = new Set(visibleSchedule.map((l) => l.date));
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const openBulletin = () => {
    void setBulletinExpanded(true);
    if (bulletinHydrated) void loadBulletinIfStale();
  };

  const openRoute = () => {
    if (!nowNext?.next) return;
    const room = nowNext.next.room.replace(/\s*\([^)]*\)\s*$/, '').trim();
    setMobileTab('map');
    focusRoomByCode(room);
  };

  return (
    <div data-testid="calendar-screen" className="flex flex-1 flex-col overflow-hidden">
      {/* The date IS the title now. It was the eyebrow under a "Ahoj, {name}"
          greeting that told the student nothing they did not already know. */}
      <ScreenHeader
        title={formatHeaderDate(new Date(`${selectedIso}T00:00:00`), locale)}
        action={
          <div className="flex items-center gap-2">
            {/* Vývěska joins the other two header actions. As a lone pill between
                the alerts and the day chips it read as misplaced and cost a row
                of vertical space for one tap target. */}
            <button
              type="button"
              onClick={openBulletin}
              aria-label={t('bulletin.expand')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-base-300 bg-base-100"
            >
              <Pin size={18} className="text-primary" />
            </button>
            <button
              type="button"
              onClick={() => pushSheet({ kind: 'notifications' })}
              aria-label={t('mobile.calendar.notifications')}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-base-300 bg-base-100"
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-base-300 bg-base-100 font-display text-base font-bold text-primary"
            >
              {fullName ? initials(fullName) : <User size={18} />}
            </button>
          </div>
        }
      />

      {nowNext && <NowNextCard data={nowNext} onRoute={openRoute} />}

      {alerts.length > 0 && (
        <div className="mx-4 mt-3 flex flex-shrink-0 flex-col gap-2">
          {alerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className="flex items-center gap-2.5 rounded-xl border border-warning/25 bg-warning/10 px-3 py-2.5"
            >
              <AlertTriangle size={16} className="flex-shrink-0 text-warning" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-base-content">
                  {alert.title}
                </span>
                <span className="truncate text-xs text-base-content/70">{alert.body}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <MobileBulletinOverlay
        isOpen={bulletinExpanded}
        onClose={() => {
          void setBulletinExpanded(false);
        }}
        posts={bulletinPosts}
        loading={bulletinLoading}
        error={bulletinError}
      />

      <DayChips
        selectedIso={selectedIso}
        onSelect={setMobileSelectedDay}
        lessonDates={lessonDates}
      />

      <div className="flex-1 overflow-y-auto pb-24">
        {agenda.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Calendar size={28} />
            </div>
            <div className="font-display text-lg font-bold">{t('mobile.calendar.emptyTitle')}</div>
            <div className="max-w-56 text-xs text-base-content/60">
              {t('mobile.calendar.emptyBody')}
            </div>
          </div>
        ) : (
          <DayAgenda
            rows={agenda}
            // The day travels with the id: a lesson that repeats weekly shares
            // one id across the whole semester the store holds.
            onOpenEvent={(eventId) =>
              pushSheet({ kind: 'eventDetail', eventId, dayIso: selectedIso })
            }
          />
        )}
      </div>
    </div>
  );
}
