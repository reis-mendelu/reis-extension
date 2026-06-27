import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../hooks/useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ subscribedFaculties: ['mendelu', 'pef'], isLoading: false }),
}));
import { render } from '@testing-library/react';
import { EventLayer } from '../EventLayer';
import { setMapInstance } from '../mapInstance';
import { useAppStore } from '../../../store/useAppStore';
import { MOCK_MAP_EVENTS } from '../../../api/mapEvents';

const fakeMap = {
  on: vi.fn(),
  off: vi.fn(),
  latLngToContainerPoint: () => ({ x: 10, y: 20 }),
};

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({
    mapEvents: MOCK_MAP_EVENTS, eventFilter: 'all',
    activeBuildingId: null, mapSelection: null, language: 'en',
  });
  setMapInstance(fakeMap as never);
});

afterEach(() => { setMapInstance(null); });

describe('EventLayer pan binding', () => {
  it('binds the continuous move and zoom events (not only moveend/zoomend)', () => {
    render(<EventLayer />);
    const eventArg = fakeMap.on.mock.calls[0][0] as string;
    const tokens = eventArg.split(' ');
    expect(tokens).toContain('move');
    expect(tokens).toContain('zoom');
    expect(tokens).toContain('moveend');
    expect(tokens).toContain('zoomend');
  });
});
