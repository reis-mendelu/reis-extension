import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  planNotifications,
  digestId,
  reminderId,
  eventStartsAt,
  REMINDER_LEAD_MS,
  DIGEST_HOUR,
  DIGEST_DAYS,
  MAX_PENDING,
  CHANNEL_RSVP,
  CHANNEL_DIGEST,
  type PlanInput,
  type DigestLabels,
} from '../plan';
import { digestText } from '../digestText';
import type { MapEvent } from '../../../types/events';

// Digests fire at a fixed LOCAL hour, and the new-events window is bounded by
// local midnight-adjacent clock times, so a UTC test runner would pass these
// vacuously. Pinned the way eventHelpers.dst.test.ts pins it.
const savedTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Europe/Prague';
});
afterAll(() => {
  process.env.TZ = savedTz;
});

function ev(
  id: string,
  societyId: string,
  date: string,
  opts: {
    time?: string | null;
    createdAt?: string | null;
    endDate?: string | null;
    title?: string;
  } = {}
): MapEvent {
  return {
    id,
    title: opts.title ?? `Event ${id}`,
    url: '',
    date,
    endDate: opts.endDate ?? null,
    time: opts.time === undefined ? '19:00' : opts.time,
    location: null,
    imageUrl: null,
    organizerKey: 'pef',
    societyId,
    coord: null,
    roomCode: null,
    venueKind: 'campus',
    category: 'party',
    createdAt: opts.createdAt ?? null,
  };
}

const labels: DigestLabels = {
  tomorrow: (titles) => `Tomorrow: ${titles}`,
  tomorrowMany: (n, titles) => `Tomorrow: ${n} events (${titles})`,
  newOnly: (_n, titles) => `New: ${titles}`,
  plusNew: (n, societies) => `+${n} new from ${societies}`,
  leadLabel: 'In 2 hours',
};

const shortName = (id: string) => id.toUpperCase();

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    events: [],
    rsvp: {},
    followed: [],
    muted: [],
    prefs: { myEvents: true, followedEvents: true, newEvents: true },
    shortName,
    ...over,
  };
}

const at = (iso: string) => new Date(iso).getTime();

