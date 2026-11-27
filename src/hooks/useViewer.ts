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

type Impersonated = { faculty: string; shortCode?: string | null } | null | undefined;

/**
 * Who the audience rule is applied to: the one rule behind useViewer (React)
 * and viewerOf (Novinky built outside React: utils/novinky/buildFeed, src/mobile).
 *
 * While a reis_admin impersonates, it is the impersonated student's faculty and
 * programme, so the map, Novinky and partners show what that student would see.
 * The picker cannot impersonate an Erasmus student, so `erasmus` is false then.
 * `userParams` is NOT overlaid by impersonation, which is why this reads the
 * selection itself. Programmes are compared in base form ('B-OI-ZBOI' is
 * 'B-OI'), as audience tokens are written; the store already keeps the base.
 */
function resolveViewer(
  own: { faculty: string | null; erasmus: boolean; programme: string | null },
  impersonated: Impersonated
): Viewer {
  return impersonated?.faculty
    ? viewerFrom(impersonated.faculty, false, baseProgramme(impersonated.shortCode))
    : viewerFrom(own.faculty, own.erasmus, baseProgramme(own.programme));
}

/** The viewer from a store snapshot: for code outside React. */
export const viewerOf = (s: ViewerSource): Viewer =>
  resolveViewer(
    { faculty: s.userFaculty, erasmus: s.isErasmus, programme: s.userProgramme },
    s.impersonation?.selection
  );

export function useViewer(): Viewer {
  const faculty = useAppStore((s) => s.userFaculty);
  const erasmus = useAppStore((s) => s.isErasmus);
  const programme = useAppStore((s) => s.userProgramme);
  // Two strings, not the impersonation object: a new `result` is not a new viewer.
  const impFaculty = useAppStore((s) => s.impersonation?.selection.faculty ?? null);
  const impCode = useAppStore((s) => s.impersonation?.selection.shortCode ?? null);
  return useMemo(
    () =>
      resolveViewer(
        { faculty, erasmus, programme },
        impFaculty ? { faculty: impFaculty, shortCode: impCode } : null
      ),
    [faculty, erasmus, programme, impFaculty, impCode]
  );
}
