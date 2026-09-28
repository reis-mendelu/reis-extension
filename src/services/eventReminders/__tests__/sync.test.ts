import { describe, it, expect, vi, beforeEach } from 'vitest';

// capacitorReminderDeps talks to these lazily (dynamic import), so they must be
// mocked before the module under test is imported — the mock factories close
// over these fns, and stay live across `vi.resetModules()` re-imports below.
const createChannel = vi.fn().mockResolvedValue(undefined);
const pluginSchedule = vi.fn().mockResolvedValue(undefined);
const checkPermissions = vi.fn().mockResolvedValue({ display: 'granted' });
const requestPermissions = vi.fn().mockResolvedValue({ display: 'granted' });
const getPending = vi.fn().mockResolvedValue({ notifications: [] });
const pluginCancel = vi.fn().mockResolvedValue(undefined);

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    createChannel: (opts: unknown) => createChannel(opts),
    schedule: (opts: unknown) => pluginSchedule(opts),
    checkPermissions: () => checkPermissions(),
    requestPermissions: () => requestPermissions(),
    getPending: () => getPending(),
    cancel: (opts: unknown) => pluginCancel(opts),
  },
}));

const getPlatform = vi.fn(() => 'android');
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => getPlatform() },
}));

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: { getState: () => ({ language: 'cz' }) },
}));

vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

import {
  syncReminders,
  resetReminderQueue,
  askNotificationPermission,
  readNotificationPermission,
  capacitorReminderDeps,
  type ReminderDeps,
  type PendingReminder,
} from '../sync';
import { logError } from '../../../utils/reportError';
import {
  CHANNEL_RSVP,
  CHANNEL_DIGEST,
  type PlannedReminder,
  type PlannedNotification,
} from '../plan';

function reminder(over: Partial<PlannedReminder> = {}): PlannedReminder {
  return { id: 1, eventId: 'e1', title: 'Beánie', body: 'Q01', at: 2_000_000, ...over };
}

/** A pending notification as the plugin reports it; text defaults to `reminder()`'s. */
function pending(over: Partial<PendingReminder> = {}): PendingReminder {
  return { id: 1, at: 2_000_000, title: 'Beánie', body: 'Q01', kind: 'rsvp', ...over };
}

function deps(over: Partial<ReminderDeps> = {}): ReminderDeps {
  return {
    isSupported: () => true,
    checkPermission: vi.fn().mockResolvedValue('granted'),
    requestPermission: vi.fn().mockResolvedValue('granted'),
    createChannels: vi.fn().mockResolvedValue(undefined),
    listPending: vi.fn().mockResolvedValue([]),
    schedule: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getPlatform.mockReturnValue('android');
  // Each test gets a fresh chain; otherwise one test's pending run serialises
  // into the next and the assertions race.
  resetReminderQueue();
});

