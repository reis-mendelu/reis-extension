import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncReminders, resetReminderQueue, type ReminderDeps } from '../sync';
import type { PlannedReminder } from '../plan';

function reminder(over: Partial<PlannedReminder> = {}): PlannedReminder {
  return { id: 1, eventId: 'e1', title: 'Beánie', body: 'Q01', at: 2_000_000, ...over };
}

function deps(over: Partial<ReminderDeps> = {}): ReminderDeps {
  return {
    isSupported: () => true,
    checkPermission: vi.fn().mockResolvedValue('granted'),
    requestPermission: vi.fn().mockResolvedValue('granted'),
    listPending: vi.fn().mockResolvedValue([]),
    schedule: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
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

  // Rescheduling every load would re-post the same notification; the plugin
  // keys on id, so an already-pending reminder is left alone.
  it('leaves an identical pending reminder alone', async () => {
    const d = deps({ listPending: vi.fn().mockResolvedValue([{ id: 1, at: 2_000_000 }]) });
    await syncReminders([reminder()], d);
    expect(d.schedule).not.toHaveBeenCalled();
    expect(d.cancel).not.toHaveBeenCalled();
  });

  it('reschedules when the event time moved', async () => {
    const d = deps({ listPending: vi.fn().mockResolvedValue([{ id: 1, at: 999 }]) });
    await syncReminders([reminder({ at: 2_000_000 })], d);
    expect(d.schedule).toHaveBeenCalledWith([expect.objectContaining({ id: 1, at: 2_000_000 })]);
  });

  // Un-RSVPing has to take the notification away, or the student gets pinged
  // about something they explicitly backed out of.
  it('cancels a reminder that is no longer planned', async () => {
    const d = deps({ listPending: vi.fn().mockResolvedValue([{ id: 7, at: 2_000_000 }]) });
    await syncReminders([], d);
    expect(d.cancel).toHaveBeenCalledWith([7]);
  });

  it('cancels and schedules in the same pass', async () => {
    const d = deps({ listPending: vi.fn().mockResolvedValue([{ id: 7, at: 1 }]) });
    await syncReminders([reminder({ id: 1 })], d);
    expect(d.cancel).toHaveBeenCalledWith([7]);
    expect(d.schedule).toHaveBeenCalledWith([expect.objectContaining({ id: 1 })]);
  });

  describe('permission', () => {
    // The prompt is earned: it appears the first time the student asks to be
    // reminded, not on a cold boot before they have done anything.
    it('asks only when there is something to schedule', async () => {
      const d = deps({ checkPermission: vi.fn().mockResolvedValue('prompt') });
      await syncReminders([], d);
      expect(d.requestPermission).not.toHaveBeenCalled();
    });

    it('asks once there is a reminder to post', async () => {
      const d = deps({ checkPermission: vi.fn().mockResolvedValue('prompt') });
      await syncReminders([reminder()], d);
      expect(d.requestPermission).toHaveBeenCalled();
      expect(d.schedule).toHaveBeenCalled();
    });

    it('schedules nothing when the student declines', async () => {
      const d = deps({
        checkPermission: vi.fn().mockResolvedValue('prompt'),
        requestPermission: vi.fn().mockResolvedValue('denied'),
      });
      await syncReminders([reminder()], d);
      expect(d.schedule).not.toHaveBeenCalled();
    });

    it('does not re-ask a student who already said no', async () => {
      const d = deps({ checkPermission: vi.fn().mockResolvedValue('denied') });
      await syncReminders([reminder()], d);
      expect(d.requestPermission).not.toHaveBeenCalled();
      expect(d.schedule).not.toHaveBeenCalled();
    });

    // Cancelling never needs permission, and a student who revoked it must
    // still lose the reminders they backed out of.
    it('still cancels stale reminders without permission', async () => {
      const d = deps({
        checkPermission: vi.fn().mockResolvedValue('denied'),
        listPending: vi.fn().mockResolvedValue([{ id: 7, at: 1 }]),
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

describe('syncReminders — permission states', () => {
  // Android returns this after a first refusal. It used to be cast to the
  // narrower union, matched no branch, and left the student never asked again.
  it('still asks when the platform reports prompt-with-rationale', async () => {
    const d = deps({
      checkPermission: vi.fn().mockResolvedValue('prompt-with-rationale'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    await syncReminders([reminder()], d);
    expect(d.requestPermission).toHaveBeenCalled();
    expect(d.schedule).toHaveBeenCalled();
  });

  it('does not schedule when the student refuses at the prompt', async () => {
    const d = deps({
      checkPermission: vi.fn().mockResolvedValue('prompt-with-rationale'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
    });
    await syncReminders([reminder()], d);
    expect(d.schedule).not.toHaveBeenCalled();
  });
});

describe('syncReminders — overlapping runs', () => {
  // Un-RSVPing right after RSVPing fires two reconciliations. Unserialised, the
  // first can schedule after the second has already cancelled, leaving a
  // notification for an event the student backed out of.
  it('applies the newest plan last even when an older run is slower', async () => {
    // A stand-in for the device's own pending list, so the second run sees what
    // the first actually did rather than a fixed empty array.
    let device: { id: number; at: number }[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => (releaseFirst = r));
    let call = 0;

    const d = deps({
      listPending: vi.fn(async () => {
        if (call++ === 0) await gate;
        return device;
      }),
      schedule: vi.fn(async (rs: PlannedReminder[]) => {
        device = [...device, ...rs.map((r) => ({ id: r.id, at: r.at }))];
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
