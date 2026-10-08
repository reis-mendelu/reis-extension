import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FACULTY_LABEL_TO_KEY } from '../types/events';
import type { Viewer } from '../utils/eventAudience';

export function viewerFrom(facultyLabel: string | null, erasmus: boolean): Viewer {
  return { facultyKey: (facultyLabel && FACULTY_LABEL_TO_KEY[facultyLabel]) || null, erasmus };
}

/**
 * Who the event audience rule is applied to. While a reis_admin impersonates,
 * it is the impersonated student's faculty, so the map and Novinky show what
 * that student would see. The picker cannot impersonate an Erasmus student, so
 * `erasmus` is false then. `userParams` is NOT overlaid by impersonation, which
 * is why this reads the selection itself.
 */
export function useViewer(): Viewer {
  const own = useAppStore((s) => s.userFaculty);
  const erasmus = useAppStore((s) => s.isErasmus);
  const impersonated = useAppStore((s) => s.impersonation?.selection.faculty ?? null);
  return useMemo(
    () => (impersonated ? viewerFrom(impersonated, false) : viewerFrom(own, erasmus)),
    [own, erasmus, impersonated]
  );
}