describe('syncReminders', () => {
  it('schedules a reminder the device does not have yet', async () => {
    const d = deps();
    await syncReminders([reminder()], d);
    expect(d.schedule).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, title: 'Beánie', at: 2_000_000 }),
    ]);
  });

  it('accepts PlannedNotification entries carrying channelId and kind', async () => {
    const d = deps();
    const n: PlannedNotification = {
      id: 9,
      eventId: 'e9',
      title: 'Digest',
      body: 'B',
      at: 3_000_000,
      kind: 'digest',
      channelId: CHANNEL_DIGEST,
    };
    await syncReminders([n], d);
    expect(d.schedule).toHaveBeenCalledWith([
      expect.objectContaining({ id: 9, kind: 'digest', channelId: CHANNEL_DIGEST }),
    ]);
  });

  // Rescheduling every load would re-post the same notification; the plugin
  // keys on id, so an already-pending reminder is left alone.
  it('keeps a pending notification whose id, time and text match', async () => {
    const d = deps({ listPending: vi.fn().mockResolvedValue([pending()]) });
    await syncReminders([reminder()], d);
    expect(d.schedule).not.toHaveBeenCalled();
    expect(d.cancel).not.toHaveBeenCalled();
  });

  it('reschedules when the event time moved', async () => {
    const d = deps({ listPending: vi.fn().mockResolvedValue([pending({ at: 999 })]) });
    await syncReminders([reminder({ at: 2_000_000 })], d);
    expect(d.schedule).toHaveBeenCalledWith([expect.objectContaining({ id: 1, at: 2_000_000 })]);
  });

  // A digest keeps its id and fire time when its content changes — a new
  // event published, a society muted, the language switched — so matching on
  // id+at alone froze the text at whatever the first schedule said.
  it('reschedules when the text changed', async () => {
    const d = deps({
      listPending: vi
        .fn()
        .mockResolvedValue([
          pending({ id: 1, title: 'Zítra: Old (ESN)' }),
          pending({ id: 2, body: '+ 1 nová akce od ESN' }),
        ]),
    });
    await syncReminders(
      [reminder({ id: 1, title: 'Zítra: New (ESN)' }), reminder({ id: 2, body: '' })],
      d
    );
    expect(d.cancel).toHaveBeenCalledWith([1, 2]);
    expect(d.schedule).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, title: 'Zítra: New (ESN)' }),
      expect.objectContaining({ id: 2, body: '' }),
    ]);
  });

  // Un-RSVPing has to take the notification away, or the student gets pinged
  // about something they explicitly backed out of.
  it('cancels a reminder that is no longer planned', async () => {
    const d = deps({ listPending: vi.fn().mockResolvedValue([pending({ id: 7 })]) });
    await syncReminders([], d);
    expect(d.cancel).toHaveBeenCalledWith([7]);
  });

  it('cancels and schedules in the same pass', async () => {
    const d = deps({ listPending: vi.fn().mockResolvedValue([pending({ id: 7, at: 1 })]) });
    await syncReminders([reminder({ id: 1 })], d);
    expect(d.cancel).toHaveBeenCalledWith([7]);
    expect(d.schedule).toHaveBeenCalledWith([expect.objectContaining({ id: 1 })]);
  });

  describe('permission', () => {
    // The core contract of this task: reconcile must never spring the system
    // prompt. This is RED against the pre-Task-4 code, which asked here.
    it('never requests permission itself, even with something to schedule', async () => {
      const d = deps({ checkPermission: vi.fn().mockResolvedValue('prompt') });
      await syncReminders([reminder()], d);
      expect(d.requestPermission).not.toHaveBeenCalled();
      expect(d.schedule).not.toHaveBeenCalled();
    });

    it('does not even check permission when there is nothing to schedule', async () => {
      const d = deps({ checkPermission: vi.fn().mockResolvedValue('prompt') });
      await syncReminders([], d);
      expect(d.checkPermission).not.toHaveBeenCalled();
      expect(d.requestPermission).not.toHaveBeenCalled();
    });

    it('does not schedule while only prompt-with-rationale', async () => {
      const d = deps({ checkPermission: vi.fn().mockResolvedValue('prompt-with-rationale') });
      await syncReminders([reminder()], d);
      expect(d.requestPermission).not.toHaveBeenCalled();
      expect(d.schedule).not.toHaveBeenCalled();
    });

    it('does not schedule when the student has declined', async () => {
      const d = deps({ checkPermission: vi.fn().mockResolvedValue('denied') });
      await syncReminders([reminder()], d);
      expect(d.requestPermission).not.toHaveBeenCalled();
      expect(d.schedule).not.toHaveBeenCalled();
    });

    it('creates channels and schedules when permission is already granted', async () => {
      const d = deps();
      await syncReminders([reminder()], d);
      expect(d.requestPermission).not.toHaveBeenCalled();
      expect(d.createChannels).toHaveBeenCalledTimes(1);
      expect(d.schedule).toHaveBeenCalledWith([expect.objectContaining({ id: 1 })]);
    });

    it('creates channels before scheduling', async () => {
      const order: string[] = [];
      const d = deps({
        createChannels: vi.fn(async () => {
          order.push('channels');
        }),
        schedule: vi.fn(async () => {
          order.push('schedule');
        }),
      });
      await syncReminders([reminder()], d);
      expect(order).toEqual(['channels', 'schedule']);
    });

    // Cancelling never needs permission, and a student who revoked it must
    // still lose the reminders they backed out of.
    it('still cancels stale reminders without permission', async () => {
      const d = deps({
        checkPermission: vi.fn().mockResolvedValue('denied'),
        listPending: vi.fn().mockResolvedValue([pending({ id: 7, at: 1 })]),
      });
      await syncReminders([], d);
      expect(d.cancel).toHaveBeenCalledWith([7]);
    });
  });

  // The extension and the dev webapp have no local notifications at all.
  it('does nothing at all off a native host', async () => {
    const d = deps({ isSupported: () => false });
    await syncReminders([reminder()], d);
    expect(d.listPending).not.toHaveBeenCalled();
    expect(d.schedule).not.toHaveBeenCalled();
  });

  it('never throws when the plugin fails', async () => {
    const d = deps({ schedule: vi.fn().mockRejectedValue(new Error('no channel')) });
    await expect(syncReminders([reminder()], d)).resolves.toBeUndefined();
  });
});

