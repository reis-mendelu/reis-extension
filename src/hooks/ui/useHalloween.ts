import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { isHalloween } from '../../utils/halloween';

/** Whether the Halloween week is on, from the app's own ticking clock. */
export function useIsHalloween(): boolean {
  return useAppStore((s) => isHalloween(s.now));
}

/**
 * Puts `data-season="halloween"` on <html> while the week lasts, which is what
 * turns the theme's lime to orange (index.css). Mounted once, in App, so both
 * trees get it; it removes the attribute again when the clock leaves the week.
 */
export function useHalloweenSeason(): void {
  const on = useIsHalloween();
  useEffect(() => {
    const root = document.documentElement;
    if (on) root.setAttribute('data-season', 'halloween');
    else root.removeAttribute('data-season');
  }, [on]);
}
