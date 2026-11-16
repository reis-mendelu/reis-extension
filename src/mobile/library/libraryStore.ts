import { useAppStore } from '../../store/useAppStore';
import { create } from 'zustand';
import { fetchAllBlocks, type Block } from './availability';
import { isoDay, shownDay } from './libraryDay';
import { canBookLibrary, nativeBookingsHttp } from './transport';
import { isDemoMode } from '../../errors/demoMode';
import type { MapSelection } from '../../types/campusMap';
import type { BookingsHttp } from './bookingsBase';
import { LIBRARY_ROOMS } from '../../data/map/libraryRooms';

export type LibraryStatus = 'idle' | 'loading' | 'ready' | 'offline';

/** Availability older than this is read again when the library is opened. */
export const STALE_MS = 2 * 60 * 1000;
/** How many days ahead the room card offers. */
export const DAYS_AHEAD = 7;

export interface LibraryState {
  /** Per map room id. `null` = could not ask, which is not "nothing free". */
  blocks: Record<number, Block[] | null>;
  status: LibraryStatus;
  fetchedAt: number | null;
  load(http?: BookingsHttp, now?: Date): Promise<void>;
  /** The card's day (`YYYY-MM-DD`), null until the student picks one. */
  day: string | null;
  /** The picked run of hours on that day: the map colours rooms by it. */
  picked: number[];
  setDay(day: string): void;
  setPicked(hours: number[]): void;
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

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

let seq = 0;

/**
 * The library's free hours, per room. A store of its own, NOT a slice of
 * useAppStore, for the reason `iskamStore` gives: the extension builds that one
 * and library booking must not reach it (desktopHasNoLibraryBooking.test.ts).
 * Memory only — a list of free hours is stale in minutes and worth keeping
 * nowhere.
 */
export const useLibraryStore = create<LibraryState>((set, get) => ({
  blocks: {},
  status: 'idle',
  fetchedAt: null,
  day: null,
  picked: [],
  writing: false,
  startWrite: () => {
    if (get().writing) return false;
    set({ writing: true });
    return true;
  },
  endWrite: () => set({ writing: false }),
  markFree(featureId, day, hours) {
    const list = get().blocks[featureId];
    const pad = (n: number) => String(n).padStart(2, '0');
    const gone = new Set(hours.map((h) => `${day}T${pad(h)}:00`));
    set({
      fetchedAt: null,
      ...(list
        ? {
            blocks: {
              ...get().blocks,
              [featureId]: list.filter((b) => !(b.status === 'busy' && gone.has(b.start))),
            },
          }
        : {}),
    });
  },
  setDay: (day) => set({ day, picked: [] }),
  setPicked: (picked) => set({ picked }),

  async load(http = nativeBookingsHttp, now = new Date()) {
    const { status, fetchedAt } = get();
    if (status === 'loading') return;
    if (status === 'ready' && fetchedAt !== null && now.getTime() - fetchedAt < STALE_MS) return;
    const mine = ++seq;
    set({ status: 'loading' });
    const to = new Date(now);
    to.setDate(to.getDate() + DAYS_AHEAD);
    const all = await fetchAllBlocks(
      http,
      LIBRARY_ROOMS.map((r) => r.staffMemberId),
      dayOf(now),
      dayOf(to)
    );
    const results = LIBRARY_ROOMS.map(
      (r) => [r.featureId, all?.[r.staffMemberId] ?? null] as const
    );
    if (mine !== seq) return;
    const blocks = Object.fromEntries(results);
    const any = results.some(([, b]) => b !== null);
    set({
      blocks,
      status: any ? 'ready' : 'offline',
      fetchedAt: any ? now.getTime() : null,
    });
  },

  markTaken(featureId, day, hour) {
    const list = get().blocks[featureId];
    if (!list) return;
    const taken: Block = {
      status: 'busy',
      start: `${day}T${pad(hour)}:00`,
      end: `${day}T${pad(hour + 1)}:00`,
    };
    set({ blocks: { ...get().blocks, [featureId]: [...list, taken] } });
  },

  reset() {
    seq++;
    set({ blocks: {}, status: 'idle', fetchedAt: null, day: null, picked: [] });
  },
}));

// The card also opens from a tap on a library room of the floor plan, a search
// result or a deep link, in shared map code that cannot reach into the phone
// tree; the read follows the map's selection here instead of in a component
// effect (CLAUDE.md), behind the same gate as every other way in.
const libraryRoomIn = (sel: MapSelection | null): boolean => {
  if (sel?.kind === 'library') return true;
  const id =
    sel?.kind === 'room' ? sel.room.id : sel?.kind === 'roomRef' ? sel.entry.placeId : null;
  return LIBRARY_ROOMS.some((r) => r.featureId === id);
};
useAppStore.subscribe((s, prev) => {
  if (s.mapSelection === prev.mapSelection || !libraryRoomIn(s.mapSelection)) return;
  if (canBookLibrary() && !isDemoMode()) void useLibraryStore.getState().load();
});

/**
 * The day and picked hours the card and the map's colours both use. A stored
 * day that has passed (the app left open overnight, or a booking's day) gives
 * way to the next open day, and its pick goes with it, so the card and the
 * map never disagree about which day is shown.
 */
export function cardPick(
  s: Pick<LibraryState, 'day' | 'picked'>,
  now: Date
): { day: string; picked: number[] } {
  if (!s.day) return { day: shownDay(now), picked: s.picked };
  if (s.day >= isoDay(now)) return { day: s.day, picked: s.picked };
  return { day: shownDay(now), picked: [] };
}
