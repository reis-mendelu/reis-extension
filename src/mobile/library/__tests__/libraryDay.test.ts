import { describe, expect, it } from 'vitest';
import { holidayOf, lessonHours, shownDay, weekdaysFrom } from '../libraryDay';
import { canExtend, withOwnBookings } from '../libraryHours';
import { gridRows } from '../libraryGrid';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';
import type { Block } from '../availability';
import { libraryRoomOf } from '../ownBooking';

// Monday 16 November 2026; Tuesday 17 November is a public holiday.
const MON = '2026-11-16';
const WED = '2026-11-18';
// Prague instants: the library's hours are Prague's, and CI runs in UTC.
const pad2 = (n: number) => String(n).padStart(2, '0');
const at = (h: number, m = 0) => new Date(`2026-11-16T${pad2(h)}:${pad2(m)}:00+01:00`);
const free = (day: string, from: number, to: number): Block => ({
  status: 'free',
  start: `${day}T${String(from).padStart(2, '0')}:00`,
  end: `${day}T${String(to).padStart(2, '0')}:00`,
});
const [ind1, ind2] = LIBRARY_ROOMS;

describe('shownDay', () => {
  it('is today while an hour of today can still be booked', () => {
    expect(shownDay(at(9))).toBe(MON);
    expect(shownDay(at(17, 0))).toBe(MON);
  });
  it('moves past the evening, the weekend and a public holiday', () => {
    expect(shownDay(at(19, 30))).toBe(WED);
    expect(shownDay(new Date('2026-11-20T18:00:00+01:00'))).toBe('2026-11-23');
  });
});

describe('weekdaysFrom / holidayOf', () => {
  it('lists five weekdays, the holiday among them, named', () => {
    expect(weekdaysFrom(MON)).toEqual([MON, '2026-11-17', WED, '2026-11-19', '2026-11-20']);
    expect(holidayOf('2026-11-17', 'cz')).toBe('Den boje za svobodu a demokracii');
    expect(holidayOf(WED, 'cz')).toBeNull();
  });
});

describe('lessonHours', () => {
  it('marks every library hour a class touches, and only real classes of that day', () => {
    const lessons = [
      { date: '20261116', startTime: '17:00', endTime: '18:50' },
      { date: '20261116', startTime: '09:00', endTime: '10:00', isCustom: true },
      { date: '20261117', startTime: '07:00', endTime: '08:50' },
    ];
    expect([...lessonHours(lessons, MON)]).toEqual([17, 18]);
  });
});

describe('withOwnBookings', () => {
  it('takes the student’s own booked hours away even while the library still offers them', () => {
    const blocks = {
      [ind1!.featureId]: [free('2026-11-20', 7, 19)],
      [ind2!.featureId]: [free('2026-11-20', 7, 19)],
    };
    const mine = [
      {
        id: 'library:a',
        date: '20261120',
        startTime: '09:00',
        endTime: '10:00',
        libraryBooking: { featureId: ind1!.featureId },
      },
      { id: 'own', date: '20261120', startTime: '09:00', endTime: '11:00' },
    ];
    const seen = withOwnBookings(blocks, mine);
    const cells = (hour: number) =>
      gridRows(seen, '2026-11-20', at(8), new Set(), []).find((r) => r.hour === hour)!.cells;
    expect(cells(9)[ind1!.featureId]).toBe('taken');
    expect(cells(9)[ind2!.featureId]).toBe('free');
    expect(cells(10)[ind1!.featureId]).toBe('free');
  });
});

describe('canExtend', () => {
  const block = {
    id: 'library:b',
    date: '20261120',
    startTime: '09:00',
    endTime: '10:00',
    libraryBooking: { featureId: ind1!.featureId },
  };
  it('offers the next hour of the same room while it is free and under the cap', () => {
    const blocks = { [ind1!.featureId]: [free('2026-11-20', 7, 19)] };
    expect(canExtend(blocks, [block], block, at(8))).toBe(11);
  });
  it('offers nothing when that hour is taken, the day is capped, or nothing is known', () => {
    expect(
      canExtend({ [ind1!.featureId]: [free('2026-11-20', 9, 10)] }, [block], block, at(8))
    ).toBeNull();
    const four = { ...block, startTime: '13:00', endTime: '16:00' };
    expect(
      canExtend({ [ind1!.featureId]: [free('2026-11-20', 7, 19)] }, [block, four], block, at(8))
    ).toBeNull();
    expect(canExtend({}, [block], block, at(8))).toBeNull();
  });
});

describe('libraryRoomOf', () => {
  it('recognises a booking saved before storage kept its room, by its id and room name', () => {
    expect(
      libraryRoomOf({
        id: 'library:OLD',
        date: '20261120',
        startTime: '09:00',
        endTime: '11:00',
        room: 'Týmová 2',
      })
    ).toBe(57627);
    expect(
      libraryRoomOf({
        id: 'mine',
        date: '20261120',
        startTime: '09:00',
        endTime: '11:00',
        room: 'Týmová 2',
      })
    ).toBeNull();
  });
});
