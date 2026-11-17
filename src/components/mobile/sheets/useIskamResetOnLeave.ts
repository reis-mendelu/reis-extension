import { useEffect, useRef } from 'react';
import { useIskamStore } from '../../../mobile/iskam/iskamStore';

/**
 * Drops the ISIC state when a sheet showing the balance row goes away — by any
 * route: Android back and a tab switch remove a sheet without its onClose (PR
 * #548 review), so this runs on unmount. A cleanup, not a fetch: the check
 * starts from the tap that opened the sheet.
 *
 * One microtask late, and cancelled if the effect runs again. In dev,
 * StrictMode runs setup → cleanup → setup on mount, and a reset in that
 * simulated unmount dropped the check the tap had just started, leaving the
 * sheet empty (review #645). A real unmount never re-runs setup, so the reset
 * still lands — before the next tap can start anything.
 *
 * Shared by MenuSheet and IskamSheet. Phone/iPad only —
 * src/test/guards/desktopHasNoIskam.test.ts.
 */
export function useIskamResetOnLeave(): void {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) useIskamStore.getState().reset();
      });
    };
  }, []);
}