describe('planNotifications — RSVP pings', () => {
  it('schedules one ping two hours before an RSVPd event with a readable time', () => {
    const now = at('2026-10-05T12:00:00');
    const e = ev('e1', 'esn', '2026-10-06', { time: '19:00' });
    const plan = planNotifications(
      input({
        events: [e],
        rsvp: { e1: 'going' },
        prefs: { myEvents: true, followedEvents: false, newEvents: false },
      }),
      now,
      labels
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      kind: 'rsvp',
      channelId: CHANNEL_RSVP,
      id: reminderId('e1'),
      eventId: 'e1',
      at: at('2026-10-06T17:00:00'),
    });
  });

  it('schedules nothing when myEvents is off', () => {
    const now = at('2026-10-05T12:00:00');
    const e = ev('e1', 'esn', '2026-10-06', { time: '19:00' });
    const plan = planNotifications(
      input({
        events: [e],
        rsvp: { e1: 'going' },
        prefs: { myEvents: false, followedEvents: false, newEvents: false },
      }),
      now,
      labels
    );
    expect(plan).toEqual([]);
  });

  const rsvpOnly = (over: Partial<PlanInput>) =>
    planNotifications(
      input({ prefs: { myEvents: true, followedEvents: false, newEvents: false }, ...over }),
      at('2026-09-01T08:00:00'),
      labels
    );

  it('reminds about Interested as well as Going — both mean "tell me"', () => {
    const e = ev('e1', 'esn', '2026-09-10', { time: '19:00' });
    expect(rsvpOnly({ events: [e], rsvp: { e1: 'interested' } })).toHaveLength(1);
  });

  it('schedules nothing for an event the student has not answered', () => {
    const e = ev('e1', 'esn', '2026-09-10', { time: '19:00' });
    expect(rsvpOnly({ events: [e], rsvp: {} })).toEqual([]);
  });

  // The whole point is advance warning. Firing at the moment the student opens
  // the app two hours before would be noise, not a reminder.
  it('skips an event whose reminder time has already passed', () => {
    const e = ev('e1', 'esn', '2026-09-10', { time: '19:00' });
    const late = at('2026-09-10T18:00:00');
    const plan = planNotifications(
      input({
        events: [e],
        rsvp: { e1: 'going' },
        prefs: { myEvents: true, followedEvents: false, newEvents: false },
      }),
      late,
      labels
    );
    expect(plan).toEqual([]);
  });

  it('skips an event that has already happened', () => {
    const e = ev('e1', 'esn', '2026-09-10', { time: '19:00' });
    const after = at('2026-09-11T00:00:00');
    const plan = planNotifications(
      input({
        events: [e],
        rsvp: { e1: 'going' },
        prefs: { myEvents: true, followedEvents: false, newEvents: false },
      }),
      after,
      labels
    );
    expect(plan).toEqual([]);
  });

  it('skips an event with no start time rather than guessing one', () => {
    const e = ev('e1', 'esn', '2026-09-10', { time: null });
    expect(rsvpOnly({ events: [e], rsvp: { e1: 'going' } })).toEqual([]);
  });

  it('plans across several answered events at once, one ping each', () => {
    const e1 = ev('e1', 'esn', '2026-09-10', { time: '19:00' });
    const e2 = ev('e2', 'esn', '2026-09-12', { time: '10:00' });
    const plan = rsvpOnly({ events: [e1, e2], rsvp: { e1: 'going', e2: 'interested' } });
    expect(plan.map((p) => p.at).sort()).toEqual(
      [at('2026-09-10T17:00:00'), at('2026-09-12T08:00:00')].sort()
    );
  });
});

describe('planNotifications — evening digest, basic', () => {
  it('plans one digest at today 18:00 local for a followed event happening tomorrow', () => {
    const now = at('2026-10-05T12:00:00');
    const e = ev('e2', 'esn', '2026-10-06', { title: 'Pub Quiz' });
    const plan = planNotifications(
      input({
        events: [e],
        followed: ['esn'],
        prefs: { myEvents: false, followedEvents: true, newEvents: false },
      }),
      now,
      labels
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]?.kind).toBe('digest');
    expect(plan[0]?.channelId).toBe(CHANNEL_DIGEST);
    expect(plan[0]?.id).toBe(digestId('2026-10-05'));
    expect(plan[0]?.at).toBe(at('2026-10-05T18:00:00'));
    expect(plan[0]?.title).toContain('Pub Quiz');
  });

  it('skips a day whose 18:00 has already passed — the next digest is tomorrow at 18:00', () => {
    const now = at('2026-10-05T19:00:00');
    const e = ev('e3', 'esn', '2026-10-07');
    const plan = planNotifications(
      input({
        events: [e],
        followed: ['esn'],
        prefs: { myEvents: false, followedEvents: true, newEvents: false },
      }),
      now,
      labels
    );
    expect(plan.some((p) => p.at === at('2026-10-05T18:00:00'))).toBe(false);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.at).toBe(at('2026-10-06T18:00:00'));
  });

  it('fires at 18:00 local across the autumn clock change', () => {
    // Clocks go back on Sun 25 Oct 2026: confirm the zone actually has a change.
    expect(new Date(2026, 9, 20).getTimezoneOffset()).not.toBe(
      new Date(2026, 9, 26).getTimezoneOffset()
    );
    const now = at('2026-10-24T12:00:00');
    const e = ev('e4', 'esn', '2026-10-26');
    const plan = planNotifications(
      input({
        events: [e],
        followed: ['esn'],
        prefs: { myEvents: false, followedEvents: true, newEvents: false },
      }),
      now,
      labels
    );
    const digest = plan.find((p) => p.eventId === '' && p.kind === 'digest');
    expect(digest).toBeDefined();
    const fireDate = new Date(digest!.at);
    expect(fireDate.getHours()).toBe(18);
    expect(fireDate.getDate()).toBe(25);
  });

  it('is silent for a muted society', () => {
    const now = at('2026-10-05T12:00:00');
    const e = ev('e5', 'esn', '2026-10-06');
    const plan = planNotifications(
      input({
        events: [e],
        followed: ['esn'],
        muted: ['esn'],
        prefs: { myEvents: false, followedEvents: true, newEvents: false },
      }),
      now,
      labels
    );
    expect(plan).toEqual([]);
  });

  it('is silent for a society the student does not follow', () => {
    const now = at('2026-10-05T12:00:00');
    const e = ev('e6', 'esn', '2026-10-06');
    const plan = planNotifications(
      input({
        events: [e],
        followed: [],
        prefs: { myEvents: false, followedEvents: true, newEvents: false },
      }),
      now,
      labels
    );
    expect(plan).toEqual([]);
  });
});

