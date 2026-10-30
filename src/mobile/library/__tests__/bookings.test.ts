import { describe, it, expect, vi } from 'vitest';
import { fetchRoomBlocks, fetchAllBlocks } from '../availability';
import { createBooking, buildEnvelope } from '../createBooking';
import { cancelBooking } from '../cancelBooking';
import { QUESTION_FACULTY, QUESTION_STUDENT_ID, BOOKINGS_BASE } from '../bookingsBase';
import type { BookingsHttp } from '../bookingsBase';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';

const room = LIBRARY_ROOMS[0]!;
const who = {
  name: 'Jana Nováková',
  email: 'xnovak7@mendelu.cz',
  studentId: '123456',
  faculty: 'PEF',
};
const when = { start: '2026-11-10T15:00:00', end: '2026-11-10T16:00:00' };

const reply = (status: number, data: unknown): BookingsHttp =>
  vi.fn(async () => ({ status, data }));
const boom: BookingsHttp = vi.fn(async () => {
  throw new Error('network');
});

describe('buildEnvelope', () => {
  const env = buildEnvelope(room, when, who).appointment;
  const answers = env.customers[0]!.answeredCustomQuestions;

  it('books the room by its own service and staff ids', () => {
    expect(env.serviceId).toBe(room.serviceId);
    expect(env.staffMemberIds).toEqual([room.staffMemberId]);
  });

  it('answers the two questions by GUID, faculty in the faculty field', () => {
    const byId = Object.fromEntries(answers.map((a) => [a.customQuestion.id, a.answer]));
    expect(byId[QUESTION_FACULTY]).toBe('PEF');
    expect(byId[QUESTION_STUDENT_ID]).toBe('123456');
    expect(answers).toHaveLength(2);
  });

  it('marks the booking as coming from reIS in the customer notes', () => {
    expect(env.customers[0]!.notes).toBe('reIS');
  });

  it('uses Central European time and the student as the only customer', () => {
    expect(env.startTime).toEqual({
      dateTime: when.start,
      timeZone: 'Central Europe Standard Time',
    });
    expect(env.customers).toHaveLength(1);
    expect(env.customers[0]).toMatchObject({ name: who.name, emailAddress: who.email });
  });
});

describe('createBooking', () => {
  it('returns both ids on success, keeping the self-service id for cancelling', async () => {
    const http = reply(200, { appointment: { id: 'AAMk', selfServiceAppointmentId: 'ssid22' } });
    const out = await createBooking(http, room, when, who);
    expect(out).toEqual({ kind: 'ok', appointmentId: 'AAMk', selfServiceId: 'ssid22' });
    const call = vi.mocked(http).mock.calls[0]![0];
    expect(call.method).toBe('POST');
    expect(call.url).toBe(`${BOOKINGS_BASE}/appointments`);
    expect(call.headers['x-req-source']).toBe('BookingsC2');
    expect(call.headers['x-anchormailbox']).toContain('@mendelu.onmicrosoft.com');
  });

  it('says taken when Bookings reports the staff member unavailable', async () => {
    const http = reply(400, {
      error: 'Status(StatusCode="FailedPrecondition", Detail="Staff not available: x")',
    });
    expect(await createBooking(http, room, when, who)).toEqual({ kind: 'taken' });
  });

  it('says unknown, never failed, when the request throws', async () => {
    expect(await createBooking(boom, room, when, who)).toEqual({ kind: 'unknown' });
  });

  it('says failed on another error status', async () => {
    expect(await createBooking(reply(500, {}), room, when, who)).toEqual({
      kind: 'failed',
      status: 500,
    });
  });

  it('treats a 200 with no self-service id as unknown: the booking may exist and cannot be cancelled', async () => {
    expect(await createBooking(reply(200, { appointment: { id: 'x' } }), room, when, who)).toEqual({
      kind: 'unknown',
    });
  });
});

