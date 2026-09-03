import { describe, it, expect } from 'vitest';
import { hasFinished } from '../eventWindow';

/**
 * "Akce spolku se nearchivují s datem, jakmile proběhlo."
 *
 * Reproduced: an event dated TODAY stays in the admin's Live bucket even at
 * 23:00, because `isPastEvent` is a whole-day delta — it archives the NEXT day.
 * Yesterday's event archives correctly, so the buckets are not broken.
 *
 * The buckets deliberately stay as they are: they mirror the PUBLIC window, so
 * "Live" means "on the student map now", and an event has to stay visible to
 * students through its whole day — they are still arriving at 19:00. What was
 * missing is a way to see, in the console, that a Live event has already
 * happened. That is this predicate, and it is used only for that marker.
 */
describe('hasFinished', () => {
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const at = (h: number) => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d;
  };

  it('is true for an event whose start time has passed today', () => {
    expect(hasFinished({ date: today(), time: '19:00' }, at(23))).toBe(true);
  });

  it('is false before it starts', () => {
    expect(hasFinished({ date: today(), time: '19:00' }, at(10))).toBe(false);
  });

  it('is false for a later day, whatever the clock says', () => {
    expect(hasFinished({ date: tomorrow(), time: '08:00' }, at(23))).toBe(false);
  });

  it('needs a time — a dateless-time event is never marked mid-day', () => {
    // Without a time there is nothing to compare, and guessing a start would
    // mark an all-day event as over at midnight.
    expect(hasFinished({ date: today(), time: null }, at(23))).toBe(false);
  });

  it('is false for a past day, where the bucket already says so', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // Yesterday's event is in "Proběhlé" already; the marker is for the Live
    // bucket only, so it must not double up.
    expect(hasFinished({ date: yesterday, time: '19:00' }, at(12))).toBe(false);
  });
});
