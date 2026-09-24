/**
 * Which reis-data version the cached success rates should match.
 *
 * reis-data's `meta.json` carries a `lastUpdated` that changes on every data
 * refresh. Cached subjects are stamped with the version they were fetched
 * under (`SubjectSuccessRate.cdnVersion`), and one stamped with anything other
 * than the version returned here is fetched again. Without this a refresh
 * never reached a student who already had the subject cached.
 *
 * Fail-safe by construction: any failure to learn a version leaves the last
 * known one in place, and with none known nothing counts as stale.
 */

import { IndexedDBService } from '../services/storage/IndexedDBService';
import { STORAGE_KEYS } from '../services/storage/keys';
import { loggers } from '../utils/logger';
import { CDN_BASE_URL } from './successRate';

const META_URL = `${CDN_BASE_URL}/meta.json`;

/** How often meta.json is asked. Persisted, because the extension's iframe app
 * reloads on every IS navigation — an in-memory "once per session" would mean
 * once per page. */
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;

/** A newly seen version is honoured only after this long. jsDelivr's edge
 * caches every file for `s-maxage=43200` (12h), independently, and the refresh
 * procedure does not purge — so right after a push the edge can serve the new
 * meta.json alongside old subject files. Re-fetching then would stamp old
 * content with the new version, and it would stick until the next refresh. */
const EDGE_SETTLE = 12 * 60 * 60 * 1000;

/** After a failed check, do not ask again for this long (in memory only). */
const FAILURE_BACKOFF = 15 * 60 * 1000;
const META_TIMEOUT = 3000;

interface VersionRecord {
  current: string | null;
  checkedAt: number;
  pending?: { lastUpdated: string; firstSeenAt: number };
}

let inFlight: Promise<string | null> | null = null;
let retryAfter = 0;

const isVersion = (v: unknown): v is string =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v));

const isNewer = (candidate: string, than: string | null) =>
  than === null || Date.parse(candidate) > Date.parse(than);

async function readRecord(): Promise<VersionRecord | null> {
  const raw = (await IndexedDBService.get('meta', STORAGE_KEYS.SUCCESS_RATES_CDN_VERSION).catch(
    () => undefined
  )) as Partial<VersionRecord> | undefined;
  if (!raw || typeof raw.checkedAt !== 'number') return null;
  const current = isVersion(raw.current) ? raw.current : null;
  const p = raw.pending;
  const pending =
    p && isVersion(p.lastUpdated) && typeof p.firstSeenAt === 'number' ? p : undefined;
  return { current, checkedAt: raw.checkedAt, ...(pending ? { pending } : {}) };
}

async function fetchRemoteVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), META_TIMEOUT);
  try {
    const response = await fetch(META_URL, { cache: 'no-cache', signal: controller.signal });
    if (!response.ok) return null;
    const body = (await response.json()) as { lastUpdated?: unknown } | null;
    return isVersion(body?.lastUpdated) ? body.lastUpdated : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function check(): Promise<string | null> {
  const now = Date.now();
  const stored = await readRecord();
  const next: VersionRecord = stored ?? { current: null, checkedAt: 0 };
  let dirty = false;

  const due = !stored || now < stored.checkedAt || now - stored.checkedAt >= CHECK_INTERVAL;
  if (due && now >= retryAfter) {
    const remote = await fetchRemoteVersion();
    if (remote === null) {
      retryAfter = now + FAILURE_BACKOFF;
    } else {
      next.checkedAt = now;
      dirty = true;
      // Only a version newer than anything already seen counts: two POPs can
      // disagree for a while after a push.
      if (isNewer(remote, next.pending?.lastUpdated ?? next.current)) {
        next.pending = { lastUpdated: remote, firstSeenAt: now };
      }
    }
  }

  if (next.pending && now - next.pending.firstSeenAt >= EDGE_SETTLE) {
    next.current = next.pending.lastUpdated;
    delete next.pending;
    dirty = true;
  }

  if (dirty) {
    await IndexedDBService.set('meta', STORAGE_KEYS.SUCCESS_RATES_CDN_VERSION, next).catch((err) =>
      loggers.api.error('[SuccessRateVersion] IDB save failed:', err)
    );
  }
  return next.current;
}

/** The version last honoured, without any network. */
export async function getKnownSuccessRateVersion(): Promise<string | null> {
  return (await readRecord())?.current ?? null;
}

/**
 * The version cached entries should match, asking meta.json when a check is
 * due. Concurrent callers share one check. Never rejects.
 */
export function ensureSuccessRateVersion(): Promise<string | null> {
  inFlight ??= check()
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
