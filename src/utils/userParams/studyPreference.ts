import { getPlatform } from '../../platform';
import { logError } from '../reportError';

const KEY = 'reis_preferred_study';

interface Preference {
  studentId: string;
  studium: string;
}

/**
 * The study a student with more than one picked in reIS.
 *
 * In the platform's settings storage, not IndexedDB: in the extension that is
 * `chrome.storage.local`, which the content script and the iframe SHARE — each
 * keeps its own IndexedDB, and both have to agree on the study. Keyed by the
 * student, because this storage outlives the wipe a different student's
 * sign-in does. Reads fail soft: the MCP under Node has no platform, and no
 * preference is the normal state for almost everyone.
 */
export async function getPreferredStudium(studentId: string): Promise<string | null> {
  if (!studentId) return null;
  try {
    const p = (await getPlatform().storage.get(KEY)) as Partial<Preference> | undefined;
    return p?.studentId === studentId && p.studium ? p.studium : null;
  } catch {
    return null;
  }
}

export async function setPreferredStudium(studentId: string, studium: string): Promise<void> {
  try {
    await getPlatform().storage.set(KEY, { studentId, studium } satisfies Preference);
  } catch (e) {
    logError('studyPreference.set', e);
    throw e;
  }
}
