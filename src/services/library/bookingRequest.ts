import type { BookingIdentity, BookingRequest, LibraryRoom } from '@/types/library';

const HOUR_MS = 3_600_000;

function toLocalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

// The minimal, edge-bound booking request for a room + 1-hour slot. All study
// rooms are 1-hour bookings, so the end is always start + 1h.
export function buildBookingRequest(
  room: LibraryRoom,
  slotStartIso: string,
  identity: BookingIdentity
): BookingRequest {
  const end = new Date(new Date(slotStartIso).getTime() + HOUR_MS);
  return {
    serviceId: room.serviceId,
    staffMemberId: room.staffGuid,
    startDateTime: slotStartIso,
    endDateTime: toLocalIso(end),
    customer: identity,
  };
}

// Which required identity fields are blank/whitespace/undefined — the confirm
// dialog blocks submission until this is empty.
export function missingIdentityFields(
  identity: Partial<BookingIdentity>
): (keyof BookingIdentity)[] {
  const fields: (keyof BookingIdentity)[] = ['name', 'email', 'studentId'];
  return fields.filter((f) => !identity[f] || !identity[f]!.trim());
}
