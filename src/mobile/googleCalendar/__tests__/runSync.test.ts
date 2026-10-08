import { describe, expect, it } from 'vitest';
import { runSync, type SyncSources, type SyncState } from '../runSync';
import type { CalendarApi } from '../calendarApi';
import { CalendarGoneError } from '../calendarHttp';
import type { DesiredEvent, ReisKind } from '../types';

interface Stored {
  id: string;
  kind: ReisKind;
  date: string;
  hash: string;
  cancelled: boolean;
}

/** In-memory Google: deleting keeps the id reserved, as the real API does (409 on re-insert). */
function fakeApi(opts: { found?: string | null; gone?: boolean } = {}) {
  const events = new Map<string, Stored>();
  const log: string[] = [];
  const store = (d: DesiredEvent) =>
    events.set(d.id, { id: d.id, kind: d.kind, date: d.date, hash: d.hash, cancelled: false });
  const api: CalendarApi = {
    deleteCalendar: async () => {},
    findReisCalendar: async () => opts.found ?? null,
    createCalendar: async () => {
      log.push('create');
      return 'new-cal';
    },
    assertCalendar: async () => {
      if (opts.gone) throw new CalendarGoneError('x');
    },
    listEvents: async (_c, kind, timeMin) =>
      [...events.values()]
        .filter(
          (e) => !e.cancelled && e.kind === kind && (!timeMin || e.date >= timeMin.slice(0, 10))
        )
        .map(({ id, kind: k, date, hash }) => ({ id, kind: k, date, hash })),
    insert: async (_c, d) => {
      log.push(`ins:${d.id}`);
      if (events.has(d.id)) return 'exists';
      store(d);
      return 'inserted';
    },
    getEvent: async (_c, id) => {
      log.push(`get:${id}`);
      const e = events.get(id);
      return !e || e.cancelled ? { cancelled: true, hash: '' } : { cancelled: false, hash: e.hash };
    },
    put: async (_c, d) => {
      log.push(`put:${d.id}`);
      store(d);
    },
    remove: async (_c, id) => {
      log.push(`del:${id}`);
      const e = events.get(id);
      if (e) e.cancelled = true;
    },
  };
  return { api, events, log };
}

const lessonOn = (date: string, room = 'Q') =>
  ({
    id: date,
    date: date.replaceAll('-', ''),
    startTime: '09:00',
    endTime: '10:00',
    courseName: 'X',
    courseNameCs: 'X',
    courseNameEn: 'X',
    room,
    roomCs: room,
    roomEn: room,
    isSeminar: 'false',
    teachers: [],
    roomStructured: { name: room, id: '' },
  }) as never;

const sources = (dates: string[], room = 'Q'): SyncSources => ({
  language: 'cz',
  lessons: dates.map((d) => lessonOn(d, room)),
  lessonsConfirmed: true,
  exams: [],
  examsConfirmed: true,
  custom: [],
});
const NOW = new Date('2026-10-08T10:00:00+02:00');
const FRESH: SyncState = {
  calendarId: null,
  held: {},
  lastSyncAt: null,
  pastFillPending: false,
  reisDeleted: {},
  skipped: {},
};

async function sync(api: CalendarApi, state: SyncState, src: SyncSources): Promise<SyncState> {
  const r = await runSync({ api, now: NOW, persist: async () => {}, state, sources: src });
  if (r.kind !== 'ok') throw new Error(`sync failed: ${r.kind}`);
  return r.state;
}
const idOf = (events: Map<string, Stored>, date: string) =>
  [...events.values()].find((e) => e.date === date)!.id;

