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
      <Toaster position="top-center" />
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
