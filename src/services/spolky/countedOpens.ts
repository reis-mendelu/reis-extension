import { IndexedDBService } from '../storage';

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
 * Remembered in IndexedDB (`meta`) as `{ eventId: countedAtMs }`. Entries older
 * than ~6 months are dropped on load: an event's post is long past by then, and
 * the set cannot grow without bound.
 */
export type OpenSurface = 'novinky_click' | 'map_open';

const KEY = (surface: OpenSurface) => `counted_opens_${surface}`;
const FORGET_AFTER_MS = 180 * 24 * 60 * 60 * 1000;

type Counted = Record<string, number>;
const loaded = new Map<OpenSurface, Promise<Counted>>();

function load(surface: OpenSurface): Promise<Counted> {
  let p = loaded.get(surface);
  if (!p) {
    p = (async () => {
      // A blocked or failing IndexedDB must not cost a count: dedupe then holds
      // for the session only.
      const saved = (await IndexedDBService.get('meta', KEY(surface)).catch(() => undefined)) as
        Counted | undefined;
      const cutoff = Date.now() - FORGET_AFTER_MS;
      return Object.fromEntries(Object.entries(saved ?? {}).filter(([, at]) => at > cutoff));
    })();
    loaded.set(surface, p);
  }
  return p;
}

const persist = (surface: OpenSurface, counted: Counted) =>
  IndexedDBService.set('meta', KEY(surface), { ...counted }).catch(() => undefined);

/** True the first time this device opens `id` on `surface`, false ever after. */
export async function claimFirstOpen(surface: OpenSurface, id: string): Promise<boolean> {
  const counted = await load(surface);
  // No await between this check and the write, so two simultaneous taps cannot
  // both pass.
  if (id in counted) return false;
  counted[id] = Date.now();
  await persist(surface, counted);
  return true;
}

/** Take a claim back after the write that justified it failed, so a retry counts. */
export async function releaseOpen(surface: OpenSurface, id: string): Promise<void> {
  const counted = await load(surface);
  delete counted[id];
  await persist(surface, counted);
}

/** Test-only: drop the in-memory copy, as a restart would. */
export function __forgetCountedOpensMemoryForTests(): void {
  loaded.clear();
}

/** Test-only: forget everything, memory and disk. */
export async function __resetCountedOpensForTests(): Promise<void> {
  loaded.clear();
  await Promise.all(
    (['novinky_click', 'map_open'] as const).map((s) =>
      IndexedDBService.delete('meta', KEY(s)).catch(() => undefined)
    )
  );
}
