export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OUT_OF_OFFICE';

export interface AvailabilityBlock {
  status: AvailabilityStatus;
  start: string; // naive local ISO, e.g. "2026-07-17T08:00:00"
  end: string;
}

export interface RoomAvailability {
  staffGuid: string;
  serviceId: string;
  webUrl: string; // per-room Bookings deep-link
  leadMinutes: number; // 60 for study rooms, 2880 for the seminar room
  blocks: AvailabilityBlock[];
}

export interface LibraryRoom {
  staffGuid: string;
  serviceId: string;
  service: string; // English service title (stable id-ish label)
  nameCs: string; // Czech room-resource name for display
  library: 'A' | 'IC';
  buildingId: 54678;
  floorId: 57574;
  placeId: number;
  capacity: number | [number, number];
  leadMinutes: number;
  bookingUrl: string; // static per-room Bookings deep-link — always present, never depends on live availability
}

// --- In-app booking (Path B) ---

// The student identity a booking carries — all three come from getUserParams():
// fullName, email (<username>@mendelu.cz), studentId ("Identifikační číslo").
export interface BookingIdentity {
  name: string;
  email: string;
  studentId: string;
}

// The minimal request the client sends to the bookings-create edge function.
// The edge builds the full MS `{ appointment }` envelope from this — the client
// never constructs the raw MS payload (so it can't inject extra recipients etc.).
export interface BookingRequest {
  serviceId: string;
  staffMemberId: string;
  startDateTime: string; // naive local ISO
  endDateTime: string; // naive local ISO (start + 1h)
  customer: BookingIdentity;
}

export type BookingError = 'conflict' | 'rate_limited' | 'invalid' | 'upstream' | 'offline';

export type BookingResult =
  { ok: true; appointmentId: string } | { ok: false; error: BookingError };