describe('planNotifications — new-events window', () => {
  const prefs = { myEvents: false, followedEvents: false, newEvents: true };

  it('counts an event created this afternoon as new in this evening’s digest', () => {
    const now = at('2026-10-05T09:00:00');
    const e = ev('e7', 'esn', '2026-11-20', { createdAt: '2026-10-05T10:00:00' });
    const plan = planNotifications(input({ events: [e], followed: ['esn'], prefs }), now, labels);
    const today = plan.find((p) => p.at === at('2026-10-05T18:00:00'));
    expect(today).toBeDefined();
    expect(today?.title).toContain('Event e7');
  });

  it('an event created just before 18:00 the day before belongs to that earlier window, not today — and is nowhere once that window has closed', () => {
    // Created 2026-10-04T17:59 belongs to the 4th's window (D-1 18:00 excl .. D
    // 18:00 incl, so the 4th's window is 3rd 18:00 < c <= 4th 18:00). Once
    // now is past the 4th's 18:00, that digest is already skipped, and 17:59
    // fails the 5th's window (which starts at the 4th's 18:00, exclusive).
    const now = at('2026-10-04T19:00:00');
    const e = ev('e8', 'esn', '2026-11-20', { createdAt: '2026-10-04T17:59:00' });
    const plan = planNotifications(input({ events: [e], followed: ['esn'], prefs }), now, labels);
    expect(plan).toEqual([]);
  });

  // Ruling: "new" is news about something not yet over. An event published
  // this afternoon for tonight is exactly the news the 18:00 digest is for; an
  // event whose last day has already passed is not.
  it('announces a new event published today for tonight', () => {
    const now = at('2026-10-05T09:00:00');
    const e = ev('tonight', 'esn', '2026-10-05', {
      time: '20:00',
      createdAt: '2026-10-05T10:00:00',
    });
    const plan = planNotifications(input({ events: [e], followed: ['esn'], prefs }), now, labels);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.at).toBe(at('2026-10-05T18:00:00'));
    expect(plan[0]?.title).toContain('Event tonight');
  });

  it('does not announce a new event that is already over', () => {
    const now = at('2026-10-05T09:00:00');
    const e = ev('past', 'esn', '2026-10-04', { createdAt: '2026-10-05T10:00:00' });
    const plan = planNotifications(input({ events: [e], followed: ['esn'], prefs }), now, labels);
    expect(plan).toEqual([]);
  });

  it('announces a new multi-day event that started yesterday and is still running', () => {
    const now = at('2026-10-05T09:00:00');
    const e = ev('trip', 'esn', '2026-10-04', {
      endDate: '2026-10-06',
      createdAt: '2026-10-05T10:00:00',
    });
    const plan = planNotifications(input({ events: [e], followed: ['esn'], prefs }), now, labels);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.title).toContain('Event trip');
  });

  it('still announces a new event dated the day after the digest', () => {
    const now = at('2026-10-05T09:00:00');
    const e = ev('next', 'esn', '2026-10-06', { createdAt: '2026-10-05T10:00:00' });
    const plan = planNotifications(input({ events: [e], followed: ['esn'], prefs }), now, labels);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.title).toContain('Event next');
  });

  it('an event created at exactly 18:00 belongs to that day, not the next', () => {
    const now = at('2026-10-05T12:00:00');
    const e = ev('e9', 'esn', '2026-11-20', { createdAt: '2026-10-05T18:00:00' });
    const plan = planNotifications(input({ events: [e], followed: ['esn'], prefs }), now, labels);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.at).toBe(at('2026-10-05T18:00:00'));
  });
});

