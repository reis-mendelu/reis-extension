import { describe, it, expect } from 'vitest';
import { nextLessonTarget } from '../nextLessonTarget';
import type { BlockLesson } from '../../../types/schedule';

/** Only the fields the target resolver reads; the rest of BlockLesson is noise here. */
const lesson = (date: string, startTime: string, room: string, endTime?: string): BlockLesson => {
  // Default to a 50-minute block, so a fixture's start time alone decides
  // whether the lesson is still running — an end time copied from another
  // fixture is how this test first "failed" against correct code.
  const [h = 0, m = 0] = startTime.split(':').map(Number);
  const end =
    endTime ??
    `${String(h + (m >= 10 ? 1 : 0)).padStart(2, '0')}:${String((m + 50) % 60).padStart(2, '0')}`;
  return {
    date,
    startTime,
    endTime: end,
    room,
    courseName: 'Test',
    id: room + startTime,
  } as BlockLesson;
};

const at = (iso: string) => new Date(iso);
// Monday 21 September 2026.
const MON_10 = at('2026-09-21T10:00:00');

describe('nextLessonTarget', () => {
  it('picks the next lesson still to come today', () => {
    const t = nextLessonTarget(
      [lesson('20260921', '09:00', 'Q31'), lesson('20260921', '13:00', 'Q31')],
      MON_10
    );
    expect(t!.buildingName).toBe('Q');
    expect(t!.startsAt.getHours()).toBe(13);
  });

  it('is null when nothing is left today, rather than routing to Thursday', () => {
    expect(nextLessonTarget([lesson('20260924', '09:00', 'Q31')], MON_10)).toBeNull();
  });

  it('still targets a lesson that has already started, because you are late', () => {
    const t = nextLessonTarget([lesson('20260921', '09:50', 'Q31')], MON_10);
    expect(t).not.toBeNull();
    expect(t!.buildingName).toBe('Q');
  });

  it('gives up on a lesson that has already ended', () => {
    // 09:00-09:50, asked at 10:00. Walking there now helps nobody.
    expect(nextLessonTarget([lesson('20260921', '09:00', 'Q31', '09:50')], MON_10)).toBeNull();
  });

  it('still targets a lesson that is in progress', () => {
    // 09:00-10:50 at 10:00: you are in it, or late to it. Either way the walk
    // is the one you want.
    const t = nextLessonTarget([lesson('20260921', '09:00', 'Q31', '10:50')], MON_10);
    expect(t!.buildingName).toBe('Q');
  });

  it('is null for a room the map does not know, which is every FRRMS room today', () => {
    // Budova Z is not in the My MENDELU survey, so Z25 has no geometry and no
    // building. A button that looks fine and does nothing is worse than none.
    expect(nextLessonTarget([lesson('20260921', '13:00', 'Z25')], MON_10)).toBeNull();
  });

  it('strips the campus in brackets that schedules print after the room', () => {
    const t = nextLessonTarget([lesson('20260921', '13:00', 'Q31 (Černá Pole)')], MON_10);
    expect(t!.buildingName).toBe('Q');
  });

  it('carries a human label, never the estate code', () => {
    // resolveRoomCode prefers the room's nickname when IS has given it one —
    // Q31 is "Učebna bankovnictví Komerčka" — then the printed name, then the
    // code. Whichever it picks, it must not be the BA39N… estate code.
    const t = nextLessonTarget([lesson('20260921', '13:00', 'Q31')], MON_10);
    expect(t!.roomLabel).toBeTruthy();
    expect(t!.roomLabel).not.toMatch(/^BA\d/);
  });

  it('resolves building Q, whose id is 0 and must not be read as falsy', () => {
    // The single highest-risk gotcha in the campus map: buildingId === 0 is a
    // real building.
    const t = nextLessonTarget([lesson('20260921', '13:00', 'Q31')], MON_10);
    expect(t!.buildingName).toBe('Q');
  });

  it('takes the earliest of several remaining lessons, whatever order they arrive in', () => {
    const t = nextLessonTarget(
      [lesson('20260921', '16:00', 'Q31'), lesson('20260921', '11:00', 'Q31')],
      MON_10
    );
    expect(t!.startsAt.getHours()).toBe(11);
  });

  it('ignores a lesson on another day with an earlier clock time', () => {
    const t = nextLessonTarget(
      [lesson('20260922', '08:00', 'Q31'), lesson('20260921', '15:00', 'Q31')],
      MON_10
    );
    expect(t!.startsAt.getDate()).toBe(21);
  });

  it('is null for an empty timetable', () => {
    expect(nextLessonTarget([], MON_10)).toBeNull();
  });

  it('withholds the route when the EARLIEST lesson is the unresolvable one', () => {
    // 11:00 at FRRMS (Z25, no floor plan), 13:00 in Q31. Walking the list until
    // something resolves would send the student to Q while their actual next
    // class is at FRRMS — a route to the wrong lesson, presented as the right
    // one. Better to say nothing and leave the picker.
    const t = nextLessonTarget(
      [lesson('20260921', '11:00', 'Z25'), lesson('20260921', '13:00', 'Q31')],
      MON_10
    );
    expect(t).toBeNull();
  });

  it('still resolves when the unresolvable lesson is the LATER one', () => {
    const t = nextLessonTarget(
      [lesson('20260921', '11:00', 'Q31'), lesson('20260921', '13:00', 'Z25')],
      MON_10
    );
    expect(t!.buildingName).toBe('Q');
    expect(t!.startsAt.getHours()).toBe(11);
  });
});
