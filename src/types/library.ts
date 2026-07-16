export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OUT_OF_OFFICE';

export interface AvailabilityBlock {
  status: AvailabilityStatus;
  start: string; // naive local ISO, e.g. "2026-07-17T08:00:00"
  end: string;
}

export interface RoomAvailability {
  staffGuid: string;
  serviceId: string;
  webUrl: string;      // per-room Bookings deep-link
  leadMinutes: number; // 60 for study rooms, 2880 for the seminar room
  blocks: AvailabilityBlock[];
}

export interface LibraryRoom {
  staffGuid: string;
  serviceId: string;
  service: string;          // English service title (stable id-ish label)
  nameCs: string;           // Czech room-resource name for display
  library: 'A' | 'IC';
  buildingId: 54678;
  floorId: 57574;
  placeId: number;
  capacity: number | [number, number];
  leadMinutes: number;
}