describe('planNotifications — preference switches', () => {
  it('followedEvents off leaves only the new part of the digest', () => {
    const now = at('2026-10-05T12:00:00');
    // tomorrow AND new at once, so this proves the tomorrow half is excluded.
    const e = ev('e10', 'esn', '2026-10-06', {
      title: 'Pub Quiz',
      createdAt: '2026-10-05T13:00:00',
    });
    const plan = planNotifications(
      input({
        events: [e],
        followed: ['esn'],
        prefs: { myEvents: false, followedEvents: false, newEvents: true },
      }),
      now,
      labels
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]?.title.startsWith('New:')).toBe(true);
  });

  it('newEvents off shows only tomorrow’s events', () => {
    const now = at('2026-10-05T12:00:00');
    const e = ev('e11', 'esn', '2026-10-06', {
      title: 'Pub Quiz',
      createdAt: '2026-10-05T13:00:00',
    });
    const plan = planNotifications(
      input({
        events: [e],
        followed: ['esn'],
        prefs: { myEvents: false, followedEvents: true, newEvents: false },
      }),
      now,
      labels
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]?.title.startsWith('Tomorrow:')).toBe(true);
  });

  it('both switches off produce no digests', () => {
    const now = at('2026-10-05T12:00:00');
    const e = ev('e12', 'esn', '2026-10-06', { createdAt: '2026-10-05T13:00:00' });
    const plan = planNotifications(
      input({
        events: [e],
        followed: ['esn'],
        prefs: { myEvents: false, followedEvents: false, newEvents: false },
      }),
      now,
      labels
    );
    expect(plan).toEqual([]);
  });
});

describe('planNotifications — empty digests are omitted', () => {
  it('produces nothing for a followed society with no tomorrow and no new events', () => {
    const now = at('2026-10-05T12:00:00');
    const e = ev('e13', 'esn', '2026-12-25');
    const plan = planNotifications(
      input({
        events: [e],
        followed: ['esn'],
        prefs: { myEvents: false, followedEvents: true, newEvents: true },
      }),
      now,
      labels
    );
    expect(plan).toEqual([]);
  });
});

describe('planNotifications — the 50-notification cap', () => {
  it('caps 60 RSVPd events at 50, soonest first', () => {
    const now = at('2026-10-05T08:00:00');
    const events: MapEvent[] = [];
    const rsvp: Record<string, 'going' | 'interested'> = {};
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    for (let i = 0; i < 60; i++) {
      const d = new Date(day);
      d.setDate(d.getDate() + i + 1);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const id = `c${i}`;
      events.push(ev(id, 'esn', iso, { time: '19:00' }));
      rsvp[id] = 'going';
    }
    const plan = planNotifications(
      input({
        events,
        rsvp,
        prefs: { myEvents: true, followedEvents: false, newEvents: false },
      }),
      now,
      labels
    );
    expect(plan).toHaveLength(MAX_PENDING);
    const sorted = [...plan].sort((a, b) => a.at - b.at);
    expect(plan).toEqual(sorted);
    expect(plan[0]?.eventId).toBe('c0');
  });
});

describe('planNotifications — stable ids', () => {
  it('gives the same ids across two calls with the same input', () => {
    const now = at('2026-10-05T12:00:00');
    const e1 = ev('e14', 'esn', '2026-10-06', { time: '19:00' });
    const build = () =>
      planNotifications(
        input({ events: [e1], rsvp: { e14: 'going' }, followed: ['esn'] }),
        now,
        labels
      );
    const a = build();
    const b = build();
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });
});

