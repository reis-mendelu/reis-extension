import { useAppStore } from '../../store/useAppStore';
import { AdminConsoleHeader } from './AdminConsoleHeader';
import { AdminEventList } from './AdminEventList';
import { AdminConsoleMap } from './AdminConsoleMap';

// A phone has no room for a permanent map pane, so the console is a stack of
// one screen at a time: the event list, the composer that replaces it (both
// live inside AdminEventList), and the map — which surfaces only while the
// composer is asking for a pin. Placing a coordinate clears `placingEvent`,
// which pops the map and puts the composer back.
//
// The list sits on `bg-base-100`, matching the desktop aside rather than the
// page backdrop. EventComposer's header is `bg-base-200/60`, which is designed
// to read as a tint over base-100; dropped straight onto base-200 it measures
// 1.005:1 and disappears in the dark theme. The map pane keeps the plain
// backdrop — it paints its own tiles edge to edge.
export function MobileAdminConsole() {
  const placing = useAppStore((s) => s.placingEvent);

  return (
    <div
      data-testid="admin-console-mobile"
      className="flex h-screen w-full flex-col overflow-hidden bg-base-200 pt-[var(--safe-top,0px)] text-base-content"
    >
      <AdminConsoleHeader compact />
      <div className={`min-h-0 flex-1 ${placing ? '' : 'bg-base-100'}`}>
        {placing ? <AdminConsoleMap /> : <AdminEventList />}
      </div>
    </div>
  );
}
