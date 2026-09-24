import { useRef, type ReactNode } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { ScreenError } from '../primitives/ScreenError';
import { RefreshButton } from '../primitives/RefreshButton';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSchedule } from '../../../hooks/data/useSchedule';
import { resolveNowNext } from '../../../utils/mobile/nowNext';
import { buildDayAgenda } from '../../../utils/mobile/dayAgenda';
import { isLessonHidden } from '../../../utils/hiddenLessons';
import { getCzechHoliday } from '../../../utils/holidays';
import { isOutsideTeaching } from '../../../utils/mobile/teachingPeriod';
import { semesterStart } from '../../../utils/mobile/semesterStart';
import { defaultCalendarDay } from '../../../utils/mobile/landingDay';
import { roomCodeFor, routeSuggestionFor } from '../../../utils/mobile/lessonActions';
import { customEventToLesson } from '../../../utils/customEventLesson';
import { ScreenHeader } from './calendar/ScreenHeader';
import { NowNextCard } from './calendar/NowNextCard';
import { DayChips } from './calendar/DayChips';
import { DayBody } from './calendar/DayBody';
import { TodayPill } from './calendar/TodayPill';
import { RecentFilesStrip } from './calendar/RecentFilesStrip';
import { CalendarSkeleton } from './calendar/CalendarSkeleton';
import { CAMPUS_NAVIGATION_ENABLED } from '../../../utils/routing/navigationEnabled';
import { formatHeaderDate } from '../../../utils/mobile/formatHeaderDate';

