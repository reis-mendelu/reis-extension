import { create } from 'zustand';
import { fetchAllBlocks, type Block } from './availability';
import { nativeBookingsHttp } from './transport';
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
    set({ blocks: {}, status: 'idle', fetchedAt: null });
  },
}));
