import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type L from 'leaflet';

const trackEventSignal = vi.hoisted(() => vi.fn());
vi.mock('../../../api/eventSignals', () => ({ trackEventSignal }));

import { usePinsSeen } from '../usePinsSeen';
import { setMapInstance } from '../mapInstance';
import type { VenueGroup } from '../eventHelpers';
import type { MapEvent } from '../../../types/events';

/** A pin is Seen when it is inside the visible map on the student map. */
const group = (key: string, lng: number, ids: string[]): VenueGroup => ({
  key,
  coord: [lng, 49.2],
  events: ids.map((id) => ({ id }) as MapEvent),
});
const fakeMap = (minLng: number, maxLng: number) =>
  ({
    getBounds: () => ({
      contains: ([, lng]: [number, number]) => lng >= minLng && lng <= maxLng,
    }),
    on: vi.fn(),
    off: vi.fn(),
  }) as unknown as L.Map;

function Probe({ groups, enabled }: { groups: VenueGroup[]; enabled: boolean }) {
  usePinsSeen(groups, enabled);
  return null;
}

describe('usePinsSeen', () => {
  beforeEach(() => {
    trackEventSignal.mockClear();
    setMapInstance(fakeMap(16.6, 16.7));
  });

  it('sends Seen for the events of pins inside the bounds only', () => {
    render(<Probe enabled groups={[group('a', 16.65, ['e1', 'e2']), group('b', 17.5, ['e3'])]} />);
    // Checked on subscribe and on every pin change; eventSignals dedupes.
    expect([...new Set(trackEventSignal.mock.calls.map((c) => c[0]))].sort()).toEqual(['e1', 'e2']);
  });

  it('sends nothing while disabled (authoring, inside a building)', () => {
    render(<Probe enabled={false} groups={[group('a', 16.65, ['e1'])]} />);
    expect(trackEventSignal).not.toHaveBeenCalled();
  });
});
