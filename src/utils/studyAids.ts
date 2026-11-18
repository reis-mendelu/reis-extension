import type { StudyAidsEntry } from '../data/studyAids';
import { matchesAudience, type AudienceViewer } from './partnerAudience';

/**
 * The study-aids link this student is shown: the first entry whose audience,
 * read from `study_aids`, matches their faculty and programme.
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
): StudyAidsEntry | null {
  return list.find((entry) => matchesAudience(audiences[entry.id], viewer)) ?? null;
}