describe('cancelBooking', () => {
  it('deletes by the self-service id with no body', async () => {
    const http = reply(200, '');
    expect(await cancelBooking(http, 'ssid22')).toEqual({ kind: 'ok' });
    const call = vi.mocked(http).mock.calls[0]![0];
    expect(call.method).toBe('DELETE');
    expect(call.url).toBe(`${BOOKINGS_BASE}/appointments/ssid22`);
    expect(call.data).toBeUndefined();
  });

  it('says gone when the booking is already not there', async () => {
    expect(await cancelBooking(reply(404, {}), 'ssid22')).toEqual({ kind: 'gone' });
  });

  it('says unknown when the request throws', async () => {
    expect(await cancelBooking(boom, 'ssid22')).toEqual({ kind: 'unknown' });
  });

  it('never puts the id anywhere but the path', async () => {
    const http = reply(200, '');
    await cancelBooking(http, 'ssid22');
    const call = vi.mocked(http).mock.calls[0]![0];
    expect(JSON.stringify({ ...call, url: '' })).not.toContain('ssid22');
  });
});

describe('fetchRoomBlocks', () => {
  const item = (status: string, from: string, to: string) => ({
    status,
    startDateTime: { dateTime: from, timeZone: 'x' },
    endDateTime: { dateTime: to, timeZone: 'x' },
  });
  const body = (items: unknown[]) => ({
    staffAvailabilityResponse: [{ availabilityItems: items }],
  });

  it('maps statuses to free, busy and closed', async () => {
    const http = reply(
      200,
      body([
        item(
          'BOOKINGSAVAILABILITYSTATUS_OUT_OF_OFFICE',
          '2026-11-10T00:00:00',
          '2026-11-10T07:00:00'
        ),
        item('BOOKINGSAVAILABILITYSTATUS_AVAILABLE', '2026-11-10T07:00:00', '2026-11-10T15:00:00'),
        item('BOOKINGSAVAILABILITYSTATUS_BUSY', '2026-11-10T15:00:00', '2026-11-10T16:00:00'),
      ])
    );
    const blocks = await fetchRoomBlocks(http, room.staffMemberId, '2026-11-10', '2026-11-11');
    expect(blocks?.map((b) => b.status)).toEqual(['closed', 'free', 'busy']);
    expect(blocks?.[2]).toMatchObject({ start: '2026-11-10T15:00', end: '2026-11-10T16:00' });
  });

  it('never calls a status it does not know free', async () => {
    const http = reply(
      200,
      body([
        item(
          'BOOKINGSAVAILABILITYSTATUS_SOMETHING_NEW',
          '2026-11-10T07:00:00',
          '2026-11-10T19:00:00'
        ),
      ])
    );
    const blocks = await fetchRoomBlocks(http, room.staffMemberId, '2026-11-10', '2026-11-11');
    expect(blocks?.[0]?.status).toBe('busy');
  });

  it('returns null, not an empty list, when it could not ask', async () => {
    expect(await fetchRoomBlocks(boom, room.staffMemberId, '2026-11-10', '2026-11-11')).toBeNull();
    expect(
      await fetchRoomBlocks(reply(500, {}), room.staffMemberId, '2026-11-10', '2026-11-11')
    ).toBeNull();
  });
});

describe('fetchAllBlocks', () => {
  const free = (day: string) => ({
    status: 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE',
    startDateTime: { dateTime: `${day}T07:00:00`, timeZone: 'x' },
    endDateTime: { dateTime: `${day}T19:00:00`, timeZone: 'x' },
  });

  it('asks once for every room and files each answer under its staff id', async () => {
    const http = reply(200, {
      staffAvailabilityResponse: [
        { staffId: 'a', availabilityItems: [free('2026-11-10')] },
        { staffId: 'b', availabilityItems: [] },
      ],
    });
    const all = await fetchAllBlocks(http, ['a', 'b', 'c'], '2026-11-10', '2026-11-17');
    expect(http).toHaveBeenCalledTimes(1);
    expect(vi.mocked(http).mock.calls[0]![0].data).toMatchObject({ staffIds: ['a', 'b', 'c'] });
    expect(all?.a?.[0]).toMatchObject({ status: 'free', start: '2026-11-10T07:00' });
    expect(all?.b).toEqual([]);
    // Not in the answer is "could not ask", not "nothing free".
    expect(all?.c).toBeNull();
  });

  it('returns null when the one request fails', async () => {
    expect(await fetchAllBlocks(boom, ['a'], '2026-11-10', '2026-11-11')).toBeNull();
    expect(await fetchAllBlocks(reply(500, {}), ['a'], '2026-11-10', '2026-11-11')).toBeNull();
  });
});