export function CalendarScreen() {
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const { schedule } = useSchedule();
  const mobileSelectedDayIso = useAppStore((s) => s.mobileSelectedDayIso);
  const setMobileSelectedDay = useAppStore((s) => s.setMobileSelectedDay);
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);
  const suggestRoute = useAppStore((s) => s.suggestRoute);
  const handshakeDone = useAppStore((s) => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore((s) => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore((s) => s.syncStatus.isSyncing);
  const firstSyncSettled = useAppStore((s) => s.firstSyncSettled);
  const syncLoaded = useAppStore((s) => s.syncLoaded);
  const hiddenItems = useAppStore((s) => s.hiddenItems);
  // The store's clock, not `new Date()`: the pulse advances it, so the running
  // lesson's card and its countdown move with it instead of being stamped once
  // per render and then only when something else happened to re-render.
  const now = useAppStore((s) => s.now);
  const teachingWeekData = useAppStore((s) => s.teachingWeekData);
  const customEvents = useAppStore((s) => s.customEvents);
  const scheduleRefreshing = useAppStore((s) => s.scheduleRefreshing);
  const triggerScheduleRefresh = useAppStore((s) => s.triggerScheduleRefresh);
  const screenRef = useRef<HTMLDivElement>(null);

  // The vývěska is no longer mounted here. It was a portal owned by this one
  // screen while the button that opens it ships with every screen's header, so
  // it opened from the calendar tab and nowhere else; it is a sheet in the
  // shared stack now — see sheets/BulletinSheet.
  //
  // The date and the header's four actions come from the selected day and the
  // store, never from the fetch, so they are knowable in every state below —
  // and the header is the ONLY way into search, settings, notifications and
  // the vývěska. Returning a bare skeleton or error in its place left a
  // student with no route to any of them for as long as a crawl took, which on
  // a first sign-in is minutes.
  // Today, except before term, when it is the first teaching day — see
  // utils/mobile/landingDay. Resolved HERE rather than in the store so it
  // re-derives every render: `null` stays "wherever the calendar opens", so the
  // day still rolls over at midnight and still follows a late sync.
  //
  // Computed from the VISIBLE schedule, not the raw one. A student who hid the
  // course that happens to start earliest would otherwise land on a day whose
  // agenda is empty once the hidden lessons are taken out — the blank calendar
  // this rule exists to prevent, arrived at by a different road.
  //
  // Lifted above `chrome` so the set is computed once for the strip below too,
  // in every state including the skeleton — with no schedule it is simply
  // empty, and the strip falls back to Mon–Fri.
  const visibleSchedule = schedule.filter((l) => !isLessonHidden(l, hiddenItems));
  const defaultIso = defaultCalendarDay(visibleSchedule, teachingWeekData, new Date());
  const selectedIso = mobileSelectedDayIso ?? defaultIso;
  // The student's own entries — a society event they answered "Mám zájem" to,
  // or one they typed in themselves. The desktop grid has merged these since it
  // shipped; the phone never did, so every one of them was written, persisted
  // and invisible.
  //
  // Merged HERE and not into `schedule`, which is deliberate and load-bearing.
  // `schedule` answers "did the IS crawl deliver?", and the sync gates below
  // read it as exactly that: an RSVP block in it would suppress the skeleton
  // and the error state, so a failed sync would render as a successful one
  // holding a single society event. For the same reason it stays out of
  // `semesterStart` (a party is not the first teaching day) and out of
  // `defaultCalendarDay` (the calendar must still open on a teaching day).
  const customLessons = customEvents.map(customEventToLesson);
  const dayLessons = [...visibleSchedule, ...customLessons];
  const lessonDates = new Set(dayLessons.map((l) => l.date));
  const chrome = (
    <>
      {/* The date IS the title, and the eyebrow stays empty. It was the
          eyebrow under a "Ahoj, {name}" greeting that told the student nothing
          they did not already know, and a week label was tried there and
          rejected the same way — the strip and the title already say which
          week and which day this is. The way back to today is not here
          either: the header is full at a date and three actions (see
          TodayPill), so it floats above the tab bar instead. */}
      {/* Refreshing is a pull on the day (DayBody). The visible circle that
          sat on its own row here made this header one line taller than every
          other tab's; what is left is the screen-reader route to the same
          sync, which takes no layout. */}
      <ScreenHeader
        title={formatHeaderDate(new Date(`${selectedIso}T00:00:00`), locale)}
        below={
          <RefreshButton
            label={t('mobile.header.refresh')}
            refreshing={scheduleRefreshing}
            onRefresh={triggerScheduleRefresh}
          />
        }
      />
    </>
  );
  const shell = (body: ReactNode) => (
    // `relative` anchors the floating Dnes pill; it renders in every state,
    // skeleton and error included, because the day strip works in all of them.
    // The ref is where a pull to refresh may start (DayBody).
    <div
      ref={screenRef}
      data-testid="calendar-screen"
      className="relative flex flex-1 flex-col overflow-hidden"
    >
      {chrome}
      {body}
      <TodayPill selectedIso={selectedIso} defaultIso={defaultIso} />
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
    // The recent-files shelf needs no schedule and no IS, so a FAILED fetch
    // (offline) is exactly where it earns its place. Not under the skeleton:
    // loading is transient and a card under placeholder bars reads as a glitch.
    return shell(
      <div className="flex flex-1 flex-col overflow-y-auto pb-[calc(9rem_+_var(--safe-bottom,0px))]">
        <ScreenError testId="calendar-error" />
        <RecentFilesStrip />
      </div>
    );
  }

  // Custom events count here too: an event starting at seven that the student
  // said they would go to IS their next thing, and leaving it out would be the
  // same surprise as leaving it off the agenda, one card higher up.
  const nowNext = resolveNowNext(dayLessons, now);
  const agenda = buildDayAgenda(dayLessons, selectedIso);
  // The util has existed since the desktop calendar shipped; the phone simply
  // never asked. Without it a public holiday reads as an ordinary free day —
  // "Nic nemáš, pohodička" over 28 September.
  const holiday = getCzechHoliday(
    new Date(`${selectedIso}T00:00:00`),
    language === 'en' ? 'en' : 'cz'
  );
  // The same question the desktop calendar asks, from the same store field:
  // before term, "Nic nemáš, pohodička" reads as "you happen to be free" when
  // the truth is "there is no schedule to see yet".
  const outsideTeaching = isOutsideTeaching(teachingWeekData, new Date(`${selectedIso}T00:00:00`));
  // And when it starts, which is what a student wants from that answer. Only
  // when it is still ahead — after term this would be last September's date.
  // The DATE, not the sentence: the copy and its formatting belong to the
  // component that shows it.
  const firstTeachingDay = semesterStart(schedule);
  const teachingStartsOn =
    firstTeachingDay && firstTeachingDay > new Date(`${selectedIso}T00:00:00`)
      ? firstTeachingDay
      : null;

  const openRoute = () => {
    if (!nowNext?.next) return;
    setMobileTab('map');
    focusRoomByCode(roomCodeFor(nowNext.next));
    // It is called "Trasa →" and it used to move the camera. The lesson it
    // names on the hero is the one the map now offers to walk to.
    // Not while navigation is parked: "Trasa →" only moves the camera.
    if (CAMPUS_NAVIGATION_ENABLED) suggestRoute(routeSuggestionFor(nowNext.next, language));
  };

  return shell(
    <>
      {nowNext && <NowNextCard data={nowNext} onRoute={openRoute} />}

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

      <DayBody
        agenda={agenda}
        selectedIso={selectedIso}
        holiday={holiday}
        outsideTeaching={outsideTeaching}
        teachingStartsOn={teachingStartsOn}
        onSelectDay={setMobileSelectedDay}
        pullSurfaceRef={screenRef}
      />
    </>
  );
}
