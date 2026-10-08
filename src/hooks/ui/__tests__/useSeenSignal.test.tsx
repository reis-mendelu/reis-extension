import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

const trackEventSignal = vi.hoisted(() => vi.fn());
vi.mock('../../../api/eventSignals', () => ({ trackEventSignal }));

import { useSeenSignal } from '../useSeenSignal';

/** Seen = at least half of the row on screen (spec 2026-10-08). */
type Entry = { isIntersecting: boolean; intersectionRatio: number };
let fire: ((entries: Entry[]) => void) | null = null;
class FakeObserver {
  constructor(cb: (e: Entry[]) => void) {
    fire = cb;
  }
  observe() {}
  disconnect() {}
}

function Row({ id }: { id: string | null }) {
  return <div ref={useSeenSignal<HTMLDivElement>(id)} />;
}

describe('useSeenSignal', () => {
  beforeEach(() => {
    trackEventSignal.mockClear();
    fire = null;
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends Seen once the element is on screen', () => {
    render(<Row id="e1" />);
    fire?.([{ isIntersecting: false, intersectionRatio: 0 }]);
    // A sliver intersects but is not "seen".
    fire?.([{ isIntersecting: true, intersectionRatio: 0.1 }]);
    expect(trackEventSignal).not.toHaveBeenCalled();
    fire?.([{ isIntersecting: true, intersectionRatio: 0.6 }]);
    expect(trackEventSignal).toHaveBeenCalledWith('e1', 'seen');
  });

  it('observes nothing without an event', () => {
    render(<Row id={null} />);
    expect(fire).toBeNull();
  });
});
