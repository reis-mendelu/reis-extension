import { useAppStore } from '../../store/useAppStore';
import { resolvePhoneViewport } from '../../utils/resolvePhoneViewport';

/**
 * The one place the app asks "am I a phone". `isPhone` is derived, never
 * stored, so there is no second source of truth to drift from the viewport.
 */
export function usePhoneViewport(): boolean {
  const isTouch = useAppStore((s) => s.isTouch);
  const isNarrow = useAppStore((s) => s.isNarrow);
  const override = useAppStore((s) => s.devPhoneOverride);
  return resolvePhoneViewport({ isTouch, isNarrow, override });
}
