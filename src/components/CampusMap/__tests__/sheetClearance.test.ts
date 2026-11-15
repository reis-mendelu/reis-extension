import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type L from 'leaflet';
import { panPinClearOfSheet } from '../sheetClearance';

/**
 * A phone map 844 px tall: the search ends at 60, the risen sheet starts at
 * 500. `pinY` is where the tapped pin is in the map's container.
 */
function setup(pinY: number) {
  const container = document.createElement('div');
  const label = document.createElement('label');
  const parent = document.createElement('div');
  parent.append(label, container);
  const sheet = document.createElement('div');
  sheet.dataset.testid = 'map-sheet';
  document.body.append(parent, sheet);
  const rect = (top: number, bottom: number) => () => ({ top, bottom }) as DOMRect;
  container.getBoundingClientRect = rect(0, 844);
  label.getBoundingClientRect = rect(12, 60);
  sheet.getBoundingClientRect = rect(500, 844);
  const map = {
    once: vi.fn(),
    off: vi.fn(),
    getContainer: () => container,
    latLngToContainerPoint: () => ({ x: 0, y: pinY }),
    panBy: vi.fn(),
  };
  return map;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('panPinClearOfSheet after a tap', () => {
  it('waits for the sheet to rise, then moves a covered pin into the strip above it', () => {
    const map = setup(600);
    panPinClearOfSheet(map as unknown as L.Map, [49.2, 16.6], {
      afterMs: 340,
      onlyIfCovered: true,
    });
    vi.advanceTimersByTime(339);
    expect(map.panBy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    // Middle of the strip is (60 + 500) / 2 = 280: the pin moves 600 → 280.
    expect(map.panBy).toHaveBeenCalledWith([0, 320], { animate: false });
  });

  it('leaves a pin the sheet does not cover where the student tapped it', () => {
    const map = setup(300);
    panPinClearOfSheet(map as unknown as L.Map, [49.2, 16.6], {
      afterMs: 340,
      onlyIfCovered: true,
    });
    vi.advanceTimersByTime(340);
    expect(map.panBy).not.toHaveBeenCalled();
  });

  it('counts a pin whose face reaches under the sheet as covered', () => {
    // 470 + the face's reach (36) passes the sheet's top at 500.
    const map = setup(470);
    panPinClearOfSheet(map as unknown as L.Map, [49.2, 16.6], {
      afterMs: 340,
      onlyIfCovered: true,
    });
    vi.advanceTimersByTime(340);
    expect(map.panBy).toHaveBeenCalled();
  });
});
