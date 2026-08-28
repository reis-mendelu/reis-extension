import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type L from 'leaflet';
import { useAppStore } from '../../../store/useAppStore';
import { setMapInstance } from '../mapInstance';
import { useDraftCamera } from '../useDraftCamera';

function Probe() {
  useDraftCamera();
  return null;
}

function fakeMap(zoom = 15) {
  return {
    setView: vi.fn(),
    getZoom: () => zoom,
  } as unknown as L.Map & { setView: ReturnType<typeof vi.fn> };
}

describe('useDraftCamera', () => {
  beforeEach(() => {
    setMapInstance(null);
    useAppStore.setState({ draftCoord: null, draftFocusRequest: 0 });
  });
  afterEach(() => setMapInstance(null));

  it('does not move the camera on mount', () => {
    const map = fakeMap();
    setMapInstance(map);
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<Probe />);
    expect(map.setView).not.toHaveBeenCalled();
  });

  it('flies to the draft when a preview is requested, lat/lng-ordered', () => {
    const map = fakeMap();
    setMapInstance(map);
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<Probe />);

    act(() => useAppStore.getState().previewDraftOnMap());

    // Leaflet takes [lat, lng]; the store holds [lng, lat] like the rest of the
    // event data, so this is the one place the pair is flipped.
    expect(map.setView).toHaveBeenCalledWith([49.21, 16.61], 18, expect.anything());
  });

  it('never zooms back out on someone already looking closer', () => {
    const map = fakeMap(19);
    setMapInstance(map);
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<Probe />);

    act(() => useAppStore.getState().previewDraftOnMap());
    expect(map.setView).toHaveBeenCalledWith([49.21, 16.61], 19, expect.anything());
  });

  // On a phone the map is not even mounted when the button is pressed — the
  // same request is what switches to the map tab. The move has to survive the
  // gap, or the society taps "show me" and lands on an unmoved map.
  it('applies a request made before the map existed, once it appears', () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<Probe />);

    act(() => useAppStore.getState().previewDraftOnMap());

    const map = fakeMap();
    act(() => setMapInstance(map));
    expect(map.setView).toHaveBeenCalledWith([49.21, 16.61], 18, expect.anything());
  });

  it('does not re-fly on a later unrelated map remount', () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<Probe />);
    act(() => useAppStore.getState().previewDraftOnMap());

    const first = fakeMap();
    act(() => setMapInstance(first));
    const second = fakeMap();
    act(() => setMapInstance(second));

    expect(second.setView).not.toHaveBeenCalled();
  });

  it('ignores a request with no draft placed', () => {
    const map = fakeMap();
    setMapInstance(map);
    render(<Probe />);
    act(() => useAppStore.getState().previewDraftOnMap());
    expect(map.setView).not.toHaveBeenCalled();
  });
});
