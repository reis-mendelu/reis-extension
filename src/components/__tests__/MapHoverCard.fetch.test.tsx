import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { MapHoverCard } from '../MapHoverCard';

/**
 * The hover is what wants the geometry, so the hover is what asks for it.
 *
 * This moved out of `RoomThumbnail`'s `useEffect`. Asking here rather than in
 * the child also means the request goes out with the same gesture that opens
 * the card, instead of one render later.
 */
const loadRoomGeometry = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  loadRoomGeometry.mockClear();
  useAppStore.setState({ roomsByBuilding: {}, loadRoomGeometry });
});

afterEach(() => {
  vi.useRealTimers();
});

const HOVER_DELAY_MS = 450;

function hover() {
  const { container } = render(
    <MapHoverCard roomName="A01">
      <span>A01</span>
    </MapHoverCard>
  );
  const anchor = container.querySelector('span');
  fireEvent.mouseEnter(anchor!);
  return anchor!;
}

describe('MapHoverCard', () => {
  it('asks the store for the room geometry once the card is revealed', () => {
    hover();
    expect(loadRoomGeometry).not.toHaveBeenCalled(); // not before the hover settles
    act(() => {
      vi.advanceTimersByTime(HOVER_DELAY_MS);
    });
    expect(loadRoomGeometry).toHaveBeenCalledWith('A01');
  });

  it('asks for nothing when the pointer leaves before the card opens', () => {
    const anchor = hover();
    fireEvent.mouseLeave(anchor);
    act(() => {
      vi.advanceTimersByTime(HOVER_DELAY_MS * 2);
    });
    expect(loadRoomGeometry).not.toHaveBeenCalled();
  });
});
