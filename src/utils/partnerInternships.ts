import type { Society } from '../types/events';
import type { PartnerInternship } from '../data/partnerInternships';

export interface ShownInternship {
  internship: PartnerInternship;
  partner: Society;
}

/**
 * The programmes of the partners a student is shown, in the partners' order.
 * `partners` is already this student's (`matchingPartners`); empty means no
 * Stáže button at all, on either tree.
 */
export function internshipsFor(
  partners: readonly Society[],
  list: readonly PartnerInternship[]
): ShownInternship[] {
  return partners.flatMap((partner) =>
    list.filter((i) => i.partnerId === partner.id).map((internship) => ({ internship, partner }))
  );
}