describe('syncReminders — overlapping runs', () => {
  // Un-RSVPing right after RSVPing fires two reconciliations. Unserialised, the
  // first can schedule after the second has already cancelled, leaving a
  // notification for an event the student backed out of.
  it('applies the newest plan last even when an older run is slower', async () => {
    // A stand-in for the device's own pending list, so the second run sees what
    // the first actually did rather than a fixed empty array.
    let device: PendingReminder[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => (releaseFirst = r));
    let call = 0;

    const d = deps({
      listPending: vi.fn(async () => {
        if (call++ === 0) await gate;
        return device;
      }),
      schedule: vi.fn(async (rs: PlannedReminder[]) => {
        device = [
          ...device,
          ...rs.map((r) => ({
            id: r.id,
            at: r.at,
            title: r.title,
            body: r.body,
            kind: 'rsvp' as const,
          })),
        ];
      }),
      cancel: vi.fn(async (ids: number[]) => {
        device = device.filter((p) => !ids.includes(p.id));
      }),
    });

    // RSVP, then immediately un-RSVP. The first run is the slow one.
    const first = syncReminders([reminder()], d);
    const second = syncReminders([], d);

    releaseFirst();
    await Promise.all([first, second]);

    // The student backed out, so the device must hold nothing. Unserialised,
    // the empty plan reads an empty device, cancels nothing, and the slow first
    // run then schedules a reminder for an event that was just declined.
    expect(device).toEqual([]);
  });

  it('keeps running after a failed reconciliation', async () => {
    const failing = deps({ listPending: vi.fn().mockRejectedValue(new Error('plugin gone')) });
    await syncReminders([reminder()], failing);

    const d = deps();
    await syncReminders([reminder()], d);
    expect(d.schedule).toHaveBeenCalled();
  });
});

