import { useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { initialKind } from './composerPost';
import type { MapEvent, PostKind } from '../../types/events';

/**
 * The composer's event-or-notice switch. A notice has no place, so switching
 * to one takes the draft pin off the map and leaves a pending "pick on map"
 * (whose next click would drop the pin again). The pin is put aside, not
 * thrown away: switching back restores it, and with it the picked room or
 * place (useVenuePicker keeps a pick only while the pin is where it put it).
 * A mistaken tap on Oznámení must not cost an event its room — saved without
 * one, it silently leaves the student map. buildPostInput drops the place
 * from a notice's row either way.
 */
export function useComposerKind(source: MapEvent | null) {
  const [kind, setKind] = useState<PostKind>(() => initialKind(source));
  const draftCoord = useAppStore((s) => s.draftCoord);
  const clearDraftCoord = useAppStore((s) => s.clearDraftCoord);
  const placeDraftCoord = useAppStore((s) => s.placeDraftCoord);
  const cancelPlacing = useAppStore((s) => s.cancelPlacing);
  const stashed = useRef<[number, number] | null>(null);

  const changeKind = (next: PostKind) => {
    if (next === kind) return;
    if (next === 'notice') {
      stashed.current = draftCoord;
      clearDraftCoord();
      cancelPlacing();
    } else if (stashed.current) {
      placeDraftCoord(stashed.current);
      stashed.current = null;
    }
    setKind(next);
  };
  return [kind, changeKind] as const;
}
