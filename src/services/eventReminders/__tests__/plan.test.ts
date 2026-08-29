import { describe, it, expect } from 'vitest';
import { planReminders, REMINDER_LEAD_MS, eventStartsAt, reminderId } from '../plan';
import type { MapEvent } from '../../../types/events';

function ev(over: Partial<MapEvent> = {}): MapEvent {
  return {
    id: 'e1',
    title: 'Beánie PEF',
    url: '',
    date: '2026-09-10',
    endDate: null,
    time: '19:00',
    location: 'Q01',
    imageUrl: null,
    organizerKey: 'pef',
    societyId: 'supef',
    coord: [16.61, 49.21],
    roomCode: null,
    venueKind: 'campus',
    category: 'party',
    ...over,
  };
}

const now = new Date('2026-09-01T08:00:00').getTime();

describe('REMINDER_LEAD_MS', () => {
  // The sprint note is explicit that an hour is too late to be useful — you
  // cannot get across Brno and change in an hour if you only just found out.
  it('gives at least two hours of notice', () => {
    expect(REMINDER_LEAD_MS).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000);
  });
});

describe('eventStartsAt', () => {
  it('combines the date and the start time in local time', () => {
    expect(eventStartsAt(ev())).toBe(new Date('2026-09-10T19:00:00').getTime());
  });

  it('accepts the dotted Czech time IS sometimes emits', () => {
    expect(eventStartsAt(ev({ time: '19.30' }))).toBe(new Date('2026-09-10T19:30:00').getTime());
  });

  // An event with no start time has no "two hours before" to speak of.
  it('has no start for an event with no time', () => {
    expect(eventStartsAt(ev({ time: null }))).toBeNull();
  });

  it('has no start for an unparseable date', () => {
    expect(eventStartsAt(ev({ date: 'sometime' }))).toBeNull();
  });
});

describe('planReminders', () => {
  const answered = { e1: 'going' as const };

  it('schedules one reminder two hours before an event the student answered', () => {
    const plan = planReminders([ev()], answered, now);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.at).toBe(new Date('2026-09-10T17:00:00').getTime());
    expect(plan[0]?.title).toContain('Beánie PEF');
  });

  it('reminds about Interested as well as Going — both mean "tell me"', () => {
    expect(planReminders([ev()], { e1: 'interested' }, now)).toHaveLength(1);
  });

  it('schedules nothing for an event the student has not answered', () => {
    expect(planReminders([ev()], {}, now)).toEqual([]);
  });

  // The whole point is advance warning. Firing at the moment the student opens
  // the app two hours before would be noise, not a reminder.
  it('skips an event whose reminder time has already passed', () => {
    const late = new Date('2026-09-10T18:00:00').getTime();
    expect(planReminders([ev()], answered, late)).toEqual([]);
  });

  it('skips an event that has already happened', () => {
    const after = new Date('2026-09-11T00:00:00').getTime();
    expect(planReminders([ev()], answered, after)).toEqual([]);
  });

  it('skips an event with no start time rather than guessing one', () => {
    expect(planReminders([ev({ time: null })], answered, now)).toEqual([]);
  });

  it('gives each event a stable id so rescheduling replaces rather than duplicates', () => {
    const a = planReminders([ev()], answered, now)[0];
    const b = planReminders([ev()], answered, now)[0];
    expect(a?.id).toBe(b?.id);
    expect(reminderId('e1')).toBe(a?.id);
  });

  it('gives different events different ids', () => {
    expect(reminderId('e1')).not.toBe(reminderId('e2'));
  });

  // Capacitor's LocalNotifications ids are 32-bit signed ints, and an event id
  // is a uuid. A hash that overflows silently collides two events into one
  // reminder — one of which then never fires.
  it('produces ids inside the 32-bit signed range the plugin requires', () => {
    for (const id of ['e1', 'e2', crypto.randomUUID(), crypto.randomUUID()]) {
      const n = reminderId(id);
      expect(Number.isSafeInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(2 ** 31 - 1);
    }
  });

  it('plans across several answered events at once', () => {
    const plan = planReminders(
      [ev(), ev({ id: 'e2', date: '2026-09-12', time: '10:00' })],
      { e1: 'going', e2: 'interested' },
      now
    );
    expect(plan.map((p) => p.at).sort()).toEqual([
      new Date('2026-09-10T17:00:00').getTime(),
      new Date('2026-09-12T08:00:00').getTime(),
    ]);
  });

  it('carries the venue into the body when there is one', () => {
    expect(planReminders([ev()], answered, now)[0]?.body).toContain('Q01');
  });
});

describe('planReminders — what the notification actually says', () => {
  const answered = { e1: 'going' as const };

  it('leads with how much notice this is, then the venue', () => {
    const plan = planReminders([ev()], answered, now, 'Za 2 hodiny');
    expect(plan[0]?.body).toBe('Za 2 hodiny · Q01');
  });

  it('says just the lead when the event has no venue', () => {
    const plan = planReminders([ev({ location: null })], answered, now, 'Za 2 hodiny');
    expect(plan[0]?.body).toBe('Za 2 hodiny');
  });

  it("follows the student's language", () => {
    expect(planReminders([ev()], answered, now, 'In 2 hours')[0]?.body).toBe('In 2 hours · Q01');
  });
});

// `new Date(y, mo, d, h, m)` rolls out-of-range parts forward instead of
// rejecting them, so a bad row would schedule a notification at a moment
// nobody chose rather than being skipped.
describe('eventStartsAt — values the Date constructor would silently move', () => {
  it('rejects an impossible hour', () => {
    expect(eventStartsAt(ev({ time: '25:00' }))).toBeNull();
  });

  it('rejects an impossible minute', () => {
    expect(eventStartsAt(ev({ time: '19:99' }))).toBeNull();
  });

  it('rejects a day that does not exist in that month', () => {
    expect(eventStartsAt(ev({ date: '2026-02-30' }))).toBeNull();
  });

  it('rejects a month past December', () => {
    expect(eventStartsAt(ev({ date: '2026-13-01' }))).toBeNull();
  });

  it('still accepts a real leap day', () => {
    expect(eventStartsAt(ev({ date: '2028-02-29', time: '19:00' }))).toBe(
      new Date(2028, 1, 29, 19, 0, 0, 0).getTime()
    );
  });

  it('still accepts the last minute of the day', () => {
    expect(eventStartsAt(ev({ time: '23:59' }))).toBe(
      new Date(2026, 8, 10, 23, 59, 0, 0).getTime()
    );
  });
});