describe('askNotificationPermission', () => {
  it('returns unsupported off a non-Capacitor host', async () => {
    const d = deps({ isSupported: () => false });
    await expect(askNotificationPermission(d)).resolves.toBe('unsupported');
    expect(d.checkPermission).not.toHaveBeenCalled();
  });

  it('requests permission when the answer is prompt', async () => {
    const d = deps({
      checkPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    await expect(askNotificationPermission(d)).resolves.toBe('granted');
    expect(d.requestPermission).toHaveBeenCalled();
  });

  it('requests permission when the answer is prompt-with-rationale', async () => {
    const d = deps({
      checkPermission: vi.fn().mockResolvedValue('prompt-with-rationale'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
    });
    await expect(askNotificationPermission(d)).resolves.toBe('denied');
    expect(d.requestPermission).toHaveBeenCalled();
  });

  it('does not re-ask once already granted', async () => {
    const d = deps({ checkPermission: vi.fn().mockResolvedValue('granted') });
    await expect(askNotificationPermission(d)).resolves.toBe('granted');
    expect(d.requestPermission).not.toHaveBeenCalled();
  });

  it('does not re-ask a student who already said no', async () => {
    const d = deps({ checkPermission: vi.fn().mockResolvedValue('denied') });
    await expect(askNotificationPermission(d)).resolves.toBe('denied');
    expect(d.requestPermission).not.toHaveBeenCalled();
  });

  it('returns unsupported when the plugin throws', async () => {
    const d = deps({ checkPermission: vi.fn().mockRejectedValue(new Error('boom')) });
    await expect(askNotificationPermission(d)).resolves.toBe('unsupported');
  });
});

describe('readNotificationPermission', () => {
  it('returns unsupported off a non-Capacitor host', async () => {
    const d = deps({ isSupported: () => false });
    await expect(readNotificationPermission(d)).resolves.toBe('unsupported');
  });

  it('reads the current permission without ever asking', async () => {
    const d = deps({ checkPermission: vi.fn().mockResolvedValue('prompt') });
    await expect(readNotificationPermission(d)).resolves.toBe('prompt');
    expect(d.requestPermission).not.toHaveBeenCalled();
  });

  it('returns unsupported when the plugin throws', async () => {
    const d = deps({ checkPermission: vi.fn().mockRejectedValue(new Error('boom')) });
    await expect(readNotificationPermission(d)).resolves.toBe('unsupported');
  });
});

describe('capacitorReminderDeps — schedule wiring', () => {
  it('passes a notification’s own channelId and kind through to the plugin', async () => {
    const realDeps = capacitorReminderDeps();
    const n: PlannedNotification = {
      id: 42,
      eventId: 'e9',
      title: 'Digest',
      body: 'B',
      at: 5_000_000,
      kind: 'digest',
      channelId: CHANNEL_DIGEST,
    };
    await realDeps.schedule([n]);
    expect(pluginSchedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: 42,
          channelId: CHANNEL_DIGEST,
          extra: { eventId: 'e9', kind: 'digest' },
        }),
      ],
    });
  });

  it('defaults a bare PlannedReminder to the RSVP channel and kind', async () => {
    const realDeps = capacitorReminderDeps();
    await realDeps.schedule([reminder()]);
    expect(pluginSchedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          channelId: CHANNEL_RSVP,
          extra: { eventId: 'e1', kind: 'rsvp' },
        }),
      ],
    });
  });
});

describe('capacitorReminderDeps — listPending wiring', () => {
  // The text is what reconcile compares to spot a changed digest, so it has
  // to come back from the plugin — normalised, because an empty body can be
  // dropped on the way through the bridge and must still equal ''.
  it('returns each pending notification’s title and body', async () => {
    getPending.mockResolvedValueOnce({
      notifications: [
        { id: 3, title: 'Zítra: X', body: 'B', schedule: { at: new Date(4_000_000) } },
        { id: 4, title: 'Nové akce: Y', schedule: { at: new Date(5_000_000) } },
      ],
    });
    await expect(capacitorReminderDeps().listPending()).resolves.toEqual([
      { id: 3, at: 4_000_000, title: 'Zítra: X', body: 'B', kind: 'rsvp' },
      { id: 4, at: 5_000_000, title: 'Nové akce: Y', body: '', kind: 'rsvp' },
    ]);
  });

  // `keepDigests` has to tell a digest from a ping; the kind the schedule
  // wrote into `extra` is what comes back. No extra (an older build) is a ping.
  it('reads each pending notification’s kind back from extra', async () => {
    getPending.mockResolvedValueOnce({
      notifications: [
        { id: 5, title: 'D', schedule: { at: new Date(4_000_000) }, extra: { kind: 'digest' } },
        { id: 6, title: 'R', schedule: { at: new Date(5_000_000) }, extra: { kind: 'rsvp' } },
        { id: 7, title: 'O', schedule: { at: new Date(6_000_000) } },
      ],
    });
    const kinds = (await capacitorReminderDeps().listPending()).map((p) => p.kind);
    expect(kinds).toEqual(['digest', 'rsvp', 'rsvp']);
  });
});

