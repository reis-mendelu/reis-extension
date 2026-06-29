import type { SubjectSuccessRate } from '@/types/documents';

// Real IS `predmet` ids are 5-6 digit numbers. reis-data occasionally carries junk
// ids (e.g. "3", "7") that resolve to the wrong subject — reject anything shorter.
const VALID_PREDMET_ID = /^\d{5,}$/;

/**
 * Resolve a usable IS `predmet` id for a not-enrolled subject from its success-rate
 * record, so it can be opened directly in the SubjectDrawer. Returns undefined when
 * there is no record, no id, or the id fails the validity guard (caller falls back
 * to search).
 */
export function resolvePredmetId(rate?: SubjectSuccessRate): string | undefined {
  const id = rate?.predmetId;
  return id && VALID_PREDMET_ID.test(id) ? id : undefined;
}
