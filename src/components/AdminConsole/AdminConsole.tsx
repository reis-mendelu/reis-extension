import { Toaster } from '../ui/sonner';
import { useAppStore } from '../../store/useAppStore';
import { usePhoneViewport } from '../../hooks/ui/usePhoneViewport';
import { AdminConsoleHeader } from './AdminConsoleHeader';
import { AdminEventList } from './AdminEventList';
import { AdminConsoleMap } from './AdminConsoleMap';
import { AdminLoginScreen } from './AdminLoginScreen';
import { MobileAdminConsole } from './MobileAdminConsole';

/**
 * The admin surface, reached only through "Spravovat spolky" in the profile
 * popover. App.tsx returns this INSTEAD of the student shell, so the sidebar,
 * header, search and student views are not merely hidden — they are unmounted.
 * That is the whole point: the student and admin interfaces are separate
 * surfaces, not one surface with a tab swapped.
 *
 * Mounts its own Toaster. App.tsx's lives inside the desktop return and
 * MobileApp mounts a second one, so without this every save/delete
 * confirmation in the console would silently do nothing.
 */
export function AdminConsole() {
  const session = useAppStore((s) => s.adminSession);
  const isPhone = usePhoneViewport();

  if (!session) {
    return (
      <>
        <Toaster position="top-center" />
        <AdminLoginScreen />
      </>
    );
  }

  if (isPhone) {
    return (
      <>
        <Toaster position="top-center" />
        <MobileAdminConsole />
      </>
    );
  }

  return (
    <div
      data-testid="admin-console"
      className="flex h-screen w-full flex-col overflow-hidden bg-base-200 font-sans text-base-content"
    >
      <Toaster position="top-center" />
      <AdminConsoleHeader />
      <div className="flex min-h-0 flex-1">
        <aside className="w-96 shrink-0 border-r border-base-300 bg-base-100">
          <AdminEventList />
        </aside>
        <div className="min-w-0 flex-1">
          <AdminConsoleMap />
        </div>
      </div>
    </div>
  );
}
