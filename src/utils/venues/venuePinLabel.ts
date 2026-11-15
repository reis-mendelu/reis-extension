import { venueStatus } from './venueStatus';
import type { SocietyPin } from '../../types/campusMap';

/**
 * Whether a pin's venue is open right now, and the name its map label shows:
 * the title, plus "· zavřeno" (`closedShort`) while a venue is closed. One
 * answer for SocietyPinLayer, which draws the label, and SportPlaceLayer, which
 * keeps its pins off it — the two had their own copies, and a label sized from
 * the name alone let a pin sit on "zavřeno". A society pin has no hours, so it
 * counts as open and its label is its title.
 */
export function venuePinLabel(
  pin: SocietyPin,
  now: Date,
  closedShort: string
): { open: boolean; label: string } {
  const open = !pin.venue || venueStatus(pin.venue.hours, now, pin.venue.closure).open;
  return { open, label: open ? pin.title : `${pin.title} · ${closedShort}` };
}
