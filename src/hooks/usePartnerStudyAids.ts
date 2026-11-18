import { useMemo } from 'react';
import { PARTNER_STUDY_AIDS, type PartnerStudyAids } from '../data/partnerStudyAids';
import { studyAidsFor } from '../utils/partnerStudyAids';
import { useMatchingPartners } from './useMatchingPartners';

/** The study-aids link for this student's field, decided on the device. */
export function usePartnerStudyAids(): PartnerStudyAids | null {
  const partners = useMatchingPartners();
  return useMemo(() => studyAidsFor(partners, PARTNER_STUDY_AIDS), [partners]);
}
