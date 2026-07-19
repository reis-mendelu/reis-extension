import { describe, it, expect } from 'vitest';
import { buildBookingRequest, missingIdentityFields } from '@/services/library/bookingRequest';
import { LIBRARY_ROOMS } from '@/data/map/libraryRooms';
import type { BookingIdentity } from '@/types/library';

const room = LIBRARY_ROOMS[0]!; // Team Study Room 1
const identity: BookingIdentity = {
  name: 'Jan Novák',
  email: 'xnovak@mendelu.cz',
  studentId: '123456',
};

describe('buildBookingRequest', () => {
  it('carries the room IDs and identity, with end one hour after start', () => {
    const req = buildBookingRequest(room, '2026-07-20T14:00:00', identity);
    expect(req).toEqual({
      serviceId: room.serviceId,
      staffMemberId: room.staffGuid,
      startDateTime: '2026-07-20T14:00:00',
      endDateTime: '2026-07-20T15:00:00',
      customer: identity,
    });
  });
  it('rolls the end hour over midnight correctly', () => {
    const req = buildBookingRequest(room, '2026-07-20T23:00:00', identity);
    expect(req.endDateTime).toBe('2026-07-21T00:00:00');
  });
});

describe('missingIdentityFields', () => {
  it('is empty when all fields are present', () => {
    expect(missingIdentityFields(identity)).toEqual([]);
  });
  it('lists blank or whitespace-only fields', () => {
    expect(missingIdentityFields({ name: '', email: '  ', studentId: '123456' })).toEqual([
      'name',
      'email',
    ]);
  });
  it('treats undefined fields as missing', () => {
    expect(missingIdentityFields({ studentId: '1' })).toEqual(['name', 'email']);
  });
});
