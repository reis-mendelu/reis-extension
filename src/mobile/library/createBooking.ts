import {
  BOOKINGS_BASE,
  BOOKINGS_TZ,
  QUESTION_FACULTY,
  QUESTION_STUDENT_ID,
  bookingsHeaders,
} from './bookingsBase';
import type { BookingsHttp } from './bookingsBase';
import type { LibraryRoom } from '../../data/map/libraryRooms';

export interface BookingWho {
  name: string;
  email: string;
  studentId: string;
  /** The short code ("PEF"): the field is free text and the library reads it. */
  faculty: string;
}
export interface BookingWhen {
  /** Local time, `YYYY-MM-DDTHH:mm:ss`. */
  start: string;
  end: string;
}

export type CreateOutcome =
  | { kind: 'ok'; appointmentId: string; selfServiceId: string }
  | { kind: 'taken' }
  /** Nothing came back. The booking may exist: never retry on its own. */
  | { kind: 'unknown' }
  | { kind: 'failed'; status: number };

const answer = (id: string, text: string) => ({
  customQuestion: {
    id,
    questionText: '',
    answerOptions: [],
    answerInputType: 'ANSWER_INPUT_TYPE_TEXT',
  },
  answer: text,
  isRequired: true,
  selectedOptions: [],
});

export function buildEnvelope(room: LibraryRoom, when: BookingWhen, who: BookingWho) {
  return {
    appointment: {
      startTime: { dateTime: when.start, timeZone: BOOKINGS_TZ },
      endTime: { dateTime: when.end, timeZone: BOOKINGS_TZ },
      serviceId: room.serviceId,
      staffMemberIds: [room.staffMemberId],
      customers: [
        {
          name: who.name,
          emailAddress: who.email,
          phone: '',
          // Tells the librarians it came from reIS; the student has no notes here.
          notes: 'reIS',
          timeZone: BOOKINGS_TZ,
          answeredCustomQuestions: [
            answer(QUESTION_FACULTY, who.faculty),
            answer(QUESTION_STUDENT_ID, who.studentId),
          ],
          location: { displayName: '', address: { street: '', type: 'Other' } },
          smsNotificationsEnabled: false,
          instanceId: '',
          price: 0,
          priceType: 'SERVICEDEFAULTPRICETYPES_NOT_SET',
        },
      ],
      isLocationOnline: false,
      smsNotificationsEnabled: false,
      verificationCode: '',
      customerTimeZone: BOOKINGS_TZ,
      trackingDataId: '',
      bookingFormInfoList: [],
      price: 0,
      priceType: 'SERVICEDEFAULTPRICETYPES_NOT_SET',
      isAllDay: false,
      additionalRecipients: [],
    },
  };
}

/** "Staff not available" is how Bookings says the hour was taken meanwhile. */
const isTaken = (data: unknown): boolean =>
  JSON.stringify(data ?? '').includes('Staff not available');

export async function createBooking(
  http: BookingsHttp,
  room: LibraryRoom,
  when: BookingWhen,
  who: BookingWho
): Promise<CreateOutcome> {
  try {
    const res = await http({
      method: 'POST',
      url: `${BOOKINGS_BASE}/appointments`,
      headers: {
        ...bookingsHeaders(),
        prefer: 'exchange.behavior="IncludeThirdPartyOnlineMeetingProviders"',
      },
      data: buildEnvelope(room, when, who),
    });
    if (res.status === 400 && isTaken(res.data)) return { kind: 'taken' };
    if (res.status !== 200) return { kind: 'failed', status: res.status };
    const a = (res.data as { appointment?: { id?: string; selfServiceAppointmentId?: string } })
      .appointment;
    // A booking we cannot cancel is one we must not claim: say unknown.
    if (!a?.id || !a.selfServiceAppointmentId) return { kind: 'unknown' };
    return { kind: 'ok', appointmentId: a.id, selfServiceId: a.selfServiceAppointmentId };
  } catch {
    return { kind: 'unknown' };
  }
}
