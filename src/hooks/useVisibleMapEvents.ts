import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useViewer } from './useViewer';
import { visibleToStudent } from '../utils/eventAudience';
import type { MapEvent } from '../types/events';

/**
 * The map events this student should be shown — the single seam every surface
 * that displays events goes through (pins, the Akce list, the peek band), so
 * they cannot disagree. Filtered at READ time against who the student is
 * (`useViewer`), because the fetch is anonymous and the server never sees it.
 */
export function useVisibleMapEvents(): MapEvent[] {
  const events = useAppStore((s) => s.mapEvents);
  const societies = useAppStore((s) => s.societies);
  const viewer = useViewer();
  return useMemo(() => visibleToStudent(events, societies, viewer), [events, societies, viewer]);
}
