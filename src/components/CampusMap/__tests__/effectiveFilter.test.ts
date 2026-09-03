import { describe, it, expect } from 'vitest';
import { effectiveFilter, filterEvents } from '../eventHelpers';
import type { MapEvent } from '../../../types/events';

/**
 * The list and the pins have to agree.
 *
 * `eventFilter` is the student map's society chips and it persists in the
 * shared store, so any surface WITHOUT those chips inherits a choice made
 * elsewhere and gives the student no way to clear it. The phone map showed the
 * symptom: its sheet listed every society while the map drew pins for only one,
 * because `MapEventsSection` defaulted itself to 'all' when the chips were
 * hidden and `EventLayer` read the stored filter straight from the store.
 */
describe('effectiveFilter', () => {
  it('honours the stored filter where the chips are on screen', () => {
    expect(effectiveFilter('esn', true)).toBe('esn');
  });

  it('ignores it entirely where there are no chips to clear it with', () => {
    expect(effectiveFilter('esn', false)).toBe('all');
  });

  it('leaves an unfiltered map unfiltered either way', () => {
    expect(effectiveFilter('all', true)).toBe('all');
    expect(effectiveFilter('all', false)).toBe('all');
  });

  it('gives the list and the pins the same events when the chips are hidden', () => {
    const events = [
      { id: '1', societyId: 'esn' },
      { id: '2', societyId: 'supef' },
    ] as unknown as MapEvent[];
    // What the sheet shows, and what the layer shows, from one rule.
    const list = filterEvents(events, effectiveFilter('esn', false));
    const pins = filterEvents(events, effectiveFilter('esn', false));
    expect(list).toHaveLength(2);
    expect(pins).toEqual(list);
  });

  it('still narrows both together when the chips ARE shown', () => {
    const events = [
      { id: '1', societyId: 'esn' },
      { id: '2', societyId: 'supef' },
    ] as unknown as MapEvent[];
    expect(filterEvents(events, effectiveFilter('esn', true))).toHaveLength(1);
  });
});
