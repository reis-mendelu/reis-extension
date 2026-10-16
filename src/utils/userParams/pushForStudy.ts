import type { SyncDomain } from '../../types/messages/base';

/** The fields of a sync push that are not about any one study. */
interface Push {
  studium?: string;
  schedule?: unknown;
  isSyncing?: boolean;
  lastSync?: number;
  error?: string;
  loaded?: SyncDomain[];
}

/**
 * What the app may take from one sync push, given the study it is on.
 *
 * A crawl that was already running when the student switched study keeps
 * pushing the study they left (the content script waits it out rather than
 * cut it short — see `requestSync('study')`). Taken whole, that push refilled
 * the new study's exams and stored the old study's practice tests under the
 * new study's key. So a push stamped for another study keeps only what is not
 * the study's: the timetable (keyed on the student, both studies in it), the
 * sync status, and the timetable's arrival.
 *
 * An unstamped push (an older content script, the dev snapshot) and a push
 * while the app knows no study yet are taken as they are.
 */
export function pushForStudy<P extends Push>(push: P, ownStudium: string | null | undefined): P {
  if (!push.studium || !ownStudium || push.studium === ownStudium) return push;
  // Everything study-scoped left out; what remains is a valid P.
  return {
    studium: push.studium,
    schedule: push.schedule,
    isSyncing: push.isSyncing,
    lastSync: push.lastSync,
    error: push.error,
    loaded: push.loaded?.filter((d) => d === 'schedule'),
  } as P;
}