describe('planNotifications — finished and multi-day events', () => {
  it('excludes a "tomorrow" event that is already finished by the time the digest fires', () => {
    const now = at('2026-10-05T12:00:00');
    // Adversarial fixture: endDate before date, so isFinishedEvent reads it as
    // over even though `date` itself is tomorrow — proves the gate is applied,
    // not just the date match.
    const e = ev('e15', 'esn', '2026-10-06', { endDate: '2026-10-04' });
    const plan = planNotifications(
      input({
        events: [e],
        followed: ['esn'],
        prefs: { myEvents: false, followedEvents: true, newEvents: false },
      }),
      now,
      labels
    );
    expect(plan).toEqual([]);
  });

  it('does not list a multi-day event as "tomorrow" when it started earlier', () => {
    const now = at('2026-10-05T12:00:00');
    // Started the 4th, running through the 8th — not "starting tomorrow".
    const e = ev('e16', 'esn', '2026-10-04', { endDate: '2026-10-08' });
    const plan = planNotifications(
      input({
        events: [e],
        followed: ['esn'],
        prefs: { myEvents: false, followedEvents: true, newEvents: false },
      }),
      now,
      labels
    );
    expect(plan).toEqual([]);
  });
});

describe('planNotifications and digestText — wording', () => {
  it('names the one event for a single-event tomorrow digest', () => {
    const e = ev('t1', 'esn', '2026-10-06', { title: 'Pub Quiz' });
    const text = digestText([e], [], shortName, labels);
    expect(text?.title).toBe(labels.tomorrow('Pub Quiz (ESN)'));
  });

  it('summarises three tomorrow events with a count and the first two titles', () => {
    const e1 = ev('t2', 'esn', '2026-10-06', { title: 'Pub Quiz' });
    const e2 = ev('t3', 'esn', '2026-10-06', { title: 'Beerpong' });
    const e3 = ev('t4', 'esn', '2026-10-06', { title: 'Karaoke' });
    const text = digestText([e1, e2, e3], [], shortName, labels);
    expect(text?.title).toBe(labels.tomorrowMany(3, 'Pub Quiz, Beerpong'));
  });

  it('describes new-only events and still reports the new count in the body', () => {
    const e1 = ev('t5', 'esn', '2026-10-20', { title: 'Movie Night' });
    const e2 = ev('t6', 'esn', '2026-10-21', { title: 'Trivia' });
    const text = digestText([], [e1, e2], shortName, labels);
    expect(text?.title).toBe(labels.newOnly(2, 'Movie Night, Trivia (ESN)'));
    expect(text?.body).toBe(labels.plusNew(2, 'ESN'));
  });

  it('returns null for no events at all', () => {
    expect(digestText([], [], shortName, labels)).toBeNull();
  });
});

describe('DIGEST_HOUR, DIGEST_DAYS, MAX_PENDING', () => {
  it('fires the digest at 18:00', () => {
    expect(DIGEST_HOUR).toBe(18);
  });
  it('plans across 14 days', () => {
    expect(DIGEST_DAYS).toBe(14);
  });
  it('caps at 50 pending notifications', () => {
    expect(MAX_PENDING).toBe(50);
  });
});

// Migrated from the old reminder planner's test file (since deleted) —
// eventStartsAt, reminderId and REMINDER_LEAD_MS are unchanged by this task
// and still load-bearing.
describe('REMINDER_LEAD_MS', () => {
  it('gives at least two hours of notice', () => {
    expect(REMINDER_LEAD_MS).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000);
  });
});

