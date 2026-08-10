import { useAppStore } from '../../store/useAppStore';
import { getPlatform } from '../../platform';
import { resolvePhoneViewport } from '../../utils/resolvePhoneViewport';

/**
 * The one place the app asks "am I a phone". `isPhone` is derived, never
 * stored, so there is no second source of truth to drift from the viewport.
 *
 * The host is read straight from the platform rather than the store: it cannot
 * change for the life of the process, so putting it in reactive state would
 * imply it might.
 */
export function usePhoneViewport(): boolean {
  const isTouch = useAppStore((s) => s.isTouch);
  const isNarrow = useAppStore((s) => s.isNarrow);
  const override = useAppStore((s) => s.devPhoneOverride);
  const isNativeApp = getPlatform().kind === 'capacitor';
  return resolvePhoneViewport({ isTouch, isNarrow, isNativeApp, override });
}
