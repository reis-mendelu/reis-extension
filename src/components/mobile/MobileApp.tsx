import { Toaster } from '../ui/sonner';
import { useAppStore } from '../../store/useAppStore';
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

  return (
    <div
      data-testid="mobile-app"
      className="relative flex h-screen w-full flex-col overflow-hidden bg-base-200 text-base-content"
    >
      {/* Offset by the safe-area inset: a top-center toast otherwise lands on
          top of the status bar under targetSdk 36's forced edge-to-edge, with
          the clock showing through the "Saved to Downloads" confirmation.
          `mobileOffset` is the one that matters and `offset` alone is a no-op
          here — sonner 2.x switches to mobileOffset below a 600px viewport, and
          this device is 411px wide. Both are set so the toast is inset whichever
          branch sonner takes. The 16px sides/bottom are sonner's own mobile
          defaults, restated because passing an object replaces them. */}
      <Toaster
        position="top-center"
        offset={{
          top: 'calc(1.5rem + var(--safe-top, 0px))',
          right: '24px',
          left: '24px',
          bottom: '24px',
        }}
        mobileOffset={{
          top: 'calc(1rem + var(--safe-top, 0px))',
          right: '16px',
          left: '16px',
          bottom: '16px',
        }}
      />
      {tab === 'calendar' && <CalendarScreen />}
      {tab === 'exams' && <ExamsScreen />}
      {tab === 'subjects' && <SubjectsScreen />}
      {tab === 'map' && <MapScreen />}
      {tab === 'student' && <StudentScreen />}
      <BottomNav />
      <SheetHost />
    </div>
  );
}
