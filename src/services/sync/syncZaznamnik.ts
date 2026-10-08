import pLimit from 'p-limit';
import { fetchSubjectZaznamnik } from '../../api/zaznamnik';
import type { SubjectZaznamnik } from '../../types/zaznamnik';
import { IndexedDBService } from '../storage/IndexedDBService';

// Domain-specific cap: each call fans out to PH + VT (2 fetches), so 2 in flight = 4 sockets.
const zaznamnikLimit = pLimit(2);

export interface ZaznamnikSyncInput {
  courseCode: string;
  subjectId: string;
  hasPrubezne?: boolean;
  hasTest?: boolean;
}

export async function syncZaznamnik(
  studium: string,
  obdobi: string,
  inputs: ZaznamnikSyncInput[]
): Promise<Record<string, SubjectZaznamnik | null>> {
  const result: Record<string, SubjectZaznamnik | null> = {};
  await Promise.all(
    inputs
      .filter((i) => i.subjectId && (i.hasPrubezne || i.hasTest))
      .map((i) =>
        zaznamnikLimit(async () => {
          try {
            result[i.courseCode] = await fetchSubjectZaznamnik(studium, obdobi, i.subjectId);
          } catch {
            // Swallow per-subject failures — partial map is fine, merge guard prevents overwrite
          }
        })
      )
  );
  return result;
}

/**
 * The drawer's retry for one subject (Návrhy #26): fetch, and persist real
 * records the way the sync does — never a failure (null) or an empty page.
 * Here rather than in the store slice, because services/sync is the only
 * writer to persistent state.
 */
export async function refetchSubjectZaznamnik(
  studium: string,
  obdobi: string,
  courseCode: string,
  subjectId: string
): Promise<SubjectZaznamnik | null> {
  const fresh = await fetchSubjectZaznamnik(studium, obdobi, subjectId);
  if (fresh && (fresh.ph.sections.length > 0 || fresh.vt.tests.length > 0)) {
    await IndexedDBService.set('zaznamnik', courseCode, fresh);
  }
  return fresh;
}