describe('runSync', () => {
  it('creating run: makes the calendar and writes the past too', async () => {
    const { api, log } = fakeApi();
    const r = await runSync({
      api,
      now: NOW,
      persist: async () => {},
      state: FRESH,
      sources: sources(['2026-10-01', '2026-10-09']),
    });
    expect(r).toMatchObject({ kind: 'ok', written: 2, state: { calendarId: 'new-cal' } });
    expect(log.filter((l) => l.startsWith('ins:'))).toHaveLength(2);
  });

  it('reusing an existing calendar never writes the past', async () => {
    const { api, log } = fakeApi({ found: 'theirs' });
    await sync(api, FRESH, sources(['2026-10-01', '2026-10-09']));
    expect(log).not.toContain('create');
    expect(log.filter((l) => l.startsWith('ins:'))).toHaveLength(1);
  });

  it('reports calendarGone when Rozvrh was deleted', async () => {
    const { api } = fakeApi({ gone: true });
    const r = await runSync({
      api,
      now: NOW,
      persist: async () => {},
      state: { ...FRESH, calendarId: 'cal', lastSyncAt: 1 },
      sources: sources(['2026-10-09']),
    });
    expect(r).toEqual({ kind: 'calendarGone' });
  });

  it('an interrupted creating run resumes the past fill', async () => {
    const { api, log } = fakeApi();
    const saved: SyncState[] = [];
    const realInsert = api.insert;
    let n = 0;
    api.insert = async (c, d) => {
      if (++n === 2) throw new Error('app killed');
      return realInsert(c, d);
    };
    const src = sources(['2026-10-01', '2026-10-02', '2026-10-09']);
    await expect(
      runSync({
        api,
        now: NOW,
        persist: async (s) => void saved.push(s),
        state: FRESH,
        sources: src,
      })
    ).rejects.toThrow('app killed');
    expect(saved.at(-1)).toMatchObject({ calendarId: 'new-cal', pastFillPending: true });
    api.insert = realInsert;
    const r = await runSync({
      api,
      now: NOW,
      persist: async () => {},
      state: saved.at(-1)!,
      sources: src,
    });
    expect(r).toMatchObject({ kind: 'ok', state: { pastFillPending: false } });
    expect(new Set(log.filter((l) => l.startsWith('ins:'))).size).toBe(3);
  });

  it('a second run with nothing changed writes nothing', async () => {
    const { api, log } = fakeApi();
    const first = await sync(api, FRESH, sources(['2026-10-09']));
    log.length = 0;
    await sync(api, first, sources(['2026-10-09']));
    expect(log).toEqual([]);
  });
});

describe('runSync: the student wins in Google (Dominik, 2026-10-08)', () => {
  it('a lesson the student deleted stays deleted, and is not retried', async () => {
    const { api, events, log } = fakeApi();
    let st = await sync(api, FRESH, sources(['2026-10-09', '2026-10-10']));
    events.get(idOf(events, '2026-10-09'))!.cancelled = true; // student deletes it in Google
    st = await sync(api, st, sources(['2026-10-09', '2026-10-10']));
    expect(events.get(idOf(events, '2026-10-09'))!.cancelled).toBe(true);
    log.length = 0;
    await sync(api, st, sources(['2026-10-09', '2026-10-10']));
    expect(log).toEqual([]);
  });

  it('a deleted lesson stays deleted even when IS changes its room', async () => {
    const { api, events } = fakeApi();
    let st = await sync(api, FRESH, sources(['2026-10-09']));
    const id = idOf(events, '2026-10-09');
    events.get(id)!.cancelled = true;
    st = await sync(api, st, sources(['2026-10-09']));
    await sync(api, st, sources(['2026-10-09'], 'Q99'));
    expect(events.get(id)!.cancelled).toBe(true);
  });

  it('a moved lesson stays where the student put it until IS changes it', async () => {
    const { api, events, log } = fakeApi();
    let st = await sync(api, FRESH, sources(['2026-10-09']));
    const id = idOf(events, '2026-10-09');
    events.get(id)!.date = '2026-10-01'; // student drags it into the past
    st = await sync(api, st, sources(['2026-10-09']));
    expect(log).not.toContain(`put:${id}`);
    expect(events.get(id)!.date).toBe('2026-10-01');
    await sync(api, st, sources(['2026-10-09'], 'Q99')); // IS moves the room
    expect(log).toContain(`put:${id}`);
    expect(events.get(id)!.date).toBe('2026-10-09');
  });

  it('a lesson reIS removed comes back when IS brings it back', async () => {
    const { api, events, log } = fakeApi();
    let st = await sync(
      api,
      FRESH,
      sources(['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'])
    );
    const id = idOf(events, '2026-10-12');
    st = await sync(api, st, sources(['2026-10-09', '2026-10-10', '2026-10-11'])); // gone from IS
    expect(events.get(id)!.cancelled).toBe(true);
    expect(st.reisDeleted[id]).toBe('2026-10-12');
    st = await sync(api, st, sources(['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']));
    expect(log).toContain(`put:${id}`);
    expect(events.get(id)!.cancelled).toBe(false);
    expect(st.reisDeleted[id]).toBeUndefined();
  });

  it('forgets bookkeeping for days that are now past', async () => {
    const { api } = fakeApi();
    const st = await sync(
      api,
      {
        ...FRESH,
        reisDeleted: { old: '2026-09-01' },
        skipped: { s: { hash: 'h', date: '2026-09-02' } },
      },
      sources(['2026-10-09'])
    );
    expect(st.reisDeleted).toEqual({});
    expect(st.skipped).toEqual({});
  });
});
