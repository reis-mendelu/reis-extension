import type { Society } from '../types/events';
import type { PartnerStudyAids } from '../data/partnerStudyAids';

/**
 * The study-aids link this student is shown: the first of their partners, in
 * the partners' order, that has one. `partners` is already this student's
 * (`matchingPartners`), so null means no row at all, on either tree.
 */
export function studyAidsFor(
  partners: readonly Society[],
  list: readonly PartnerStudyAids[]
): PartnerStudyAids | null {
  for (const partner of partners) {
    const aids = list.find((a) => a.partnerId === partner.id);
    if (aids) return aids;
  }
  return null;
}
