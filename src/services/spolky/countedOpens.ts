import { IndexedDBService } from '../storage';
import { logError } from '../../utils/reportError';

/**
 * Which society events this DEVICE has already been counted for, per surface.
 *
 * "How many people opened this event" is answered by counting each device once,
 * not by sending an identifier: the server rows (`increment_post_click`,
 * `increment_event_map_view`) carry an event id and nothing else, and they must
 * stay unjoinable (CLAUDE.md, "What reIS still sends", items 4 and 5). So the
 * dedupe lives here, on the device, and nothing about it is ever transmitted.
 *
 * Once per device per event EVER, not per day, although the map rollup is keyed
 * per day: the question is how many devices opened an event, and a second visit
 * tomorrow is the same device. A reinstall or a second device counts again.
 *
 * The protocol is claim → send → confirm. A claim only reserves the id in
 * memory, so a tab closed mid-request leaves nothing on disk and the next open
 * retries; `confirmOpen` writes it down once the server has answered, and
 * `releaseOpen` gives the reservation back when it failed. Every disk access
 * reads the saved map fresh under a Web Lock, so two extension tabs share one
 * truth instead of each trusting a stale copy.
 *
 * Stored in IndexedDB (`meta`) as `{ eventId: countedAtMs }`; entries older than
 * ~6 months are dropped on read (the post is long past, and the set stays small).
 * If IndexedDB is unusable the dedupe still holds for the session.
 */
const SURFACES = ['novinky_click', 'map_open', 'question_seen', 'question_answer'] as const;
/**
 * `question_*` (2026-10): a Novinky question (`api/questions.ts`) is counted as
 * seen once and answered once per device, keyed by the question id.
 */
export type OpenSurface = (typeof SURFACES)[number];

const KEY = (surface: OpenSurface) => `counted_opens_${surface}`;
const FORGET_AFTER_MS = 180 * 24 * 60 * 60 * 1000;

type Counted = Record<string, number>;
/** Reserved or confirmed this session; the fallback when the disk is unusable. */
const session = Object.fromEntries(SURFACES.map((s) => [s, new Set<string>()])) as Record<
  OpenSurface,
  Set<string>
>;

async function readSaved(surface: OpenSurface): Promise<Counted> {
  try {
    const saved = (await IndexedDBService.get('meta', KEY(surface))) as Counted | undefined;
    const cutoff = Date.now() - FORGET_AFTER_MS;
    return Object.fromEntries(Object.entries(saved ?? {}).filter(([, at]) => at > cutoff));
  } catch (err) {
    logError('Spolky.countedOpens.read', err);
    return {};
  }
}

async function writeSaved(surface: OpenSurface, counted: Counted): Promise<void> {
  try {
    await IndexedDBService.set('meta', KEY(surface), counted);
  } catch (err) {
    logError('Spolky.countedOpens.write', err);
  }
}

/** One read-modify-write at a time across tabs (Web Locks where they exist). */
async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? await locks.request('reis_counted_opens', fn) : fn();
}

/** True if this device has not been counted for `id` on `surface`; reserves it. */
export async function claimFirstOpen(surface: OpenSurface, id: string): Promise<boolean> {
  // Checked and reserved with no await between, so two simultaneous taps in one
  // tab cannot both pass.
  if (session[surface].has(id)) return false;
  session[surface].add(id);
  const saved = await exclusive(() => readSaved(surface));
  return !(id in saved);
}

/** The server has the count: write it down so later launches skip it. */
export async function confirmOpen(surface: OpenSurface, id: string): Promise<void> {
  await exclusive(async () => {
    const saved = await readSaved(surface);
    saved[id] = Date.now();
    await writeSaved(surface, saved);
  });
}

/** The request failed: give the reservation back so the next open retries. */
export function releaseOpen(surface: OpenSurface, id: string): void {
  session[surface].delete(id);
}

/** Test-only: drop the in-memory reservations, as a restart would. */
export function __forgetCountedOpensMemoryForTests(): void {
  for (const s of SURFACES) session[s].clear();
}

/** Test-only: forget everything, memory and disk. */
export async function __resetCountedOpensForTests(): Promise<void> {
  __forgetCountedOpensMemoryForTests();
  await Promise.all(
    SURFACES.map((s) =>
      IndexedDBService.delete('meta', KEY(s)).catch(() => undefined)
    )
  );
}
