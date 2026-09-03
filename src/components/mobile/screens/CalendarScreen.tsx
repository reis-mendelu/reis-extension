import type { ReactNode } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { ScreenSkeleton } from '../primitives/ScreenSkeleton';
import { ScreenError } from '../primitives/ScreenError';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSchedule } from '../../../hooks/data/useSchedule';
import { useDeadlineAlerts } from '../../../hooks/useDeadlineAlerts';
import { resolveNowNext } from '../../../utils/mobile/nowNext';
import { buildDayAgenda } from '../../../utils/mobile/dayAgenda';
import { isLessonHidden } from '../../../utils/hiddenLessons';
import { getCzechHoliday } from '../../../utils/holidays';
import { ScreenHeader } from './calendar/ScreenHeader';
import { NowNextCard } from './calendar/NowNextCard';
import { DayChips } from './calendar/DayChips';
import { DayAgenda } from './calendar/DayAgenda';
import { CalendarEmptyDay } from './calendar/CalendarEmptyDay';
import { CalendarAlerts } from './calendar/CalendarAlerts';
import { MobileBulletinOverlay } from '../../Bulletin/MobileBulletinOverlay';

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
      // One row shorter than it was, and no inset of its own: the header above
      // it is real now rather than a placeholder bar.
      rows={['h-28', 'h-10', 'h-20', 'h-20']}
      underHeader
    />
  );
}

export function CalendarScreen() {
  const { language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const { schedule } = useSchedule();
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

  const { alerts } = useDeadlineAlerts();

  const bulletinPosts = useAppStore((s) => s.bulletinPosts);
  const bulletinLoading = useAppStore((s) => s.bulletinLoading);
  const bulletinError = useAppStore((s) => s.bulletinError);
  const bulletinExpanded = useAppStore((s) => s.bulletinExpanded);
  const setBulletinExpanded = useAppStore((s) => s.setBulletinExpanded);

  // The date and the header's four actions come from the selected day and the
  // store, never from the fetch, so they are knowable in every state below —
  // and the header is the ONLY way into search, settings, notifications and
  // the vývěska. Returning a bare skeleton or error in its place left a
  // student with no route to any of them for as long as a crawl took, which on
  // a first sign-in is minutes.
  const selectedIso = mobileSelectedDayIso ?? toIso(new Date());
  const chrome = (
    <>
      {/* The date IS the title. It was the eyebrow under a "Ahoj, {name}"
          greeting that told the student nothing they did not already know. */}
      <ScreenHeader title={formatHeaderDate(new Date(`${selectedIso}T00:00:00`), locale)} />
      {/* Mounted with the header rather than with the agenda: the vývěska
          button is live while the schedule loads, so what it opens has to be
          too. */}
      <MobileBulletinOverlay
        isOpen={bulletinExpanded}
        onClose={() => {
          void setBulletinExpanded(false);
        }}
        posts={bulletinPosts}
        loading={bulletinLoading}
        error={bulletinError}
      />
    </>
  );
  const shell = (body: ReactNode) => (
    <div data-testid="calendar-screen" className="flex flex-1 flex-col overflow-hidden">
      {chrome}
      {body}
    </div>
  );

  // Two different questions, and only one of them is `handshakeDone`. That
  // flag flips on the first status message, which the sync posts as it STARTS,
  // so on a first run it says "connected", not "finished". Until a crawl has
  // actually completed (`firstSyncSettled`) and while one is in flight, an
  // absence of lessons means it has not arrived yet — show the skeleton rather than
  // an empty state that reads as a wrong answer.
  //
  // Deliberately not gated on `!firstSyncSettled`: that flag is latched, so a
  // retry after a failed run would otherwise sit on ScreenError for its whole
  // duration. `syncLoaded.schedule` is what protects a genuinely empty week
  // from getting a skeleton thrown back over it every fifteen minutes.
  if (
    (!handshakeDone && !handshakeTimedOut) ||
    (isSyncing && !syncLoaded.schedule && schedule.length === 0)
  ) {
    return shell(<CalendarSkeleton />);
  }

  // The third state. A finished sync that never delivered this domain, with
  // nothing cached to fall back on, means the fetch failed — and "Nic nemáš,
  // pohodička" over a failed fetch is the same lie as showing it mid-sync,
  // just later. (The first run in a process always fetches, so a missing
  // arrival here cannot be a TTL skip.)
  if (firstSyncSettled && !syncLoaded.schedule && schedule.length === 0) {
    return shell(<ScreenError testId="calendar-error" />);
  }

  const now = new Date();
  const nowNext = resolveNowNext(schedule, now);
  const visibleSchedule = schedule.filter((l) => !isLessonHidden(l, hiddenItems));
  const agenda = buildDayAgenda(visibleSchedule, selectedIso);
  // Which days the chip row may need to offer beyond Mon–Fri. Built from the
  // lessons the student can actually see, so a hidden Saturday lesson does not
  // conjure a chip for an empty day.
  const lessonDates = new Set(visibleSchedule.map((l) => l.date));
  // The util has existed since the desktop calendar shipped; the phone simply
  // never asked. Without it a public holiday reads as an ordinary free day —
  // "Nic nemáš, pohodička" over 28 September.
  const holiday = getCzechHoliday(
    new Date(`${selectedIso}T00:00:00`),
    language === 'en' ? 'en' : 'cz'
  );

  const openRoute = () => {
    if (!nowNext?.next) return;
    const room = nowNext.next.room.replace(/\s*\([^)]*\)\s*$/, '').trim();
    setMobileTab('map');
    focusRoomByCode(room);
  };

  return shell(
    <>
      {nowNext && <NowNextCard data={nowNext} onRoute={openRoute} />}

      <CalendarAlerts alerts={alerts} />

      {/* Above the agenda rather than only inside the empty state: a holiday
          can still carry a lesson (a rescheduled block, a combined-study
          Saturday), and the student needs to know the day is a holiday either
          way. */}
      {holiday && (
        <div
          data-testid="calendar-holiday"
          className="mx-4 mt-3 flex flex-shrink-0 items-center gap-2 rounded-xl border border-error/25 bg-error/10 px-3 py-2"
        >
          <span className="text-sm font-semibold text-error">{holiday}</span>
        </div>
      )}

      <DayChips
        selectedIso={selectedIso}
        onSelect={setMobileSelectedDay}
        lessonDates={lessonDates}
      />

      <div className="flex-1 overflow-y-auto pb-24">
        {agenda.length === 0 ? (
          <CalendarEmptyDay holiday={holiday} />
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
    </>
  );
}
