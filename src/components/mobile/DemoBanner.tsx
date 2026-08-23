import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { logError } from '../../utils/reportError';

/**
 * Always visible while demo mode is on.
 *
 * Two jobs, and the second is the reason it is not dismissible: a student must
 * never mistake fabricated grades for their own, and an App Store reviewer
 * should be able to tell what they are looking at without reading the review
 * notes.
 *
 * `exitDemo()` does the same sequential IndexedDB wipe as `enterDemo()` (see
 * `LoginGate`'s demo button), so it gets the identical double-tap guard: a
 * bare fire-and-forget click risks a second tap interleaving with the first
 * wipe, and a failed exit must not strand the student on a dead control.
 */
export function DemoBanner() {
  const { t } = useTranslation();
  const demoMode = useAppStore((s) => s.demoMode);
  const exitDemo = useAppStore((s) => s.exitDemo);
  const [exitPending, setExitPending] = useState(false);

  if (!demoMode) return null;

  const handleExitTap = async () => {
    if (exitPending) return;
    setExitPending(true);
    try {
      await exitDemo();
    } catch (err) {
      // Clear pending on failure so the tap is not a dead end — same reasoning
      // as LoginGate's demo button.
      logError('DemoBanner.exitDemo', err);
    } finally {
      setExitPending(false);
    }
  };

  return (
    // Mounted above MobileApp's tab content (see MobileApp.tsx), which makes
    // this the topmost element on screen whenever it's visible — so, like
    // ScreenHeader and the MapScreen floating bar, it must carry --safe-top
    // itself or it renders under the status bar/camera cutout. Tailwind
    // arbitrary value instead of a style prop, matching MapScreen's pattern.
    <div className="flex flex-shrink-0 items-center justify-center gap-3 bg-warning/20 px-4 pb-1 pt-[calc(0.25rem_+_var(--safe-top,0px))] text-xs text-base-content">
      <span className="font-semibold">{t('demo.bannerLabel')}</span>
      <button
        className="btn btn-ghost btn-xs"
        onClick={() => void handleExitTap()}
        disabled={exitPending}
      >
        {exitPending ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          t('demo.bannerExit')
        )}
      </button>
    </div>
  );
}