describe('eventStartsAt', () => {
  it('combines the date and the start time in local time', () => {
    expect(eventStartsAt(ev('e1', 'esn', '2026-09-10', { time: '19:00' }))).toBe(
      new Date('2026-09-10T19:00:00').getTime()
    );
  });

  it('accepts the dotted Czech time IS sometimes emits', () => {
    expect(eventStartsAt(ev('e1', 'esn', '2026-09-10', { time: '19.30' }))).toBe(
      new Date('2026-09-10T19:30:00').getTime()
    );
  });

  it('has no start for an event with no time', () => {
    expect(eventStartsAt(ev('e1', 'esn', '2026-09-10', { time: null }))).toBeNull();
  });

  it('has no start for an unparseable date', () => {
    expect(eventStartsAt(ev('e1', 'esn', 'sometime'))).toBeNull();
  });

  it('rejects an impossible hour', () => {
    expect(eventStartsAt(ev('e1', 'esn', '2026-09-10', { time: '25:00' }))).toBeNull();
  });

  it('rejects an impossible minute', () => {
    expect(eventStartsAt(ev('e1', 'esn', '2026-09-10', { time: '19:99' }))).toBeNull();
  });

  it('rejects a day that does not exist in that month', () => {
    expect(eventStartsAt(ev('e1', 'esn', '2026-02-30'))).toBeNull();
  });

  it('rejects a date with trailing junk', () => {
    expect(eventStartsAt(ev('e1', 'esn', '2026-09-10-extra'))).toBeNull();
  });

  it('rejects a short or non-numeric date', () => {
    expect(eventStartsAt(ev('e1', 'esn', '2026-9-10'))).toBeNull();
    expect(eventStartsAt(ev('e1', 'esn', 'not-a-date'))).toBeNull();
  });

  it('rejects a month past December', () => {
    expect(eventStartsAt(ev('e1', 'esn', '2026-13-01'))).toBeNull();
  });

  it('still accepts a real leap day', () => {
    expect(eventStartsAt(ev('e1', 'esn', '2028-02-29', { time: '19:00' }))).toBe(
      new Date(2028, 1, 29, 19, 0, 0, 0).getTime()
    );
  });

  it('still accepts the last minute of the day', () => {
    expect(eventStartsAt(ev('e1', 'esn', '2026-09-10', { time: '23:59' }))).toBe(
      new Date(2026, 8, 10, 23, 59, 0, 0).getTime()
    );
  });
});

describe('reminderId', () => {
  it('is stable for the same event id', () => {
    expect(reminderId('e1')).toBe(reminderId('e1'));
  });

  it('differs across event ids', () => {
    expect(reminderId('e1')).not.toBe(reminderId('e2'));
  });

  it('stays inside the 32-bit signed range the plugin requires', () => {
    for (const id of ['e1', 'e2', crypto.randomUUID(), crypto.randomUUID()]) {
      const n = reminderId(id);
      expect(Number.isSafeInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(2 ** 31 - 1);
    }
  });
});

describe('planNotifications — RSVP body text', () => {
  it('leads with how much notice this is, then the venue', () => {
    const now = at('2026-09-01T08:00:00');
    const e: MapEvent = { ...ev('e1', 'esn', '2026-09-10', { time: '19:00' }), location: 'Q01' };
    const plan = planNotifications(
      input({
        events: [e],
        rsvp: { e1: 'going' },
        prefs: { myEvents: true, followedEvents: false, newEvents: false },
      }),
      now,
      { ...labels, leadLabel: 'Za 2 hodiny' }
    );
    expect(plan[0]?.body).toBe('Za 2 hodiny · Q01');
  });

  it('says just the lead when the event has no venue', () => {
    const now = at('2026-09-01T08:00:00');
    const e = ev('e1', 'esn', '2026-09-10', { time: '19:00' });
    const plan = planNotifications(
      input({
        events: [e],
        rsvp: { e1: 'going' },
        prefs: { myEvents: true, followedEvents: false, newEvents: false },
      }),
      now,
      { ...labels, leadLabel: 'Za 2 hodiny' }
    );
    expect(plan[0]?.body).toBe('Za 2 hodiny');
  });
});
