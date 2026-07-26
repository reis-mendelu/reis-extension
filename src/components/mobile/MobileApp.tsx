import { Toaster } from '../ui/sonner';

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
 */
export function MobileApp() {
    return (
        <div
            data-testid="mobile-app"
            className="flex h-screen w-full flex-col overflow-hidden bg-base-200 text-base-content"
        >
            <Toaster position="top-center" />
        </div>
    );
}
