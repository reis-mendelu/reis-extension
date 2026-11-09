import type { RoomProperties, SocietyPin } from '../../types/campusMap';
import { planLabel, roomLabel } from './mapHelpers';
import { venueRoomTitles } from './venueSearch';

type LabelledRoom = Pick<RoomProperties, 'name' | 'passportNumber' | 'nickname'>;

/**
 * A floor-plan room's two labels: `full` on hover, `short` written inside a
 * room big enough to carry one. A venue's room carries the venue's name from
 * the table (BZ00N1015 → "S-klub Pixie"), and never through planLabel, which
 * would cut a name at its first comma.
 */
export function roomPlanLabels(
  p: LabelledRoom,
  venueTitles: ReadonlyMap<string, string>
): { full: string; short: string } {
  const venue = p.passportNumber ? venueTitles.get(p.passportNumber.toUpperCase()) : undefined;
  if (venue) return { full: venue, short: venue };
  const full = roomLabel(p.name, p.passportNumber, p.nickname);
  return { full, short: planLabel(full) };
}

/**
 * What the floor plan's venue labels depend on, as a string: equal for every
 * refetch of the same venues, so a resume refresh does not retitle the plan.
 */
export function venueRoomKey(pins: readonly SocietyPin[]): string {
  return [...venueRoomTitles(pins)].map(([code, title]) => `${code}=${title}`).join('\n');
}