describe('syncReminders — keepDigests', () => {
  // While the follow list is unresolved the plan has no digests to offer, so
  // the ones already pending are left exactly as they are.
  it('leaves pending digests alone while still reconciling pings', async () => {
    const d = deps({
      listPending: vi
        .fn()
        .mockResolvedValue([pending({ id: 7, kind: 'digest' }), pending({ id: 8, kind: 'rsvp' })]),
    });
    await syncReminders([reminder({ id: 1 })], d, { keepDigests: true });
    expect(d.cancel).toHaveBeenCalledWith([8]);
    expect(d.schedule).toHaveBeenCalledWith([expect.objectContaining({ id: 1 })]);
  });

  it('cancels a stale digest without the option', async () => {
    const d = deps({
      listPending: vi.fn().mockResolvedValue([pending({ id: 7, kind: 'digest' })]),
    });
    await syncReminders([], d);
    expect(d.cancel).toHaveBeenCalledWith([7]);
  });
});

describe('capacitorReminderDeps — createChannels', () => {
  // channelsReady is module state, so each of these needs a fresh module
  // instance — otherwise the second test would see the first's cached promise
  // and never touch the plugin (or the platform check) at all.
  async function freshCapacitorReminderDeps() {
    vi.resetModules();
    const mod = await import('../sync');
    return mod.capacitorReminderDeps;
  }

  it('creates both channels on Android, exactly once across repeated calls', async () => {
    getPlatform.mockReturnValue('android');
    const factory = await freshCapacitorReminderDeps();
    const d = factory();

    await d.createChannels();
    await d.createChannels();

    expect(createChannel).toHaveBeenCalledTimes(2);
    expect(createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: CHANNEL_RSVP, name: 'Připomínky akcí', importance: 4 })
    );
    expect(createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: CHANNEL_DIGEST, name: 'Akce spolků', importance: 3 })
    );
  });

  it('creates no channel on iOS', async () => {
    getPlatform.mockReturnValue('ios');
    const factory = await freshCapacitorReminderDeps();
    await factory().createChannels();
    expect(createChannel).not.toHaveBeenCalled();
  });
});

describe('capacitorReminderDeps — createChannels failure recovery', () => {
  // channelsReady is module state, so this needs its own fresh instance —
  // otherwise an earlier test's resolved (or rejected) promise would still be
  // cached and this one would never touch the plugin at all.
  async function freshSyncModule() {
    vi.resetModules();
    return import('../sync');
  }

  // A transient createChannel failure (bridge not ready yet, plugin hiccup)
  // used to be cached as a rejected promise forever: every later reconcile
  // re-threw the same error and never reached schedule() again for the rest
  // of the process. The guard must clear on rejection so the next
  // reconciliation gets a real retry.
  it('retries channel setup on the next reconcile after a transient failure', async () => {
    getPlatform.mockReturnValue('android');
    createChannel.mockRejectedValueOnce(new Error('bridge not ready'));

    const mod = await freshSyncModule();
    const realDeps = mod.capacitorReminderDeps();
    // isSupported normally reads the installed platform seam, which nothing
    // here installs — only the channel/schedule/permission wiring is under
    // test, so that one check is stubbed true.
    const testDeps: ReminderDeps = { ...realDeps, isSupported: () => true };

    // First reconcile: channel creation fails, so nothing is scheduled and
    // the failure is logged rather than silently wedging every later sync.
    await mod.syncReminders([reminder()], testDeps);
    expect(pluginSchedule).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalled();

    // Second reconcile: the guard was cleared on rejection, so this one
    // retries channel creation (now succeeding) and reaches schedule().
    await mod.syncReminders([reminder()], testDeps);
    expect(createChannel).toHaveBeenCalledTimes(3); // 1 failed + 2 succeeded
    expect(pluginSchedule).toHaveBeenCalled();
  });
});
