import { LIBRARY_ROOMS } from '../../data/map/libraryRooms';
import type { RoomTint } from '../../types/campusMap';
import type { Block } from './availability';
import { freeHours } from './slots';

/** Individual rooms blue, team rooms green, a room with nothing left grey. */
export const TINT_BLUE = '#3b82f6';
export const TINT_GREEN = '#16a34a';
export const TINT_GREY = '#9ca3af';

type Blocks = Record<number, Block[] | null>;

/** Whether a room has an hour to offer. Unknown (not read yet, or no answer) is not "none". */
const hasFreeHour = (blocks: Blocks, id: number, day: string, now: Date): boolean => {
  const b = blocks[id];
  return b == null ? true : freeHours(b, day, now).length > 0;
};

export function libraryTints(
  blocks: Blocks,
  day: string,
  now: Date,
  lang: 'cz' | 'en'
): Record<number, RoomTint> {
  const out: Record<number, RoomTint> = {};
  for (const r of LIBRARY_ROOMS) {
    const fill = !hasFreeHour(blocks, r.featureId, day, now)
      ? TINT_GREY
      : r.kind === 'individual'
        ? TINT_BLUE
        : TINT_GREEN;
    out[r.featureId] = { fill, label: lang === 'cz' ? r.labelCs : r.labelEn, group: r.part };
  }
  return out;
}

/** The count on the campus pin: rooms with at least one hour left today. */
export function roomsOpenCount(blocks: Blocks, day: string, now: Date): number {
  return LIBRARY_ROOMS.filter((r) => {
    const b = blocks[r.featureId];
    return b != null && freeHours(b, day, now).length > 0;
  }).length;
}
