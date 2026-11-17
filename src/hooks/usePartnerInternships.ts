import { useMemo } from 'react';
import { PARTNER_INTERNSHIPS } from '../data/partnerInternships';
import { internshipsFor, type ShownInternship } from '../utils/partnerInternships';
import { useMatchingPartners } from './useMatchingPartners';

/** Stáže for this student: their partners' programmes, decided on the device. */
export function usePartnerInternships(): ShownInternship[] {
  const partners = useMatchingPartners();
  return useMemo(() => internshipsFor(partners, PARTNER_INTERNSHIPS), [partners]);
}
