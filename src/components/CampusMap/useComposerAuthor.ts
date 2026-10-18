import { useAppStore } from '../../store/useAppStore';
import { audienceOf } from '../../utils/eventAudience';
import { isPartner } from '../../utils/partnerAudience';

/**
 * What the catalog says about the society being authored, as the composer's
 * audience rules need it. Split out of EventComposer.tsx for its line budget.
 */
export function useComposerAuthor(associationId: string | null) {
  // Only a society the catalog KNOWS to be university-wide (reIS) cannot
  // restrict. A society missing from a stale catalog keeps the stored flag
  // rather than having it cleared blind.
  const cannotRestrict = useAppStore((s) => {
    const society = s.societies[associationId ?? ''];
    return !!society && audienceOf(society) === 'everyone';
  });
  const authorIsPartner = useAppStore((s) => isPartner(s.societies[associationId ?? '']));
  // Unknown author = unknown audience: it may be a partner whose events must
  // be restricted, so nothing NEW is published until the catalog names it.
  // An edit keeps its stored flag instead (see cannotRestrict above), and a
  // partner's stored flag is always restricted.
  const authorKnown = useAppStore((s) => Boolean(s.societies[associationId ?? '']));
  return { cannotRestrict, authorIsPartner, authorKnown };
}
