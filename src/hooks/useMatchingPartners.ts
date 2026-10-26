import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { matchingPartners } from '../utils/partnerAudience';
import { useViewer } from './useViewer';
import type { Society } from '../types/events';

/** The partners of this student's field, decided on the device (spec 2026-10-09). */
export function useMatchingPartners(): Society[] {
  const societies = useAppStore((s) => s.societies);
  const viewer = useViewer();
  return useMemo(() => matchingPartners(societies, viewer), [societies, viewer]);
}
