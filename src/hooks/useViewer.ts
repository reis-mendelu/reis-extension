import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { AppState } from '../store/types';
import { FACULTY_LABEL_TO_KEY } from '../types/events';
import { EXCHANGE_PROGRAMME, type Viewer } from '../utils/eventAudience';
import { baseProgramme } from '../utils/partnerAudience';

export function viewerFrom(
  facultyLabel: string | null,
  erasmus: boolean,
  programme: string | null = null
): Viewer {
  return {
    facultyKey: (facultyLabel && FACULTY_LABEL_TO_KEY[facultyLabel]) || null,
    erasmus: erasmus || programme === EXCHANGE_PROGRAMME,
    exchange: programme === EXCHANGE_PROGRAMME,
    programme,
  };
}

/** The part of the store the viewer is read from. */
export type ViewerSource = Pick<
  AppState,
  'userFaculty' | 'isErasmus' | 'userProgramme' | 'impersonation'
>;

/**
 * Who the audience rule is applied to: the one rule for useViewer (React) and
 * for Novinky built outside React (utils/novinky/buildFeed, src/mobile).
 *
 * While a reis_admin impersonates, it is the impersonated student's faculty and
 * programme, so the map, Novinky and partners show what that student would see.
 * The picker cannot impersonate an Erasmus student, so `erasmus` is false then.
 * `userParams` is NOT overlaid by impersonation, which is why this reads the
 * selection itself. Programmes are compared in base form ('B-OI-ZBOI' is
 * 'B-OI'), as audience tokens are written.
 */
export function viewerOf(s: ViewerSource): Viewer {
  const selection = s.impersonation?.selection;
  return selection?.faculty
    ? viewerFrom(selection.faculty, false, baseProgramme(selection.shortCode))
    : viewerFrom(s.userFaculty, s.isErasmus, baseProgramme(s.userProgramme));
}

export function useViewer(): Viewer {
  const userFaculty = useAppStore((s) => s.userFaculty);
  const isErasmus = useAppStore((s) => s.isErasmus);
  const userProgramme = useAppStore((s) => s.userProgramme);
  const impersonation = useAppStore((s) => s.impersonation);
  return useMemo(
    () => viewerOf({ userFaculty, isErasmus, userProgramme, impersonation }),
    [userFaculty, isErasmus, userProgramme, impersonation]
  );
}
