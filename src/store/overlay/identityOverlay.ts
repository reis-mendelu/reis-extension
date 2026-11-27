import type { ImpersonationSelection } from '../../api/impersonation/types';
import { EXCHANGE_PROGRAMME } from '../../utils/eventAudience';
import { baseProgramme } from '../../utils/partnerAudience';

/**
 * The persona's identity, as the store holds a student's own: its faculty
 * label, its BASE programme code (audience tokens are written in base form),
 * and the Erasmus flag. An exchange student is IS programme Z-EXC whatever the
 * selection's code. Derived from the selection every time, never saved apart
 * from it, so a restore after a relaunch puts back exactly the same identity.
 */
export function identityOverlay(
  selection: Pick<ImpersonationSelection, 'faculty' | 'shortCode' | 'erasmus'>
) {
  const erasmus = selection.erasmus === true;
  return {
    userFaculty: selection.faculty,
    userProgramme: erasmus ? EXCHANGE_PROGRAMME : baseProgramme(selection.shortCode),
    isErasmus: erasmus,
  };
}
