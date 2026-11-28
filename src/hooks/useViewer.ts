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
export type ViewerSource = Pick<AppState, 'userFaculty' | 'isErasmus' | 'userProgramme'>;

/**
 * Who the audience rule is applied to: the one rule behind useViewer (React)
 * and viewerOf (Novinky built outside React: utils/novinky/buildFeed, src/mobile).
 *
 * It is the store's identity and nothing else. While a reis_admin's persona is
 * active, the store holds the persona's faculty, programme and Erasmus status
 * (createImpersonationSlice, guarded by IDENTITY_OVERLAY_KEYS), so the map,
 * Novinky and partners show what that student would see without a second path.
 * Programmes are compared in base form ('B-OI-ZBOI' is 'B-OI'), as audience
 * tokens are written; the store already keeps the base.
 */
export const viewerOf = (s: ViewerSource): Viewer =>
  viewerFrom(s.userFaculty, s.isErasmus, baseProgramme(s.userProgramme));

export function useViewer(): Viewer {
  const userFaculty = useAppStore((s) => s.userFaculty);
  const isErasmus = useAppStore((s) => s.isErasmus);
  const userProgramme = useAppStore((s) => s.userProgramme);
  return useMemo(
    () => viewerOf({ userFaculty, isErasmus, userProgramme }),
    [userFaculty, isErasmus, userProgramme]
  );
}
