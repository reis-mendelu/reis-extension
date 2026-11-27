import { create } from 'zustand';
import { fetchAllBlocks, type Block } from './availability';
import { nativeBookingsHttp } from './transport';
import { logError } from '../../utils/reportError';
import type { BookingsHttp } from './bookingsBase';
import { LIBRARY_ROOMS } from '../../data/map/libraryRooms';
import {
  readNoticeSeen,
  readSaved,
  writeNoticeSeen,
  writeSaved,
  SAVED_MAX_MS,
} from './libraryCache';
import { withBusy, withoutBusy } from './libraryHours';
import { isoDay } from './libraryDay';
import { startLibraryWatch } from './libraryWatch';

export type LibraryStatus = 'idle' | 'loading' | 'ready' | 'offline';

/** Availability older than this is read again when the library is opened. */
export const STALE_MS = 2 * 60 * 1000;
/** A read this slow is kept in the device's diagnostic log (see `load`). */
export const SLOW_READ_MS = 8_000;
/** How many days ahead the room card offers. */
export const DAYS_AHEAD = 7;

export interface LibraryState {
  /** Per map room id. `null` = could not ask, which is not "nothing free". */
  blocks: Record<number, Block[] | null>;
  status: LibraryStatus;
  fetchedAt: number | null;
  /** Set while `blocks` is the last answer from the device, taken at this time, and no new one has come. */
  savedAt: number | null;
  load(http?: BookingsHttp, now?: Date): Promise<void>;
  /** The card's day (`YYYY-MM-DD`), null until the student picks one. */
  day: string | null;
  /** The picked run of hours on that day: the map colours rooms by it. */
  picked: number[];
  /** The room the picked hours are in; null while nothing is picked. */
  room: number | null;
  setDay(day: string): void;
  /** One pick: a room and its consecutive hours. An empty run is no pick. */
  setPick(room: number, hours: number[]): void;
  clearPick(): void;
  /**
   * Whether this student has already been told, once, what the library receives
   * (name, e-mail, student number, faculty). The first booking shows the confirm
   * sheet with that sentence; after it, a tap on the check books.
   */
  noticeSeen: boolean;
  loadNotice(): Promise<void>;
  markNoticeSeen(): void;
  /**
   * A booking, extension or cancel is running. Held here, not in the form that
   * started it: leaving the form (another room on the iPad, Android Back) must
   * not let a second write start against the same, not yet updated, calendar.
   */
  writing: boolean;
  /** Takes the write lock; false when another write holds it. */
  startWrite(): boolean;
  endWrite(): void;
  /** After a cancel: those hours are ours no more, and the next open reads afresh. */
  markFree(featureId: number, day: string, hours: number[]): void;
  /** After a booking of ours: the hour is gone without waiting for the next read. */
  markTaken(featureId: number, day: string, hour: number): void;
  reset(): void;
}

let seq = 0;
/**
 * Counts the booking and cancel results that changed what the library holds
 * (`markTaken`, `markFree`). A read that was out when one landed may have been
 * answered before it, and putting it in would show the booked hour as free again
 * for the whole stale window.
 */
let writes = 0;

/**
 * The library's free hours, per room. A store of its own, NOT a slice of
 * useAppStore, for the reason `iskamStore` gives: the extension builds that one
 * and library booking must not reach it (desktopHasNoLibraryBooking.test.ts).
 * Memory, plus the last answer on the device (`libraryCache`) to show while a read
 * is out: a list of free hours is stale in minutes, so that copy is only ever shown
 * marked with when it was taken.
 */
export const useLibraryStore = create<LibraryState>((set, get) => ({
  blocks: {},
  status: 'idle',
  fetchedAt: null,
  savedAt: null,
  day: null,
  picked: [],
  room: null,
  noticeSeen: false,
  async loadNotice() {
    if (await readNoticeSeen()) set({ noticeSeen: true });
  },
  markNoticeSeen() {
    if (get().noticeSeen) return;
    set({ noticeSeen: true });
    writeNoticeSeen();
  },
  writing: false,
  startWrite: () => {
    if (get().writing) return false;
    set({ writing: true });
    return true;
  },
  endWrite: () => set({ writing: false }),
  markFree(featureId, day, hours) {
    writes++;
    const list = get().blocks[featureId];
    set({
      fetchedAt: null,
      ...(list ? { blocks: { ...get().blocks, [featureId]: withoutBusy(list, day, hours) } } : {}),
    });
  },
  setDay: (day) => set({ day, picked: [], room: null }),
  setPick: (room, picked) => set(picked.length ? { room, picked } : { room: null, picked: [] }),
  clearPick: () => set({ room: null, picked: [] }),

  async load(http = nativeBookingsHttp, now = new Date()) {
    const { status, fetchedAt } = get();
    if (status === 'loading') return;
    if (status === 'ready' && fetchedAt !== null && now.getTime() - fetchedAt < STALE_MS) return;
    const mine = ++seq;
    set({ status: 'loading' });
    if (!get().noticeSeen) void get().loadNotice();
    // The last answer on this device is shown while the library thinks.
    const restored = readSaved(now.getTime()).then((saved) => {
      const nothingYet = !Object.values(get().blocks).some(Array.isArray);
      if (saved && nothingYet && mine === seq && get().status === 'loading')
        set({ blocks: saved.blocks, savedAt: saved.savedAt });
    });
    const to = new Date(now);
    to.setDate(to.getDate() + DAYS_AHEAD);
    const startedAt = Date.now();
    const writesAtStart = writes;
    const all = await fetchAllBlocks(
      http,
      LIBRARY_ROOMS.map((r) => r.staffMemberId),
      isoDay(now),
      isoDay(to)
    );
    const results = LIBRARY_ROOMS.map(
      (r) => [r.featureId, all?.[r.staffMemberId] ?? null] as const
    );
    // The library answered in 0.3–1.6 s from a laptop on 2026-11-27 and in 8–14 s on
    // 2026-10-30; which one a phone sees is not known. A slow read leaves one line in
    // the local diagnostic log (kept in memory, sent only if the student attaches it).
    const took = Date.now() - startedAt;
    if (took >= SLOW_READ_MS)
      logError('Library.slowRead', new Error(`availability took ${Math.round(took / 1000)} s`));
    await restored;
    if (mine !== seq) return;
    if (writes !== writesAtStart) {
      // Not used, and not left on "loading" (every later read would return early):
      // read again, which can only begin after that booking or cancel.
      set({ status: 'idle', fetchedAt: null });
      return get().load(http, now);
    }
    const blocks = Object.fromEntries(results);
    const any = results.some(([, b]) => b !== null);
    const kept = get().savedAt;
    if (!any && kept !== null && now.getTime() - kept < SAVED_MAX_MS) {
      // No answer, but a saved one still young enough is on screen: keep it, read again next time.
      set({ status: 'idle', fetchedAt: null });
      return;
    }
    set({
      blocks,
      status: any ? 'ready' : 'offline',
      fetchedAt: any ? now.getTime() : null,
      savedAt: null,
    });
    if (any) writeSaved(blocks, now.getTime());
  },

  markTaken(featureId, day, hour) {
    writes++;
    const list = get().blocks[featureId];
    if (list) set({ blocks: { ...get().blocks, [featureId]: withBusy(list, day, hour) } });
  },

  reset() {
    seq++;
    set({
      blocks: {},
      status: 'idle',
      fetchedAt: null,
      savedAt: null,
      day: null,
      picked: [],
      room: null,
    });
  },
}));

// The card also opens from the map's selection; see libraryWatch.
startLibraryWatch(() => void useLibraryStore.getState().load());
