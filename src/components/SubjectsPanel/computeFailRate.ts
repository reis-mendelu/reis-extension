import type { SubjectSuccessRate } from '@/types/documents';

/** 
 * Avg fail rate over last relevant semesters using "Všechny termíny" aggregate. 
 * Returns 0-100 or null.
 * 
 * targetSemesterType: 'ZS' | 'LS' | null. If provided, filters stats to only include that semester type.
 */
export function computeFailRate(sr: SubjectSuccessRate | undefined, targetSemesterType?: 'ZS' | 'LS' | null): number | null {
  if (!sr?.stats?.length) return null;
  
  let stats = sr.stats;
  
  // If we know which semester we are interested in (ZS or LS), prioritize that.
  // Subjects are usually only taught once a year.
  if (targetSemesterType) {
    stats = stats.filter(s => s.semesterName.includes(targetSemesterType));
  }

  const recent = stats.slice(0, 3);
  if (recent.length === 0) return null;

  let totalPass = 0, totalFail = 0;
  for (const sem of recent) {
    const allTerms = sem.terms.find(t => t.term === 'Všechny termíny');
    if (allTerms) { totalPass += allTerms.pass; totalFail += allTerms.fail; }
    else { totalPass += sem.totalPass; totalFail += sem.totalFail; }
  }
  const total = totalPass + totalFail;
  if (total < 10) return null; // Too few students for meaningful data
  return Math.round((totalFail / total) * 100);
}
