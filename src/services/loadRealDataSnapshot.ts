import { Messages } from '../types/messages';
import type { SyncedData } from '../types/messages';
import { isInIframe } from '../api/proxyClient';
import { IndexedDBService } from '../services/storage';
import type { StoreName } from '../types/storage';
import { isHarnessEnabled } from '../utils/harnessEnabled';

// Non-dotfile so WXT packs it into the dev build; the extension page fetches it
// from its own origin (chrome-extension://<id>/dev-real-data.json). Gitignored.
// The default for the local `dev:web` harness only — the deployed preview
// passes `/preview-data.json` instead, which is the SANITISED file. The raw
// scrape is deleted from every web build by scripts/stripDevRealData.mjs and
// must never be fetched from a deployed page.
const SNAPSHOT_URL = '/dev-real-data.json';

// The IDB stores the real-data snapshot is the authoritative source for. In dev
// real-data mode these are wiped at boot (resetRealDataStores) so a section the
// snapshot OMITS — e.g. an account with no exam terms, where collectRealData
// drops `exams` entirely — shows empty instead of inheriting stale data from an
// earlier VITE_USE_MOCK_DATA session. Without this, boot hydration (fetchExams)
// reads the old ESN mock ("Czech Language for Foreigners") and the empty-list
// guard in setExams keeps it on screen even though the snapshot has no exams.
// Excludes `meta` (holds user_params/theme the snapshot load itself depends on)
// and CDN-fed stores like success_rates (not part of the snapshot).
const SNAPSHOT_STORES: StoreName[] = [
  'schedule',
  'exams',
  'subjects',
  'study_plan',
  'cvicne_tests',
  'odevzdavarny',
  'syllabuses',
  'classmates',
  'zaznamnik',
  'files',
];

/** Dev-only, standalone-only: clear the crawl-data stores so the real-data
 *  snapshot is the single source of truth for the session. No-op in production,
 *  inside the extension iframe, AND — critically — when no snapshot is available
 *  to repopulate from, so a missing snapshot never wipes persisted data with
 *  nothing to restore it. Returns whether it cleared. */
export async function resetRealDataStores(url: string = SNAPSHOT_URL): Promise<boolean> {
  if (!isHarnessEnabled(import.meta.env)) return false;
  if (isInIframe()) return false;
  if (import.meta.env.VITE_USE_MOCK_DATA === 'true') return false;
  // Guard: only wipe when a real snapshot actually exists. A missing file makes
  // the dev server serve the SPA index.html, so res.json() throws — treat that
  // as "no snapshot" and leave IDB untouched.
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    await res.json();
  } catch {
    return false;
  }
  await Promise.all(SNAPSHOT_STORES.map((s) => IndexedDBService.clear(s).catch(() => {})));
  return true;
}

/** Dev-only, standalone-only: load the scraped real-data snapshot and feed it
 *  through the production REIS_SYNC_UPDATE handler. No-op if unavailable. */
export async function loadRealDataSnapshot(url: string = SNAPSHOT_URL): Promise<boolean> {
  if (!isHarnessEnabled(import.meta.env)) return false;
  if (isInIframe()) return false;
  if (import.meta.env.VITE_USE_MOCK_DATA === 'true') return false;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const snapshot = (await res.json()) as SyncedData;
    window.postMessage(Messages.syncUpdate({ ...snapshot, isSyncing: false }), '*');
    return true;
  } catch {
    return false;
  }
}
