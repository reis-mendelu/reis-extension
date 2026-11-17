import type { BlockLesson } from '../../../../types/calendarTypes';
import { useAppStore } from '../../../../store/useAppStore';
import { useLongPress } from '../../../../hooks/ui/useLongPress';
import { canHideLesson } from '../../../../hooks/ui/useHideLesson';

/**
 * A held lesson in Týden or Den opens `HideLessonSheet` (suggestion #43). The
 * phone's counterpart of the extension's hover menu: a tap stays "open the
 * subject", so the hide is the press-and-hold every phone calendar puts its
 * second action on.
 *
 * Nothing to spread on an exam or an own event, as the extension has no menu
 * there either — and then a hold is just a slow tap.
 *
 * useLongPress cancels on a move past its slop (the week swipe, Den's scroll),
 * on a second finger anywhere (the pinch between Den and Týden), and swallows
 * the click that ends a hold, so the subject does not open over the menu.
 */
export function useHoldToHide(lesson: BlockLesson) {
  const pushSheet = useAppStore((s) => s.pushSheet);
  const handlers = useLongPress(() => pushSheet({ kind: 'hideLesson', lesson }));
  return canHideLesson(lesson) ? handlers : {};
}
