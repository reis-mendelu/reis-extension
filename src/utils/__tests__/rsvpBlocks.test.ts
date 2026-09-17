import { describe, it, expect } from 'vitest';
import { planRsvpBlocks, rsvpBlockId, isRsvpBlock, RSVP_BLOCK_MINUTES } from '../rsvpBlocks';
import type { MapEvent } from '../../types/events';

const ev = (id: string, date: string, time: string | null, title = 'Flag Party'): MapEvent =>
  ({ id, title, date, time, location: 'Zlatá loď', societyId: 'esn' }) as MapEvent;

describe('planRsvpBlocks', () => {
  it('gives an answered event a 1.5 hour block', () => {
    const [block] = planRsvpBlocks([ev('a', '2026-09-21', '19:00')], { a: 'interested' });
    expect(block).toMatchObject({
      id: 'rsvp:a',
      title: 'Flag Party',
      date: '20260921',
      startTime: '19:00',
      endTime: '20:30',
      room: 'Zlatá loď',
    });
  });

  it('is exactly the length it says it is', () => {
    expect(RSVP_BLOCK_MINUTES).toBe(90);
  });

  it('plans nothing for an event the student has not answered', () => {
    expect(planRsvpBlocks([ev('a', '2026-09-21', '19:00')], {})).toEqual([]);
  });

  it('plans nothing for an event with no time — there is no block to draw', () => {
    expect(planRsvpBlocks([ev('a', '2026-09-21', null)], { a: 'interested' })).toEqual([]);
  });

  it('cuts a late block at the end of its own day rather than rolling past midnight', () => {
    const [block] = planRsvpBlocks([ev('a', '2026-09-21', '23:00')], { a: 'interested' });
    expect(block!.date).toBe('20260921');
    expect(block!.endTime).toBe('23:59');
  });

  it('takes a dotted time, the way the reminders do', () => {
    const [block] = planRsvpBlocks([ev('a', '2026-09-21', '19.30')], { a: 'interested' });
    expect(block!.startTime).toBe('19:30');
    expect(block!.endTime).toBe('21:00');
  });

  it('marks its own blocks so reconciliation never deletes a student’s own', () => {
    expect(isRsvpBlock(rsvpBlockId('a'))).toBe(true);
    expect(isRsvpBlock('custom-1758000000000')).toBe(false);
  });
});
