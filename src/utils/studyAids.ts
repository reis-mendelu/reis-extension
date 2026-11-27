import type { StudyAidsEntry } from '../data/studyAids';
import { matchesAudience, type AudienceViewer } from './partnerAudience';

/**
 * The links under Předměty this student is shown: every entry whose audience,
 * read from `study_aids`, matches their faculty and programme, in the order the
 * code lists them.
 *
 * `audiences` holds only the rows the admin has switched on (RLS hides the
 * rest from students), so an entry without one, a link switched off, and a
 * list that has not loaded yet all give the same answer: no row at all, on
 * either tree. The tokens are the ones a partner's audience uses
 * (`af:B-ATE`, `af`, `mendelu`), so the same matcher decides.
 */
export function studyAidsFor(
  audiences: Readonly<Record<string, readonly string[]>>,
  viewer: AudienceViewer,
  list: readonly StudyAidsEntry[]
): StudyAidsEntry[] {
  return list.filter((entry) => matchesAudience(audiences[entry.id], viewer));
}
