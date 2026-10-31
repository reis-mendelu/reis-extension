// The entry of the hidden WebView Android's job scheduler loads while reIS is
// closed (android/.../BackgroundCheckService.java). No React, no store: the
// same fetchers and persist functions the foreground app uses, run once.
import './installCapacitorPlatform';

import { loadStoredToken } from '@/platform/tokenStore';
import { getUserParams } from '@/utils/userParams';
import { IndexedDBService } from '@/services/storage/IndexedDBService';
import { fetchDualLanguageExams } from '@/api/exams';
import { fetchDualLanguageSubjects } from '@/api/subjects';
import { syncOdevzdavarny } from '@/services/sync/syncOdevzdavarny';
import { syncZaznamnik } from '@/services/sync/syncZaznamnik';
import { persistZaznamnikBatch } from '@/services/sync/zaznamnikNewPoints';
import { persistNewBoxes } from '@/services/sync/newSubmissionBoxes';
import { persistExamTerms } from '@/services/sync/newExamTerms';
import { boxKey } from '@/utils/newBoxDetection';
import { logError } from '@/utils/reportError';
import { SYNC_LOCK_NAME } from '@/injector/config';
import { runBackgroundCheck } from '@/mobile/backgroundCheck';

/** What the native side offers this page (BackgroundWebRun.Host). */
interface Host {
  notify(json: string): void;
  done(status: string): void;
}
const host = (window as unknown as { ReisBg: Host }).ReisBg;

async function main(): Promise<string> {
  return runBackgroundCheck({
    hasSession: () =>
      loadStoredToken().then(
        (t) => !!t,
        () => false
      ),
    params: () => getUserParams(),
    language: async () =>
      (await IndexedDBService.get('meta', 'reis_language')) === 'en' ? 'en' : 'cz',
    // The lock the foreground sync takes, shared with this WebView: while the
    // app is crawling this run leaves, and while this run crawls the app's tick does.
    withSyncLock: async (job) => {
      // An old WebView has no Web Locks, and nothing to take turns with either:
      // the foreground sync has the same fallback.
      if (!navigator.locks) {
        await job();
        return true;
      }
      return navigator.locks.request(SYNC_LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (!lock) return false;
        await job();
        return true;
      });
    },
    fetchSubjects: async (studium, obdobi) =>
      (await fetchDualLanguageSubjects(studium, obdobi))?.subjects ?? null,
    fetchExams: fetchDualLanguageExams,
    persistExamTerms,
    syncBoxes: syncOdevzdavarny,
    persistBoxes: persistNewBoxes,
    boxKey,
    syncZaznamnik,
    persistZaznamnik: persistZaznamnikBatch,
    notify: (list) => host.notify(JSON.stringify(list)),
    logError,
  });
}

main().then(
  (status) => host.done(status),
  (err) => host.done(`crashed: ${(err as Error)?.message ?? err}`)
);
