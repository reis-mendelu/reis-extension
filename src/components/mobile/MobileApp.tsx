import { Toaster } from '../ui/sonner';
import { toastOffset } from './toastOffset';
import { useAppStore } from '../../store/useAppStore';
import { DemoBanner } from './DemoBanner';
import { BottomNav } from './nav/BottomNav';
import { CalendarScreen } from './screens/CalendarScreen';
import { ExamsScreen } from './screens/ExamsScreen';
import { SubjectsScreen } from './screens/SubjectsScreen';
import { MapScreen } from './screens/MapScreen';
import { StudentScreen } from './screens/StudentScreen';
import { SheetHost } from './sheets/SheetHost';

/**
 * Root of the phone UI. Takes no props: `useAppLogic()` returns desktop-local
 * state (currentView, selectedSubject, currentDate) that the mobile UI slice
 * replaces, so there is nothing to thread through. It is still CALLED
 * unconditionally in App.tsx above the branch — that is what owns IDB
 * hydration and the REIS_READY handshake — we simply do not pass its result.
 *
 * Mounts its own Toaster: App.tsx's Toaster lives inside the desktop return,
 * so the phone branch would otherwise have no toast host and every
 * confirmation would silently do nothing.
 *
 * Routes on `mobileTab` (Task 3's mobile UI slice) between the five
 * placeholder screens Tasks 8–16 fill in, with `BottomNav` driving the switch.
 */
export function MobileApp() {
  const tab = useAppStore((s) => s.mobileTab);
  const demoMode = useAppStore((s) => s.demoMode);
  const offset = toastOffset(demoMode);

  return (
    <div
      data-testid="mobile-app"
      className="relative flex h-screen w-full flex-col overflow-hidden bg-base-200 text-base-content"
    >
      {/* First child, above every screen's own ScreenHeader: each screen is a
          flex-1 sibling below this one, so DemoBanner occupies its own row
          rather than sitting inside (and scrolling away with) tab content,
          and it survives tab switches because it isn't part of the `tab ===`
          branches below. Renders null itself when demo mode is off, so this
          is a no-op for every real student and for the Chrome extension
          tree, which never mounts MobileApp at all. */}
      <DemoBanner />
      {/* Offset by the safe-area inset: a top-center toast otherwise lands on
          top of the status bar under targetSdk 36's forced edge-to-edge, with
          the clock showing through the "Saved to Downloads" confirmation.
          `mobileOffset` is the one that matters and `offset` alone is a no-op
          here — sonner 2.x switches to mobileOffset below a 600px viewport, and
          this device is 411px wide. Both are set so the toast is inset whichever
          branch sonner takes. With demo mode on the offset also clears
          DemoBanner, which occupies that same top strip — see toastOffset. */}
      <Toaster position="top-center" offset={offset} mobileOffset={offset} />
      {/* DemoBanner (above) already spends --safe-top on its own top padding.
          When it's mounted, it — not the active screen — is the topmost thing
          on screen, so the active screen must not pad for the inset a second
          time. Screens read --safe-top through several independent paths
          (ScreenHeader's paddingTop, MapScreen's own floating search bar), so
          rather than special-case demoMode into each one, this wrapper
          shadows the custom property to 0 for the whole subtree — every
          consumer below it sees the inset as already spent, with no per-file
          coordination required. `[--safe-top:0px]` is a Tailwind arbitrary
          property, not a stylesheet: it compiles to the same var() the rest
          of the mobile UI already reads. Off (demoMode false, the common
          case), this is a no-op and every screen keeps reading the real
          inset exactly as before. */}
      <div className={`flex flex-1 flex-col overflow-hidden${demoMode ? ' [--safe-top:0px]' : ''}`}>
        {tab === 'calendar' && <CalendarScreen />}
        {tab === 'exams' && <ExamsScreen />}
        {tab === 'subjects' && <SubjectsScreen />}
        {tab === 'map' && <MapScreen />}
        {tab === 'student' && <StudentScreen />}
      </div>
      <BottomNav />
      <SheetHost />
    </div>
  );
}
