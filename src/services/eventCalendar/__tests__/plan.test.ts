import { describe, it, expect } from 'vitest';
import {
  BLOCK_MINUTES,
  blockForEvent,
  blockIdFor,
  diffEventBlocks,
  isRsvpBlock,
  planEventBlocks,
} from '../plan';
import type { MapEvent } from '../../../types/events';
import type { CalendarCustomEvent } from '../../../types/calendarTypes';

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

/** Minutes between two HH:MM strings — the assertion the task is actually about. */
function span(block: CalendarCustomEvent): number {
  const mins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h! * 60 + m!;
  };
  return mins(block.endTime) - mins(block.startTime);
}

describe('blockForEvent', () => {
  it('books an hour and a half from the start time', () => {
    const block = blockForEvent(ev())!;
    expect(block.startTime).toBe('19:00');
    expect(block.endTime).toBe('20:30');
    expect(span(block)).toBe(BLOCK_MINUTES);
  });

  // The two models disagree: MapEvent.date is `YYYY-MM-DD`, the calendar's is
  // `YYYYMMDD`. Passing one through unconverted yields a block that is stored
  // happily and then never matches a day, so nothing renders and there is
  // nothing to see that would say why.
  it('compacts the date into the form the calendar stores', () => {
    expect(blockForEvent(ev())!.date).toBe('20260910');
  });

  it('carries the venue across as the room', () => {
    expect(blockForEvent(ev())!.room).toBe('Q01');
  });

  it('leaves the room off an event with no venue', () => {
    expect(blockForEvent(ev({ location: null }))!.room).toBeUndefined();
  });

  it('takes its id from the event, so re-answering replaces rather than adds', () => {
    expect(blockForEvent(ev())!.id).toBe(blockIdFor('e1'));
    expect(blockForEvent(ev())!.id).toBe(blockForEvent(ev())!.id);
  });

  it('accepts the dotted Czech time IS sometimes emits', () => {
    const block = blockForEvent(ev({ time: '19.30' }))!;
    expect([block.startTime, block.endTime]).toEqual(['19:30', '21:00']);
  });

  // An all-day entry has no ninety minutes to take, and inventing a slot for it
  // would put a block at a time nobody chose — the same rule the reminder
  // planner already applies.
  it('places nothing for an event with no time', () => {
    expect(blockForEvent(ev({ time: null }))).toBeNull();
  });

  it('places nothing for a date that does not exist', () => {
    expect(blockForEvent(ev({ date: '2026-02-30' }))).toBeNull();
  });

  // One date field, so the 00:30 has nowhere to go. Clamped rather than
  // wrapped: an endTime before its startTime draws a negative-height block.
  it('clamps a late start to the end of its own day instead of wrapping', () => {
    const block = blockForEvent(ev({ time: '23:00' }))!;
    expect(block.date).toBe('20260910');
    expect([block.startTime, block.endTime]).toEqual(['23:00', '23:59']);
    expect(span(block)).toBeGreaterThan(0);
  });

  it('places nothing when the clamp would leave no block at all', () => {
    expect(blockForEvent(ev({ time: '23:59' }))).toBeNull();
  });
});

describe('planEventBlocks', () => {
  it('books only the events the student answered', () => {
    const events = [ev(), ev({ id: 'e2', title: 'Kvíz', date: '2026-09-12', time: '18:30' })];
    const plan = planEventBlocks(events, { e2: 'interested' });
    expect(plan.map((b) => b.title)).toEqual(['Kvíz']);
    expect(plan[0]!.startTime).toBe('18:30');
    expect(plan[0]!.endTime).toBe('20:00');
  });

  it('books nothing when nothing is answered', () => {
    expect(planEventBlocks([ev()], {})).toEqual([]);
  });

  // Withdrawal is what makes the derived plan worth having: the answer simply
  // stops being in it, and reconciliation deletes whatever is no longer there.
  it('drops an event once its answer is withdrawn', () => {
    expect(planEventBlocks([ev()], { e1: 'interested' })).toHaveLength(1);
    expect(planEventBlocks([ev()], {})).toHaveLength(0);
  });

  it('skips an answered event it cannot place, without dropping the others', () => {
    const events = [ev({ time: null }), ev({ id: 'e2', title: 'Kvíz' })];
    const plan = planEventBlocks(events, { e1: 'interested', e2: 'interested' });
    expect(plan.map((b) => b.title)).toEqual(['Kvíz']);
  });
});

describe('isRsvpBlock', () => {
  it('claims the blocks this feature writes', () => {
    expect(isRsvpBlock(blockIdFor('e1'))).toBe(true);
  });

  // The guard that keeps reconciliation from deleting a student's own events:
  // hand-made ones are `crypto.randomUUID()`.
  it('disclaims a hand-made event', () => {
    expect(isRsvpBlock('3f1b1a5e-0b6a-4d23-9a1e-2f0c1d4e5a6b')).toBe(false);
  });
});

describe('diffEventBlocks', () => {
  const block = (over: Partial<CalendarCustomEvent> = {}): CalendarCustomEvent => ({
    id: blockIdFor('e1'),
    title: 'Beánie PEF',
    date: '20260910',
    startTime: '19:00',
    endTime: '20:30',
    room: 'Q01',
    ...over,
  });

  it('adds a block that is planned but not stored', () => {
    expect(diffEventBlocks([], [block()])).toEqual({ add: [block()], update: [], remove: [] });
  });

  it('removes a block that is stored but no longer planned', () => {
    expect(diffEventBlocks([block()], [])).toEqual({
      add: [],
      update: [],
      remove: [blockIdFor('e1')],
    });
  });

  // The whole point of reconciling after every settled answer: doing it must be
  // free when nothing moved, or an idle load would rewrite IndexedDB each time.
  it('does nothing at all when the stored block already matches', () => {
    expect(diffEventBlocks([block()], [block()])).toEqual({ add: [], update: [], remove: [] });
  });

  it('updates in place when the event was rescheduled', () => {
    const moved = block({ startTime: '20:00', endTime: '21:30' });
    expect(diffEventBlocks([block()], [moved])).toEqual({ add: [], update: [moved], remove: [] });
  });

  it('notices a renamed event', () => {
    const renamed = block({ title: 'Beánie PEF 2026' });
    expect(diffEventBlocks([block()], [renamed])).toEqual({
      add: [],
      update: [renamed],
      remove: [],
    });
  });

  it('handles an add, an update and a removal in one pass', () => {
    const stored = [block(), block({ id: blockIdFor('gone'), title: 'Zrušeno' })];
    const planned = [block({ title: 'Beánie PEF 2026' }), block({ id: blockIdFor('new') })];
    const diff = diffEventBlocks(stored, planned);
    expect(diff.add.map((b) => b.id)).toEqual([blockIdFor('new')]);
    expect(diff.update.map((b) => b.title)).toEqual(['Beánie PEF 2026']);
    expect(diff.remove).toEqual([blockIdFor('gone')]);
  });
});
